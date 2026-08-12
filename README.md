<div align="center">

# ForzaDJ Admin Bot

**The AI-powered ingestion engine for ForzaDJ**

[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)]()
[![grammY](https://img.shields.io/badge/grammY-007ACC?style=flat-square&logo=telegram&logoColor=white)]()

</div>

---

## Overview

This is the companion admin bot for **[ForzaDJ](https://github.com/hamidkazimov777-cmd/forzadj)** — a full-stack platform for DJs. 

Instead of manually uploading tracks through a heavy web dashboard, administrators can simply send MP3 files to this Telegram bot. 

### How it works:
1. **Ingestion**: Admin sends an MP3.
2. **AI Classification**: The bot extracts ID3 tags and uses AI to classify the track's genre and mood.
3. **Publishing**: It selects branded artwork and pushes the payload directly to the Next.js API via a secret-authenticated webhook (`POST /api/bot/upload`).
4. **Live**: The track is instantly available on `forzadj.ru` with full audio processing (waveform & preview) kicked off asynchronously.

This decoupled architecture allows the main Next.js platform to remain secure and lightweight, while the ingestion complexity is pushed to this Node.js bot.

---
**Built by Hamid Kazimov** — Product Builder & Software Creator.  
[Contact on Telegram](https://t.me/hamidkazim)
