# HANDOFF.md

Single source of truth for the current project state.
Any AI starting a new session must read this file FIRST instead of analyzing the entire repository.
This file must be updated after every completed development step, BEFORE creating the Git commit.

# Project Overview

- **Project name:** ForzaDJ Admin Bot
- **Purpose:** A standalone Telegram admin bot that receives audio files, downloads them locally, extracts metadata, and (soon) analyzes tracks with AI (genre, mood, version, rating). Later it will upload tracks to the ForzaDJ website.
- **Current development stage:** Foundation complete. Bot works end-to-end for receiving/downloading audio, metadata extraction runs, AI analysis is integrated and appended to the Telegram reply, and access control is enforced.

# Architecture

```
src/
├── index.ts                          # Entry point: token check, bot creation, middleware + audio/callback handler registration, polling start
├── bot/
│   └── auth.ts                       # authMiddleware: private chats only + ID allowlist, replies "⛔ Access denied." otherwise
├── config/
│   ├── ai.ts                         # getAIProvider(): reads/validates AI_PROVIDER ("mock" | "kimi")
│   └── auth.ts                       # isAllowedTelegramUser(): parses/validates ALLOWED_TELEGRAM_IDS at startup
├── handlers/
│   ├── audio.ts                      # createAudioHandler(token): file-type validation, orchestrates download → metadata → AI → preview reply + stores PendingPublication
│   └── callbacks.ts                  # registerCallbackHandlers(bot): "publish" → publishTrack() → ForzaDJ API; "cancel" → clears pending
├── services/
│   ├── telegram-download.ts          # Downloads file from Telegram, saves to temp/YYYY-MM-DD/, collision → _HHMMSS suffix
│   ├── audio-metadata.ts             # extractAudioMetadata(): music-metadata parse → { block: string; input: AIInput }
│   ├── pending.ts                    # pendingStore: Map<chatId, PendingPublication> — holds file path + metadata + AI result between audio handler and publish callback
│   ├── forzadj-api.ts                # publishTrack(pending): multipart POST to FORZADJ_API_URL/api/bot/upload → PublishResult
│   └── ai/
│       ├── types.ts                  # AIInput (artist, title, album, year, duration, bitrate, sampleRate, channels, codec, format, embeddedGenre) / AIOutput
│       ├── provider.ts               # analyzeTrack(): dispatches to mock or kimi based on AI_PROVIDER
│       └── providers/
│           └── kimi.ts               # analyzeWithKimi(): TokenRouter fetch; buildPrompt() injects AIInput + ForzaDJ taxonomy; JSON → AIOutput
└── utils/                            # (empty, reserved)

scripts/
└── test-kimi.ts                      # Standalone test: calls analyzeTrack(), prints AIOutput JSON, exits
```

Dependencies: `grammy`, `dotenv`, `music-metadata` (runtime); `typescript`, `tsx`, `@types/node` (dev). Build: `pnpm build` (tsc). Run: `pnpm dev` (tsx) or `pnpm start` (dist).

# Current Features

- `/start` command replies with a greeting.
- Accepts audio messages and document messages with audio content.
- File-type validation: extensions `.mp3`, `.wav`, `.flac`, `.aiff` or `audio/*` MIME type; everything else gets "Unsupported file type.".
- Downloads audio from Telegram and saves it to `temp/YYYY-MM-DD/` with the original filename.
- Filename collisions get an `_HHMMSS` suffix (e.g. `Tiesto - Adagio_021530.mp3`).
- Extracts metadata locally with `music-metadata`: artist, title, album, year, duration, bitrate, sample rate, channels, codec, container, ISRC.
- Replies with a formatted save confirmation plus the full metadata block; missing values show `n/a`; parse failure degrades gracefully.
- Access control: only private chats and whitelisted Telegram user IDs can use the bot; everyone else gets `⛔ Access denied.`.
- AI layer: configurable provider system (`mock` | `kimi`); Kimi runs through TokenRouter and returns `AIOutput { genre, mood, version, rating }`. Called from the audio handler after metadata extraction.

# Environment Variables

All loaded from `.env` (never committed — `.env` is gitignored; `.env.example` documents keys only).

- `BOT_TOKEN` — Telegram Bot API token.
- `AI_PROVIDER` — active AI provider: `mock` (default) or `kimi`.
- `TOKENROUTER_API_KEY` — TokenRouter API key for the Kimi provider.
- `TOKENROUTER_BASE_URL` — TokenRouter base URL (e.g. `https://api.tokenrouter.com/v1`).
- `TOKENROUTER_MODEL` — TokenRouter model ID (e.g. `moonshotai/kimi-k3-free`).
- `ALLOWED_TELEGRAM_IDS` — comma-separated whitelisted Telegram user IDs (e.g. `123456789,987654321`).
- `GROQ_API_KEY` — Groq API key (console.groq.com); used when `AI_PROVIDER=groq`.
- `FORZADJ_API_URL` — ForzaDJ website base URL (e.g. `https://forzadj.ru`).
- `FORZADJ_BOT_SECRET` — shared secret matching `BOT_UPLOAD_SECRET` on the ForzaDJ site.

Never include real secret values anywhere in the repository.

# Current AI Flow

1. `analyzeTrack(input: AIInput)` in `src/services/ai/provider.ts` is the single entry point.
2. It reads `AI_PROVIDER` via `getAIProvider()` (`src/config/ai.ts`); unsupported values throw a clear error.
3. `mock` → returns fixed values `{ genre: "House", mood: "Primetime", version: "Extended", rating: 5 }` without any network call.
4. `groq` → `analyzeWithGroq()` (`src/services/ai/providers/groq.ts`) sends `POST https://api.groq.com/openai/v1/chat/completions` using `llama-3.3-70b-versatile`. 30-second AbortController timeout. Typical response: 1–3 seconds.
5. `kimi` → `analyzeWithKimi()` (`src/services/ai/providers/kimi.ts`) sends an OpenAI-compatible `POST {TOKENROUTER_BASE_URL}/chat/completions` request. The prompt is built by `buildPrompt(input)`: it injects available `AIInput` fields as track context and instructs the model to classify using the ForzaDJ taxonomy only (genres: Afro House, Baile Funk, Bass House, Breaks, EDM, Garage, Hip-Hop, House, Jersey Club, Open Format, Pop, Rus, Tech House; moods: Warm Up, Prime Time, After Party; versions: Original, Extended, Remix, Mashup; rating: 1–5 integer). Falls back to "Open Format" if genre is uncertain. Returns JSON only. The JSON object is extracted from the reply and normalized into `AIOutput`; HTTP errors and empty/invalid responses throw.
5. The bot calls `analyzeTrack(metadataInput)` from `src/handlers/audio.ts`; `metadataInput` is built from real parsed metadata (artist, title, album, year, duration, bitrate, sampleRate, channels, codec, format, embeddedGenre — only present fields are included). `scripts/test-kimi.ts` is a standalone test.
6. Planned future providers (not implemented): openai, gemini, ollama.

# Telegram Flow

1. `bot.use(authMiddleware)` runs first for every update (see Security).
2. `/start` → replies `👋 ForzaDJ Admin Bot is running.`
3. `message:audio` / `message:document` → `handleAudio` in `src/handlers/audio.ts`:
   - Validates that the file is audio; otherwise replies `Unsupported file type.` and stops.
   - Creates `temp/YYYY-MM-DD/` if needed; resolves filename collisions with `_HHMMSS`.
   - Downloads via `ctx.api.getFile` + fetch, writes the file locally.
   - On download failure replies `⚠️ Failed to download the file from Telegram.`.
   - Extracts metadata from the saved file.
   - Calls `analyzeTrack(metadataInput)` with real parsed metadata; on error shows `⚠️ Analysis failed.` inside the AI section.
   - Replies with a 4-section publication preview:
     - `🎵 File` — filename, path, size
     - `📀 Metadata` — full parsed metadata fields
     - `🤖 AI Analysis` — genre, mood, version, star rating (★★★★★)
     - `📤 Publication` — `Status: Готово к проверке` (no actual publishing)
   - Reply includes `InlineKeyboard` with `✅ Publish` and `❌ Cancel` buttons.
   - After reply, saves `PendingPublication` (filePath, fileName, mimeType, metadataInput, aiResult) to `pendingStore` keyed by chatId.
   - `✅ Publish` → clears pending → removes keyboard → calls `publishTrack()` → replies with trackId + studioUrl or error.
   - `❌ Cancel` → clears pending → removes keyboard → replies "Publication cancelled."
4. No upload, no database, no queue.

# Security

- `BOT_TOKEN`, TokenRouter credentials, and allowlist live only in `.env` (gitignored).
- Authorization middleware (`src/bot/auth.ts`) registered before every handler:
  - Only `private` chats pass; groups, supergroups, and channels are rejected.
  - `ctx.from.id` must be in `ALLOWED_TELEGRAM_IDS` (parsed/validated once at startup; invalid values make startup fail fast).
  - Denied requests get exactly `⛔ Access denied.` and no further processing.
- Unsupported file types are rejected before any download happens.

# Git History

1. `106d051` **Initial working Telegram bot** — skeleton, grammY + dotenv, /start, audio download into dated temp folders with collision timestamps.
2. `d46d058` **Extract audio metadata** — `music-metadata` integration, metadata block appended to replies.
3. `d3e745a` **Refactor project architecture** — split `index.ts` into `handlers/audio.ts`, `services/telegram-download.ts`, `services/audio-metadata.ts`; zero behavior change.
4. `eb4ba90` **Prepare AI service** — `AIInput`/`AIOutput` types + placeholder `analyzeTrack()` returning mock values.
5. `1abb39c` **Add configurable AI provider** — `src/config/ai.ts` env-based provider selection; only `mock` supported.
6. `4475df1` **Add Kimi provider** — `providers/kimi.ts` (TokenRouter) implemented but not wired in.
7. `8722db3` **Activate Kimi provider** — `kimi` added to supported providers; `analyzeTrack()` dispatches; `scripts/test-kimi.ts` verified live output.
8. `fa49d30` **Add Telegram access control** — private-chat-only + `ALLOWED_TELEGRAM_IDS` allowlist middleware with `⛔ Access denied.`
9. `62340df` **Integrate AI into Telegram workflow** — `analyzeTrack({})` called from `audio.ts` after metadata extraction; `🤖 AI Analysis` block appended to reply; errors degrade gracefully to `⚠️ AI analysis failed.`
10. `99010da` **Pass real metadata to AI** — `extractAudioMetadata()` now returns `{ block, input }`: `block` is the unchanged Telegram string, `input` is a real `AIInput` built from parsed fields (only present values). `AIInput` gained `year`. `analyzeTrack({})` → `analyzeTrack(metadataInput)`.
11. `858b889` **Improve Kimi classification prompt** — replaced static test prompt with `buildPrompt(input)` that injects available track metadata and enforces the ForzaDJ taxonomy (13 genres, 3 moods, 4 versions, rating 1–5). Model must use only listed values; falls back to "Open Format" if genre uncertain. Returns JSON only.
12. `ecb8cfa` **Add publication preview** — restructured Telegram reply into 4 sections (🎵 File / 📀 Metadata / 🤖 AI Analysis / 📤 Publication). Star rating added. No actual publishing — `Status: Готово к проверке` is display-only.
13. `d213f77` **Add publication approval UI** — `InlineKeyboard` with `✅ Publish` / `❌ Cancel` appended to the preview. `callbacks.ts` handles both: Publish is a stub ready for ForzaDJ API integration; Cancel replies and closes.
14. `a5b99d9` **Integrate Telegram Bot with ForzaDJ API** — `forzadj-api.ts` sends multipart POST to `POST /api/bot/upload` (new endpoint in forzadjbeta); `pending.ts` holds track state between audio handler and publish callback; `callbacks.ts` wired to real publish. Both builds pass.
15. `af0baed` **Verify complete publication pipeline** — full end-to-end audit. Architecture confirmed correct. Site endpoint committed (`a4b4db5` in forzadjbeta). Env vars configured in both `.env` files.
16. `8638706` **Fix multipart upload** — `forzadj-api.ts`: non-ASCII (Cyrillic) filenames from Telegram broke RFC 7578 multipart `Content-Disposition` header → Next.js/undici parser threw "Invalid multipart body". Fix: use `track.{ext}` as the safe ASCII FormData filename; original filename preserved in `metadata.fileName` → stored as `Asset.originalName` in DB. Real Telegram test passed.
17. `5e00f36` **Map AI energy to Studio** — `forzadj-api.ts`: `pub.aiResult?.rating` was not sent to the API at all. Fix: add `energy: pub.aiResult?.rating` to the `metadata` JSON payload (using the site's term `energy`). Site `/api/bot/upload`: added `energy?` field to `BotUploadMetadata`; calls `trackVersionRepository.update(version.id, { energy })` after upload.

# Pipeline Verification Results (2026-08-04)

Full end-to-end audit completed. No code bugs found. Summary:

| Stage | Status | Notes |
|-------|--------|-------|
| Audio receive → download → metadata → AI → preview | ✅ | Existing, verified |
| `pendingStore` holds state for Publish callback | ✅ | Correct |
| `publishTrack()` sends multipart POST to site | ✅ | Correct |
| `POST /api/bot/upload` on site | ✅ Committed | `a4b4db5` in forzadjbeta |
| Track + Version + Asset created in DB | ✅ | Code correct |
| File uploaded to `audio` Storage bucket | ✅ | Code correct |
| `asset.process` job enqueued | ✅ | Code correct |
| Preview + waveform generated by `asset.process` | ✅ | ffmpeg required |
| Track appears in Studio at `/studio/tracks/<id>` | ✅ | Correct URL returned |

**Fields transmitted to API:**
- `fileName` → `Asset.originalName` ✅
- `artist` → `TrackArtist` (upsert) ✅
- `title` → `Track.title` ✅
- `year` → `Track.year` ✅
- `genre` → `TrackGenre` (upsert) ✅
- `mood` → `Track.mood` (enum) ✅
- `version` → `TrackVersion.type` (enum) ✅
- `duration` — NOT transmitted; extracted by `asset.process` → `TrackVersion.durationSeconds` ✅
- `album`, `rating`, `bitrate`, `codec` — no DB schema fields; correctly omitted ✅

**Architectural decision confirmed:** `POST /api/bot/upload` is the right pattern. Studio upload flow uses Server Actions + presigned Supabase URLs (browser-only); cannot be reused by external Node.js process.

**Typo in `.env`:** `TOKENROUTER_MODEL=moonshotai/kimi-k3-freeё` — trailing Cyrillic `ё`. Fix manually: `TOKENROUTER_MODEL=moonshotai/kimi-k3-free`. AI fails gracefully; does not block publish.

# First Real Publication Test Results (2026-08-04)

**Env vars configured:** `FORZADJ_API_URL=http://localhost:3000`, `FORZADJ_BOT_SECRET` (bot) and `BOT_UPLOAD_SECRET` (site) set to shared 48-char hex secret. `TOKENROUTER_MODEL` typo fixed.

**Backend pipeline — all stages PASS:**

| Stage | Result |
|-------|--------|
| `POST /api/bot/upload` | ✅ HTTP 200 in 24s |
| Track in DB | ✅ title, artist, year, mood, genre, version all correct |
| Audio in Storage (`audio` bucket) | ✅ original.mp3 6.9 MB |
| Preview (`previews` bucket) | ✅ preview.mp3 2.7 MB (ffmpeg ran) |
| Waveform (`previews` bucket) | ✅ peaks.json 23 KB |
| `asset.process` inline job | ✅ ORIGINAL / PREVIEW / WAVEFORM all READY |
| `audio.analyze` inline job | ✅ BPM=128, Camelot=4A |
| Studio page | ✅ GET 200 — track visible at `/studio/tracks/<id>` |

**Tested track:** `Demo Track 1.mp3` (Pioneer DJ, House, 2025, 172s)

**Telegram flow:** Bot is running (`pnpm dev`). Requires user to send MP3 via Telegram client and press ✅ Publish. The full Telegram→Bot→API path is code-correct; only manual UI step remains.

# Next Planned Step

1. Send MP3 via Telegram → verify AI responds in <10 seconds with Groq.
2. Press Publish → verify Energy 1–5 autofilled in Studio.
3. Implement branded ForzaDJ artwork per genre (Этап B).
4. Implement auto-publish to catalog without manual Studio step (Этап C).

# Future Roadmap

1. End-to-end test with real credentials (FORZADJ_BOT_SECRET / BOT_UPLOAD_SECRET).
2. Resolve Kimi API 403 or migrate to DeepSeek V3 / Qwen2.5.
3. After publication: auto-open Studio edit page link in the reply.
4. Delete the local temp file after successful publication (optional cleanup).
3. Additional AI providers (openai, gemini, ollama) behind the same `AI_PROVIDER` switch.
4. Upload flow to the ForzaDJ website API.
5. Database for track records.
6. Queue for processing.

# Rules

- Work in very small steps — one concern per step.
- One feature per commit.
- Production-ready code only — no placeholders beyond explicitly planned stubs.
- Update HANDOFF.md after every completed step, BEFORE the Git commit.
- Never expose secrets; never commit `.env`.
- Do not modify unrelated code; do not change project structure without instruction.
- Preserve the module architecture (index → handlers → services).
- Do not break existing functionality; build must pass and the bot must start after every step.
- No git push — everything stays local until explicitly told otherwise.
- Keep changes minimal; verify (build + bot start) before committing.
