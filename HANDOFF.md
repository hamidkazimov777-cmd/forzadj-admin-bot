# HANDOFF.md

Single source of truth for the current project state.
Any AI starting a new session must read this file FIRST instead of analyzing the entire repository.
This file must be updated after every completed development step, BEFORE creating the Git commit.

# Project Overview

- **Project name:** ForzaDJ Admin Bot
- **Purpose:** Telegram admin bot that receives audio files, analyzes with AI (genre/mood/version/rating), selects branded artwork, and publishes tracks directly to the ForzaDJ catalog — no manual Studio step needed.
- **Current development stage:** Fully operational. Tracks published via bot appear immediately in the public catalog with correct artist, title, genre cover art (both on site and embedded in the downloadable MP3), and energy rating. Inline editor allows correcting artist/title before publishing.

# Architecture

```
src/
├── index.ts                          # Entry point: bot creation, auth middleware, audio/document/text/callback handlers
├── bot/
│   └── auth.ts                       # authMiddleware: private chats only + ID allowlist
├── config/
│   ├── ai.ts                         # getAIProvider(): reads AI_PROVIDER env var
│   └── auth.ts                       # isAllowedTelegramUser(): parses ALLOWED_TELEGRAM_IDS
├── handlers/
│   ├── audio.ts                      # createAudioHandler(): download → metadata → AI → preview; uses Telegram performer/title fields as fallback
│   ├── callbacks.ts                  # publish / edit / edit_artist / edit_title / edit_back / cancel
│   └── preview.ts                    # buildPreviewText(), buildPreviewKeyboard(), buildEditKeyboard()
├── services/
│   ├── telegram-download.ts          # Downloads from Telegram, saves to temp/YYYY-MM-DD/
│   ├── audio-metadata.ts             # extractAudioMetadata(): ID3 parse → filename fallback → AIInput
│   ├── pending.ts                    # pendingStore: Map<chatId, PendingPublication> incl. waitingFor field
│   ├── forzadj-api.ts                # publishTrack(): multipart POST to /api/bot/upload
│   ├── artwork.ts                    # getArtworkPath(genre): genre → assets/artwork/*.png
│   └── ai/
│       ├── types.ts                  # AIInput / AIOutput
│       ├── provider.ts               # analyzeTrack(): dispatches by AI_PROVIDER
│       └── providers/
│           ├── groq.ts               # analyzeWithGroq(): Groq llama-3.3-70b-versatile, 1–3s, 30s timeout
│           ├── kimi.ts               # analyzeWithKimi(): TokenRouter (legacy, slow)
│           └── prompt.ts             # buildPrompt(input): shared prompt for all providers

assets/artwork/                       # 13 branded PNG covers (one per genre):
  afro-house.png, baile-funk.png, bass-house.png, breaks.png, edm.png,
  garage.png, hip-hop.png, house.png, jersey-club.png, open-format.png,
  pop.png, rus.png, tech-house.png
```

**Site repo** (`forzadjbeta`): `src/app/api/bot/upload/route.ts` — the endpoint that receives bot uploads.

# Complete Publication Pipeline

```
Telegram MP3 → bot downloads locally
              → ID3 parse → filename "Artist - Title.ext" fallback → Telegram performer/title fallback
              → Groq AI: genre + mood + version + rating (1–3s)
              → branded PNG artwork selected by genre
              → preview shown in Telegram with ✅ Publish | ✏️ Edit | ❌ Cancel
              → (optional) inline edit: Artist or Title corrected before publish

On Publish:
  bot → POST /api/bot/upload (multipart: audio file + artwork PNG + JSON metadata)
  site:
    1. createDraft (title, versionType)
    2. Upload audio to Supabase `audio` bucket
    3. Create ORIGINAL asset
    4. setArtists (upsert by name)
    5. setGenres (upsert by name)
    6. Update year / mood / energy
    7. Record revision
    8. Auto-publish: track + version → PUBLISHED (appears in catalog immediately)
    9. asset.process (sync): generates preview MP3 + waveform, extracts embedded cover
   10. Upload branded artwork → ARTWORK asset → setStatus(READY)
       → artwork.optimize generates WebP variants (1200/600/300/120px)
   11. ffmpeg re-encodes original MP3 with branded cover in ID3 tags
       (so downloaded file also contains the branded artwork)
```

# Artist/Title Extraction — Priority Order

`audio-metadata.ts` builds `AIInput` with three levels of fallback:

1. **ID3 tags** (`common.artist`, `common.title`) — highest priority, used if present
2. **Filename parsing** — if artist is missing from ID3, split `"Artist - Title.ext"` on first `" - "` to get artist (and title if also missing)
3. **Telegram fields** (`file.performer`, `file.title`) — lowest priority, used in `audio.ts` when both ID3 and filename parsing fail

# Inline Editing Flow

After AI preview, user sees:
```
📀 Track
Artist: <name>
Title:  <name>
🤖 AI Analysis ...

[✅ Publish]  [✏️ Edit]
[❌ Cancel]
```
Clicking **✏️ Edit** → shows:
```
[👤 Artist]  [🎵 Title]
[« Back]
```
Clicking **Artist** or **Title** → bot asks for new value → user sends text → `pending.waitingFor` consumed → preview refreshed. Repeatable before publishing.

# Environment Variables

- `BOT_TOKEN` — Telegram Bot API token
- `AI_PROVIDER` — `groq` | `openrouter` | `gemini` | `cloudflare` | `together` | `kimi` (legacy) | `mock`. Current active provider: **`gemini`** (`gemini-2.5-flash`). Set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in the deploy platform's env vars.
- `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `CLOUDFLARE_*` / `TOGETHER_API_KEY` — per-provider keys, only the active one is required
- `TOKENROUTER_API_KEY` / `TOKENROUTER_BASE_URL` / `TOKENROUTER_MODEL` — legacy Kimi
- `ALLOWED_TELEGRAM_IDS` — comma-separated whitelisted Telegram user IDs
- `FORZADJ_API_URL` — site base URL (`http://localhost:3000` locally, `https://forzadj.ru` prod)
- `FORZADJ_BOT_SECRET` — shared secret matching `BOT_UPLOAD_SECRET` on site

# Site Route: `/api/bot/upload` (forzadjbeta)

Key facts:
- Auth: `X-Bot-Secret` header must match `BOT_UPLOAD_SECRET` env var
- Body limit: `experimental.middlewareClientMaxBodySize: 150 * 1024 * 1024` in `next.config.ts`
- `asset.process` runs synchronously (inline queue) — must complete before branded artwork upload, because `asset.process` calls `softDeleteByVersionAndType("ARTWORK")` internally
- Branded ARTWORK asset must have `setStatus(id, "READY")` called so `findReadyByVersionAndType` finds it
- ffmpeg re-encode (`embedArtworkIntoAudio`) always runs now, even without artwork, and always sets `-metadata title=… -metadata artist=…` from the (already-cleaned) `meta.title`/`meta.artist` — otherwise ffmpeg copies the original file's raw ID3 tags by default, so the downloaded MP3 kept the un-cleaned title even though the DB/catalog showed the clean one

# Git History

| Commit | Message |
|--------|---------|
| `<next>` | Improve AI classification: BPM context, rewrite prompt for better genre/mood/version/rating |
| `a9c28e1` | Switch Gemini provider to gemini-2.5-flash |
| `ce0f23d` | Force fresh connections for site publish requests to fix intermittent JSON parse crash |
| `38b6ab0` | Fix premature pendingStore clear, add global error handler, plug temp-file leaks |
| `dce8970` | Clean DJ service tags from titles, strip extra metadata on upload |

Site repo (`forzadjbeta`) recent relevant commits:
| Commit | Message |
|--------|---------|
| `cac69f8` | Fix silent failures in Telegram bot login flow |
| `54220f9` | Always rewrite title/artist ID3 tags when re-encoding bot uploads |
| `ec3bca4` | Embed branded artwork into audio file at upload time |
| `2874c5c` | Auto-publish bot-uploaded tracks to catalog |

# Current State (2026-08-05)

Everything is working end-to-end:
- Track uploads via bot → appears immediately in catalog (auto-published)
- Branded artwork shows on site (WebP served via `/api/artwork/[versionId]`)
- Downloaded MP3 contains branded artwork AND correctly-cleaned title/artist ID3 tags
- Artist extracted from filename when ID3 tags are missing
- Inline editor allows correcting artist/title/genre/mood/version before publishing
- A failed Publish attempt (network error, site timeout) no longer loses the pending track — data is preserved for retry
- A single unhandled error in any handler no longer crashes the whole bot process (`bot.catch` in `index.ts`)

## Full audit fixes (2026-08-05)

Root-caused and fixed the intermittent "Nothing to publish. Send an audio file first." report:
- **Root cause**: `onPublish` (`src/handlers/callbacks.ts`) cleared `pendingStore` *before* calling `publishTrack()`. If the site call failed (network blip, timeout, 5xx), the pending track was already gone — retrying Publish then legitimately found nothing. Fixed by only clearing on confirmed success; failures now reply with the error and a fresh Publish/Edit/Cancel keyboard so the user can retry without re-uploading.
- **Contributing risk (fixed)**: no `bot.catch()` was registered, so grammy's default handler stopped polling and rethrew on *any* unhandled error from *any* single update (e.g. a Telegram "message is not modified" 400 from double-clicking Cancel, or a >20MB file failing `getFile`), crashing the whole process and wiping `pendingStore` for every chat. Added a global `bot.catch()` that logs and notifies the user without killing the process.
- **Temp file leaks (fixed)**: Cancel never deleted `pending.filePath`; sending a new track while a previous one was still pending (unpublished/uncancelled) silently orphaned its temp file too. Both paths now clean up.
- **ID3 tags not cleaned in downloaded MP3 (fixed, site repo)**: `embedArtworkIntoAudio` in `forzadjbeta/src/app/api/bot/upload/route.ts` re-encoded with `-c:a copy`, which by default carries over the *original* (dirty) title/artist ID3 tags — the catalog showed the cleaned title (from `meta.title`) but the downloadable file still had "(Musvisor Intro)" etc. embedded. Fixed by always passing explicit `-metadata title=… -metadata artist=…` and running the retag step unconditionally, not just when branded artwork is present.
- Verified extensively and found already-correct (no change needed): sequential multi-click safety (grammy processes updates one at a time, so rapid button taps can't race), callback_data never goes stale (pendingStore is keyed by chatId, not message id, so old preview messages' buttons always act on current state), waitingFor state transitions, all edit/back/mood/version callbacks.
- **Known architectural limitation (not fixed, out of scope)**: `pendingStore` is a pure in-memory `Map` — any process restart/redeploy wipes all pending state for all chats by design. Bot now degrades gracefully (clear "nothing pending" message) rather than crashing, but persisting pending state across restarts would need a deliberate architecture change (e.g. writing to disk/DB), not attempted here.

## Follow-up audit fixes (2026-08-05, round 2)

Real testing after round 1 found the JSON-parse crash still occurred on the *first* Publish after Edit (second attempt always succeeded). Investigated with live production probes (see below) rather than guessing:

- **"Unexpected end of JSON input" on first Publish after Edit**: `res.json()` in `publishTrack()` (`src/services/forzadj-api.ts`) requires the site to have returned a genuinely empty HTTP body. Ruled out via direct production testing: a slow `/api/bot/upload` response (measured 27–88s for realistic-length tracks — it runs several full-duration ffmpeg passes synchronously) does NOT by itself produce a truncated response even at 88s; Cyrillic metadata doesn't either. The remaining, unfalsifiable-from-a-laptop explanation is a stale pooled keep-alive connection: publishes are naturally spaced out (AI analysis, then the admin typing an Edit), long enough for some hop between the bot's *own* network path (Railway) and forzadj.ru to silently recycle an idle connection that Node's fetch client still considers reusable — reusing it then yields exactly this "successfully connected, empty body" signature, and the *next* attempt succeeds because it opens a fresh connection. **Fix**: `publishTrack()` now uses `undici`'s own `fetch`/`Agent` (not Node's global fetch, which is backed by a *different*, version-incompatible internal undici) with `keepAliveTimeout: 1`, forcing a brand-new connection on every publish. Publishes are infrequent enough that the extra TCP/TLS handshake (~100–300ms) is negligible. Added `undici` as an explicit dependency (`package-lock.json` also added — the repo had none, npm was resolving without one).
- **ID3 tags still dirty in downloaded MP3, re-verified**: re-tested the exact round-1 fix (`embedArtworkIntoAudio` in `forzadjbeta`) end-to-end in production with a source file carrying a real `(Musvisor Intro)`-style embedded ID3 title, run through the actual `extractAudioMetadata()` → `publishTrack()` code path, then fetched the resulting stored file directly from Supabase and inspected its tags with `ffprobe`: title came back clean. **The round-1 fix is confirmed correct and live** — no further code change was needed or made in `forzadjbeta` this round. Most likely explanation for the user still seeing the old tag: either the site process hadn't picked up the round-1 deploy yet at test time, or the downloaded file was from a track published *before* that fix went live (retagging only happens at publish time, not retroactively for already-published tracks).
- All verification was done against the real `https://forzadj.ru` production endpoint (same one the deployed bot calls) using disposable `ZZZ_AUDIT_TEST`-titled tracks, soft-deleted afterward via `contentService.deleteTrack()`.

# Next Steps / Future Roadmap

1. ✅ **Deploy to production** — forzadjbeta запушен, бот переключён на `https://forzadj.ru`, `BOT_UPLOAD_SECRET` добавлен на VPS
2. ✅ **Delete temp files** after successful publication, cancellation, and when superseded by a new upload
3. **Additional editable fields** — genre, mood, version correction before publish (already implemented — done)
4. **Batch upload** — multiple tracks in one session
5. **Persist pendingStore across restarts** — currently pure in-memory; a redeploy loses in-flight (unpublished) tracks for all chats

# Rules

- Work in very small steps — one concern per step.
- One feature per commit.
- Production-ready code only — no placeholders.
- Update HANDOFF.md after every completed step, BEFORE the Git commit.
- Never expose secrets; never commit `.env`.
- Do not modify unrelated code.
- No git push — everything stays local until explicitly told otherwise.
