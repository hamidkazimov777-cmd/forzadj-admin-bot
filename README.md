<div align="center">

# ForzaDJ Admin Bot

**Telegram bot that turns "send an MP3" into a fully published catalog entry — in one message**

🌐 **Live site:** [forzadj.ru](https://forzadj.ru)

[![Website](https://img.shields.io/badge/Live-forzadj.ru-6E56CF?style=flat-square&logo=googlechrome&logoColor=white)](https://forzadj.ru)
[![grammY](https://img.shields.io/badge/grammY-1.30-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://grammy.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Groq](https://img.shields.io/badge/AI-Groq%20Llama%203.3%2070B-F55036?style=flat-square)](https://groq.com)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[**Main Platform →**](https://github.com/hamidkazimov777-cmd/forzadj) · [Live Site →](https://forzadj.ru)

</div>

---

## Overview

**ForzaDJ Admin Bot** is a standalone Telegram bot that lets a site administrator publish a track to the [ForzaDJ](https://github.com/hamidkazimov777-cmd/forzadj) DJ-pool catalog by simply sending an audio file in a chat — no dashboard, no manual metadata entry.

The bot downloads the file, extracts whatever metadata it can find, asks an LLM to classify the track (genre / mood / version type / energy rating), picks a genre-matched branded cover, and shows an inline preview with **Publish / Edit / Cancel** — the admin can correct the artist or title on the spot before it goes live. On publish, it calls a secret-authenticated HTTP endpoint on the main platform, which processes the audio (preview clip, waveform, ID3 retagging, artwork embedding) and puts the track in the public catalog immediately.

**Why this exists:** the main platform already has a full Studio UI for uploading and editing tracks — but for a solo admin publishing dozens of tracks a day, "open the site, log in, upload, fill in 6 fields, save" is friction that a Telegram bot removes entirely.

---

## How it works

```
 Admin sends MP3/audio in Telegram
            │
            ▼
 ┌─────────────────────────────────────────────┐
 │  1. Download from Telegram → local temp file │
 │  2. Extract metadata:                        │
 │       ID3 tags → filename parse → TG fields  │
 │       (three-level fallback chain)           │
 │  3. AI classification (~1–3s):               │
 │       genre · mood · version · energy rating │
 │  4. Pick branded cover PNG matching genre     │
 │  5. Show inline preview:                      │
 │       ✅ Publish  ✏️ Edit  ❌ Cancel           │
 └───────────────────┬───────────────────────────┘
                      │ (optional) inline-edit artist/title
                      │ before publishing — repeatable
                      ▼
 ┌─────────────────────────────────────────────┐
 │  POST /api/bot/upload  (main platform)        │
 │  — multipart: audio + branded cover + JSON —  │
 │  auth: shared-secret header, not a user token │
 └───────────────────┬───────────────────────────┘
                      ▼
     Track is live in the public catalog,
     original download file carries the correct
     ID3 tags and branded cover art embedded.
```

The two services are fully independent — the bot never touches the database directly, and the platform never talks to Telegram. They agree on one contract: a multipart HTTP request behind a shared secret.

---

## Key engineering decisions

This project's interesting parts aren't the happy path — they're the failure modes found and fixed by testing against the real production endpoint rather than assuming:

- **Pluggable AI provider layer** — one `AIProvider` interface, seven interchangeable backends (Groq, OpenRouter, Gemini, Cloudflare Workers AI, Together AI, a legacy router, and a `mock` provider for local dev without API keys). Switching providers is a single environment variable; no code changes, no redeploy of business logic.
- **Three-level metadata fallback** — real-world uploads rarely have clean tags. The bot tries ID3 tags first, falls back to parsing `"Artist - Title.ext"` out of the filename, and finally falls back to Telegram's own `performer`/`title` fields — so a track with zero metadata still gets classified correctly.
- **Connection-reuse bug, found by live testing, not guessing** — publishes intermittently failed with "Unexpected end of JSON input" on the *first* attempt after an edit, then silently succeeded on retry. Ruled out slow-response truncation and encoding issues by direct production testing (timed real 27–88s ffmpeg-bound responses) before concluding it was a stale pooled keep-alive connection between hosts. Fixed by forcing `undici` with `keepAliveTimeout: 1` instead of Node's global fetch — a fresh connection per publish, ~200ms cost, zero flakiness since.
- **A single bad Telegram update no longer takes down the whole bot** — grammY's default behavior is to stop polling and rethrow on any unhandled error from *any* single update. A global `bot.catch()` was added so one edge case (a "message not modified" 400 from a double-tap, an oversized file) logs and notifies the user instead of crashing the process for every other chat.
- **Failed publish no longer loses the pending track** — the in-memory pending state used to be cleared *before* calling the platform API; a network blip on the platform side meant the admin's uploaded track was already gone by the time they saw the error. Now it only clears on confirmed success, so a failed publish can simply be retried.
- **ID3 tags actually match what's on the catalog page** — the platform's ffmpeg re-encode step used to copy over the *original* (unclean) title from the source MP3 even though the AI-cleaned title was shown on-site. Fixed by explicitly passing `-metadata title=… -metadata artist=…` on every re-encode, not just when a branded cover is attached.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Bot framework | [grammY](https://grammy.dev) (long-polling) |
| Language | TypeScript 5, strict mode |
| Runtime | Node.js 20+ |
| Audio metadata | `music-metadata` (ID3 parsing) |
| HTTP client | `undici` (explicit connection control — see above) |
| AI classification | Groq (`llama-3.3-70b-versatile`) — primary; OpenRouter, Gemini, Cloudflare Workers AI, Together AI as swappable alternates |
| State | In-memory `Map` per chat (single-process; see limitations) |
| Deploy | Railway (Nixpacks, pnpm) |

---

## Project structure

```
src/
├── index.ts                    # Entry point: bot init, handlers, global error catch
├── bot/
│   └── auth.ts                 # Private-chat + allowlisted-ID middleware
├── config/
│   ├── ai.ts                   # AI_PROVIDER env resolution
│   └── auth.ts                 # ALLOWED_TELEGRAM_IDS parsing
├── handlers/
│   ├── audio.ts                # Download → metadata → AI → preview
│   ├── callbacks.ts            # Publish / Edit / Cancel button logic
│   └── preview.ts              # Inline keyboard + preview text builders
├── services/
│   ├── telegram-download.ts    # Fetches file from Telegram API
│   ├── audio-metadata.ts       # ID3 → filename → AIInput fallback chain
│   ├── pending.ts              # In-memory per-chat pending-publication store
│   ├── forzadj-api.ts          # publishTrack(): multipart POST to the platform
│   ├── artwork.ts               # Genre → branded PNG cover lookup
│   └── ai/
│       ├── provider.ts         # analyzeTrack(): dispatches by AI_PROVIDER
│       └── providers/          # groq · openrouter · gemini · cloudflare · together · kimi
└── assets/artwork/              # 13 branded genre covers (PNG)
```

---

## Environment variables

```bash
BOT_TOKEN=                    # Telegram bot token from @BotFather
AI_PROVIDER=groq              # groq | openrouter | gemini | cloudflare | together | mock
GROQ_API_KEY=                 # required if AI_PROVIDER=groq
ALLOWED_TELEGRAM_IDS=         # comma-separated numeric Telegram IDs allowed to use the bot
FORZADJ_API_URL=              # https://forzadj.ru (or http://localhost:3000 for local dev)
FORZADJ_BOT_SECRET=           # shared secret, must match BOT_UPLOAD_SECRET on the platform
```

> Only the API key for the selected `AI_PROVIDER` is required — see `.env.example` for the full list of provider-specific keys.

---

## Running locally

```bash
git clone https://github.com/hamidkazimov777-cmd/forzadj-admin-bot.git
cd forzadj-admin-bot
pnpm install

cp .env.example .env
# fill in BOT_TOKEN, AI_PROVIDER + its key, ALLOWED_TELEGRAM_IDS, FORZADJ_API_URL, FORZADJ_BOT_SECRET

pnpm dev
```

The bot uses long-polling — no public URL or webhook setup needed for local development.

```bash
pnpm build   # compile TypeScript → dist/
pnpm start   # run compiled output
```

---

## Deployment

Deployed on [Railway](https://railway.app) — `railway.json` defines the build (`pnpm install && pnpm run build`) and start (`pnpm start`) commands, with automatic restart on failure.

Long-polling means the bot needs no inbound networking configuration — it only makes outbound requests to the Telegram API and to the platform's upload endpoint.

---

## Known limitations

- **Pending state is in-memory only** — a redeploy or crash clears any track that was uploaded but not yet published, for every chat. The bot degrades gracefully (a clear "nothing pending" message) rather than crashing, but doesn't currently persist across restarts. A deliberate fix would move `pendingStore` to disk or a lightweight KV store.
- **Single admin flow, one track at a time** — no batch upload yet; each track goes through its own preview → publish cycle.

---

## Related

**[ForzaDJ](https://github.com/hamidkazimov777-cmd/forzadj)** — the main platform. Next.js 15 + Prisma + PostgreSQL DJ-pool catalog with Telegram authentication, audio analysis (BPM/Key via Essentia.js), and a Studio content-management zone. This bot is one of two ways tracks get published — the other is the Studio UI directly on the site.

---

## Author

**Hamid Kazimov**

[![Telegram](https://img.shields.io/badge/Telegram-@hamidkazim-2CA5E0?style=flat-square&logo=telegram&logoColor=white)](https://t.me/hamidkazim)
[![GitHub](https://img.shields.io/badge/GitHub-hamidkazimov777--cmd-181717?style=flat-square&logo=github)](https://github.com/hamidkazimov777-cmd)

---

## License

MIT © 2026 Hamid Kazimov
