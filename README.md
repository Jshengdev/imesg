# Nudge — iMessage AI Assistant

Nudge is an AI assistant that lives in your iMessage. It connects to your Gmail and Google Calendar via OAuth, watches your inbox and schedule in the background, and texts you like a person who actually pays attention — not a chatbot reading from a dashboard. It synthesizes signals across email, calendar, and tasks into single-line observations, blocks time on your calendar, drafts and sends emails, and proactively messages you when something is worth interrupting for.

---

## How It Works

Nudge runs as two cooperating processes across two Macs:

```
  Mac A (Agent Mac — runs Nudge)            Mac B (Listener Mac — Teri's machine)
  ┌─────────────────────────────┐           ┌──────────────────────────────┐
  │                             │           │                              │
  │  Messages.app (Nudge line)  │           │  Messages.app (Teri's chats) │
  │         │                   │           │         │                    │
  │  Photon iMessage SDK        │           │  Photon iMessage SDK         │
  │  (read + send)              │           │  (read-only, poll 2s)        │
  │         │                   │           │         │                    │
  │  src/index.ts               │           │  listener/index.ts           │
  │  ┌──────▼──────────────┐    │    HTTP   │         │                    │
  │  │ Agent (handler.ts)  │◄───┼───────────┼─── POST /api/messages        │
  │  │ - onboarding        │    │  Bearer   │  (batched, 3s window)        │
  │  │ - tool calls        │    │  token    └──────────────────────────────┘
  │  │ - personality       │    │
  │  └──────┬──────────────┘    │
  │         │                   │
  │  ┌──────▼──────────────┐    │
  │  │ Background engines  │    │
  │  │ - proactive/        │    │
  │  │ - crossref loop     │    │
  │  │ - extraction loop   │    │
  │  └──────┬──────────────┘    │
  │         │                   │
  │  ┌──────▼──────────────┐    │
  │  │ Integrations        │    │
  │  │ - Gmail (Composio)  │    │
  │  │ - Calendar (Composio│    │
  │  └─────────────────────┘    │
  │                             │
  │  SQLite (memory/db.ts)      │
  └─────────────────────────────┘
```

**Message flow (direct message to Nudge):**
1. User texts Nudge's number on Agent Mac
2. Photon SDK picks up the message, `router.ts` decides whether to handle it
3. Message is stored in SQLite, then passed to `handler.ts`
4. Handler routes to onboarding, demo commands, or the main LLM pipeline
5. Main pipeline: classify intent → assemble context → call MiniMax with tools → validate response → send back as iMessage bubbles

**Message flow (passive monitoring via listener):**
1. Listener Mac's Photon SDK polls Messages.app every 2 seconds
2. Incoming messages (excluding the Nudge chat) are batched for 3 seconds, then POSTed to Agent Mac's HTTP server
3. `server.ts` stores them in SQLite and runs the extraction loop
4. If new tasks are extracted, the proactive decision engine evaluates whether to interrupt the user

**Cross-source synthesis example:**
> Sarah Chen emails about the Q3 review AND is in your 2pm calendar invite. The proactive engine scores this as urgency 8 (cross-source match), checks your disruption score (not in a meeting, not quiet hours), and texts: "sarah chen just emailed — same one from your 2pm"

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM + Vision | MiniMax M2.7 (chat completions + multimodal) |
| OAuth + Google APIs | Composio (per-user entity model, Gmail + Calendar) |
| iMessage | Photon iMessage Kit (`@photon-ai/imessage-kit`) |
| Database | SQLite via `better-sqlite3` |
| Runtime | Node.js / tsx |
| Language | TypeScript (ESM) |

---

## Features

- **Onboarding bouncer** — new numbers go through a vibe check before getting access; capped at 6 active users. After passing, users get Composio OAuth links for Gmail and Calendar, then Nudge scans their data and introduces itself with specific references to what it found.
- **Cross-source intelligence** — a background loop (`crossref.ts`) correlates email senders against calendar attendees and flags when the same person appears in multiple signals.
- **Task extraction + ranking** — an extraction loop (`listener/extractor.ts`) parses stored messages for action items using LLM JSON extraction. Tasks are ranked by a weighted score: `urgency × 3 + deadline_score × 2 + calendar_fit × 1.5 + dependency_clear × 1`.
- **Calendar blocking** — agent can find the next free block ≥ N minutes and create a Google Calendar event via Composio, or push to 9am tomorrow if today is packed.
- **Email drafting + sending** — agent drafts or sends email via Composio Gmail actions, with fallback across multiple action name variants.
- **Proactive messaging** — a background engine (`proactive/decision-engine.ts`) evaluates new signals against a disruption score (10 = quiet hours, 8 = in meeting, 7 = meeting in <15 min, 2 = free). Only sends if urgency > disruption. Rate-limited to `MAX_PROACTIVE_PER_HOUR` and deduplicated by MD5 hash over a 48-hour window.
- **Vision (photo analysis)** — MiniMax M2.7 multimodal; if a user sends an image, the attachment path is passed to `analyzeImage()` before the LLM call.
- **Virtual clock for demos** — `/time HH:MM` sets an in-process virtual clock that all time-sensitive logic reads from, letting you demo morning briefings or pre-meeting nudges at any hour.

---

## Getting Started

### Prerequisites

- Node.js 20+ (or Bun)
- macOS with Messages.app signed in (Full Disk Access required for Photon SDK)
- MiniMax API key — [platform.minimax.io](https://platform.minimax.io)
- Composio API key — [composio.dev](https://composio.dev)

### Clone + Install

```bash
git clone <repo-url>
cd imesg
npm install        # or: bun install
```

### Configure `.env`

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `MINIMAX_API_KEY` | Your MiniMax API key |
| `MINIMAX_API_HOST` | MiniMax API base URL (default: `https://api.minimax.io`) |
| `COMPOSIO_API_KEY` | Your Composio API key |
| `AGENT_CHAT_IDENTIFIER` | The iMessage chat ID or phone number Nudge listens on |
| `QUIET_HOURS_START` | Hour (24h) when proactive messages stop (default: `23`) |
| `QUIET_HOURS_END` | Hour (24h) when proactive messages resume (default: `7`) |
| `MAX_PROACTIVE_PER_HOUR` | Max unsolicited messages per hour per user (default: `3`) |
| `MORNING_BRIEFING_HOUR` | Hour for morning briefing trigger (default: `8`) |
| `EOD_REVIEW_HOUR` | Hour for end-of-day review trigger (default: `18`) |
| `PRE_MEETING_MINUTES` | How many minutes before a meeting counts as "soon" (default: `15`) |
| `LISTENER_PORT` | Port for the HTTP bridge server (default: `3456`) |
| `LISTENER_SECRET` | Shared secret for listener → agent auth (default: `nudge-demo-2026`) |

### Run

```bash
npm start
```

Nudge will start listening on the iMessage chat identifier you configured. Text the number to begin onboarding.

---

## Listener Setup

The listener runs on a second Mac (the user's personal machine) and forwards all incoming iMessages to the agent over HTTP. This is what enables Nudge to see messages the user receives from other people — not just messages sent directly to Nudge.

**What it does:** polls Messages.app every 2 seconds via the Photon SDK, batches new messages, and POSTs them to the agent's `/api/messages` endpoint. It skips outgoing messages and any chat IDs you tell it to ignore (e.g. the Nudge conversation itself).

### Set up `listener/.env`

```bash
cp listener/.env.example listener/.env
```

| Variable | Description |
|---|---|
| `AGENT_URL` | IP + port of the Agent Mac on the local network (e.g. `http://192.168.1.100:3456`) |
| `LISTENER_SECRET` | Must match `LISTENER_SECRET` in the agent's `.env` |
| `OWNER_PHONE` | The listener Mac owner's phone number — tells the agent whose messages these are |
| `IGNORE_CHAT_IDS` | Comma-separated chat IDs to skip (add Nudge's number here) |

### Run the listener

```bash
cd listener
npm install
npx tsx index.ts
```

---

## Demo Mode

Demo commands let you drive Nudge through a live demo without needing a fully configured user account.

| Command | What it does |
|---|---|
| `/demo` | Enables demo mode — skips OAuth checks, uses mock data for Calendar and Gmail |
| `/time HH:MM` | Sets the virtual clock to a specific time (e.g. `/time 8:00` triggers morning briefing logic), then fires the proactive decision engine |
| `/poll` | Manually triggers the proactive engine — checks all channels and sends a message if anything is worth it |
| `/priority` | Runs the task ranking algorithm against current calendar free blocks and returns a prioritized plan |
| `/important` | Housekeeping scan — compares open tasks against latest email and calendar, flags contradictions or new deadlines |

---

## Architecture

```
src/
├── index.ts              Boot sequence — wires iMessage, extraction, proactive, crossref, HTTP server
├── config.ts             Env var validation and typed config object
├── demo.ts               Virtual clock + demo mode flag (all time reads go through here)
├── server.ts             HTTP bridge — receives batched messages from the listener Mac
├── agent/
│   ├── handler.ts        Main message router: onboarding, demo commands, LLM pipeline
│   ├── personality.ts    System prompt, POST_HISTORY_ENFORCEMENT rules, response validator
│   ├── ranking.ts        Task scoring: urgency × deadline × calendar_fit × dependencies
│   ├── tools.ts          Tool definitions passed to MiniMax (calendar, email, task tools)
│   ├── context.ts        Context assembly for LLM calls
│   ├── crossref.ts       Background loop — correlates signals across email + calendar
│   └── proactive/
│       ├── decision-engine.ts  Urgency vs disruption gate — decides whether to interrupt
│       └── engine.ts           Sends proactive messages, logs them for dedup
├── imessage/
│   ├── sdk.ts            Photon iMessage Kit wrapper — startListening, sendText, sendBubbles
│   ├── router.ts         Decides which messages the agent should handle vs ignore
│   ├── bubble-split.ts   Splits long LLM responses into natural iMessage-sized bubbles
│   └── batcher.ts        Debounces rapid incoming messages into single responses
├── minimax/
│   ├── llm.ts            MiniMax chat completions — generate, generateJSON, generateWithTools
│   └── vision.ts         MiniMax multimodal — analyzeImage for photo attachments
├── integrations/
│   ├── composio.ts       Composio client — per-user entity model, OAuth link generation
│   ├── calendar.ts       Google Calendar: pull events, find free blocks, blockTime, analyzeCalendar
│   └── gmail.ts          Gmail: pull emails, analyzeGmail, saveEmailDraft, sendEmail
├── memory/
│   └── db.ts             SQLite schema + queries: users, messages, tasks, agent log
└── listener/
    └── extractor.ts      LLM-based task extraction from stored messages

listener/
└── index.ts              Standalone listener process — runs on the user's Mac, forwards messages
```

---

## Built for

[Trae.ai](https://trae.ai) x MiniMax Hackathon
