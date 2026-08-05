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
- `AI_PROVIDER` — `groq` (active) | `kimi` (slow, legacy) | `mock`
- `GROQ_API_KEY` — Groq API key
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
- ffmpeg re-encodes audio with branded cover: `-c:a copy -c:v mjpeg -disposition:v attached_pic`

# Git History (this session — bot repo)

All commits are local, not pushed to GitHub.

| Commit | Message |
|--------|---------|
| `5e00f36` | Map AI energy to Studio |
| `8cXXXXX` | Fix AI speed: switch to Groq |
| `438e179` | Add branded artwork per genre |
| `bd52402` | Improve AI classification prompt |
| `1f1652e` | Parse artist and title from filename when ID3 tags are empty |
| `418ba92` | Fix artist extraction when ID3 has title but no artist tag |
| `772e7c8` | Add inline track editor and fix artist from Telegram audio metadata |

Site repo (`forzadjbeta`) commits:
| Commit | Message |
|--------|---------|
| `2874c5c` | Auto-publish bot-uploaded tracks to catalog |
| `ec3bca4` | Embed branded artwork into audio file at upload time |

# Current State (2026-08-05)

Everything is working end-to-end:
- Track uploads via bot → appears immediately in catalog (auto-published)
- Branded artwork shows on site (WebP served via `/api/artwork/[versionId]`)
- Downloaded MP3 contains branded artwork in ID3 tags
- Artist extracted from filename when ID3 tags are missing
- Inline editor allows correcting artist/title before publishing

# Next Steps / Future Roadmap

1. **Deploy to production** — when ready: push forzadjbeta to GitHub → CI deploys; update bot `.env` `FORZADJ_API_URL=https://forzadj.ru`
2. **Delete temp files** after successful publication
3. **Additional editable fields** — genre, mood, version correction before publish (if needed)
4. **Batch upload** — multiple tracks in one session

# Rules

- Work in very small steps — one concern per step.
- One feature per commit.
- Production-ready code only — no placeholders.
- Update HANDOFF.md after every completed step, BEFORE the Git commit.
- Never expose secrets; never commit `.env`.
- Do not modify unrelated code.
- No git push — everything stays local until explicitly told otherwise.
