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
├── index.ts                          # Entry point: token check, bot creation, middleware + handler registration, polling start
├── bot/
│   └── auth.ts                       # authMiddleware: private chats only + ID allowlist, replies "⛔ Access denied." otherwise
├── config/
│   ├── ai.ts                         # getAIProvider(): reads/validates AI_PROVIDER ("mock" | "kimi")
│   └── auth.ts                       # isAllowedTelegramUser(): parses/validates ALLOWED_TELEGRAM_IDS at startup
├── handlers/
│   └── audio.ts                      # createAudioHandler(token): file-type validation, orchestrates download → metadata, sends reply
├── services/
│   ├── telegram-download.ts          # Downloads file from Telegram, saves to temp/YYYY-MM-DD/, collision → _HHMMSS suffix
│   ├── audio-metadata.ts             # extractAudioMetadata(): music-metadata parse → formatted "📋 Metadata" block
│   └── ai/
│       ├── types.ts                  # AIInput / AIOutput interfaces
│       ├── provider.ts               # analyzeTrack(): dispatches to mock or kimi based on AI_PROVIDER
│       └── providers/
│           └── kimi.ts               # analyzeWithKimi(): TokenRouter (OpenAI-compatible) fetch, test prompt, JSON → AIOutput
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

Never include real secret values anywhere in the repository.

# Current AI Flow

1. `analyzeTrack(input: AIInput)` in `src/services/ai/provider.ts` is the single entry point.
2. It reads `AI_PROVIDER` via `getAIProvider()` (`src/config/ai.ts`); unsupported values throw a clear error.
3. `mock` → returns fixed values `{ genre: "House", mood: "Primetime", version: "Extended", rating: 5 }` without any network call.
4. `kimi` → `analyzeWithKimi()` (`src/services/ai/providers/kimi.ts`) sends an OpenAI-compatible `POST {TOKENROUTER_BASE_URL}/chat/completions` request with a test prompt asking for the exact JSON format; the JSON object is extracted from the reply text and validated/normalized into `AIOutput`; HTTP errors and empty/invalid responses throw.
5. The bot calls `analyzeTrack({})` from `src/handlers/audio.ts` after metadata extraction. `scripts/test-kimi.ts` is a standalone test.
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
   - Calls `analyzeTrack({})` using the configured AI provider; on error appends `⚠️ AI analysis failed.` instead.
   - Replies with: `✅ Audio saved` + file name + path + size + `📋 Metadata` block + `🤖 AI Analysis` block.
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
9. *(current)* **Integrate AI into Telegram workflow** — `analyzeTrack({})` called from `audio.ts` after metadata extraction; `🤖 AI Analysis` block appended to reply; errors degrade gracefully to `⚠️ AI analysis failed.`

# Next Planned Step

Refine the AI prompt to pass real extracted metadata (artist, title, duration, bitrate, etc.) as context into `analyzeTrack()`.

# Future Roadmap

1. Refine the AI prompt to use real extracted metadata as context.
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
