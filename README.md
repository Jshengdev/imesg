# Nudge

AI assistant that lives in iMessage. Text it anything — it responds with voice notes powered by MiniMax M2.7 + Speech 2.8 TTS.

Connects to your Gmail and Google Calendar via Composio to give you context-aware responses about your schedule, emails, and tasks.

## Setup

```bash
cp .env.example .env   # fill in API keys
bun install
npx tsx src/index.ts
```

Requires macOS with Full Disk Access for iMessage.

## Stack

- **LLM**: MiniMax M2.7 (reasoning + JSON extraction)
- **Voice**: MiniMax Speech 2.8 TTS
- **Vision**: MiniMax M2.7 multimodal
- **Calendar/Email**: Composio (Google Calendar + Gmail, per-user OAuth)
- **iMessage**: Photon iMessage Kit
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Next.js + Tailwind

Built with TRAE AI for the Build with TRAE x MiniMax Hackathon at USC.
