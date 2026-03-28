# Nudge — AGENT.md

Reference document for AI coding assistants (Trae/Claude). Everything here reflects the current codebase exactly.

---

## 1. Overview

**Nudge** is an iMessage AI assistant. It reads a user's Gmail and Google Calendar via Composio, extracts tasks from conversations, and responds as a casual friend — not a corporate assistant.

**Core philosophy**: Synthesize 5 data points into 1 casual text. The gap between what you know and what you say is the mystery. Silence > noise. Roast > politeness.

**Tech stack**:
- Runtime: Node.js via `npx tsx` (NOT bun — `better-sqlite3` is a native module that doesn't work with bun)
- LLM: MiniMax M2.7 via OpenAI-compatible SDK
- iMessage: `@photon-ai/imessage-kit`
- OAuth/integrations: Composio (Gmail + Google Calendar)
- Database: SQLite via `better-sqlite3`
- Language: TypeScript (ESM modules)

**Start command**: `npm start` → runs `npx tsx src/index.ts`

---

## 2. Two-Mac Architecture

Nudge supports a split-Mac setup for production use, though the agent Mac can also run standalone.

```
Listener Mac (user's Mac with iMessage)       Agent Mac (server)
─────────────────────────────────────────     ────────────────────────────────────
listener/index.ts                             src/server.ts
  - @photon-ai/imessage-kit watcher              - Bun.serve on LISTENER_PORT (3456)
  - Filters own messages + IGNORE_CHAT_IDS        - POST /api/messages
  - Batches 3s before sending                     - Bearer token auth (LISTENER_SECRET)
  - POST → AGENT_URL/api/messages                 - storeMessage() + runExtractionOnce()
                                                  - evaluate() → decision engine
```

**Env vars on Listener Mac**:
- `AGENT_URL` — HTTP URL of agent Mac (e.g., `http://192.168.1.x:3456`)
- `LISTENER_SECRET` — shared secret (default `nudge-demo-2026`)
- `OWNER_PHONE` — owner's phone number (e.g., `+12134240682`)
- `IGNORE_CHAT_IDS` — comma-separated chat/sender IDs to skip (agent's own chat)

**Standalone mode**: The agent Mac also runs `@photon-ai/imessage-kit` directly in `src/imessage/sdk.ts` — so a single Mac works without the listener bridge.

---

## 3. Directory Structure

```
imesg/
├── src/
│   ├── index.ts                    # Boot sequence — wires all systems
│   ├── config.ts                   # Env var loading + validation
│   ├── demo.ts                     # Virtual time + demo mode state
│   ├── server.ts                   # HTTP server for listener bridge (Bun.serve)
│   ├── utils.ts                    # fmtTime(), normalizeNameWords()
│   ├── agent/
│   │   ├── handler.ts              # Main message handler, onboarding, all /commands
│   │   ├── personality.ts          # SYSTEM_PROMPT, POST_HISTORY_ENFORCEMENT, validators
│   │   ├── context.ts              # assembleContext() — intent-ordered context sections
│   │   ├── tools.ts                # 9 tool defs (OpenAI format) + createToolExecutor()
│   │   ├── ranking.ts              # rankTasks() scoring formula + formatRankedPlan()
│   │   ├── crossref.ts             # 5-min loop: LLM cross-source intelligence cache
│   │   └── proactive/
│   │       ├── index.ts            # startProactiveEngine() — wires 9 triggers
│   │       ├── engine.ts           # sendProactive() — dedup gate + LLM + send
│   │       ├── decision-engine.ts  # evaluate() — urgency vs disruption gate
│   │       ├── triggers-scheduled.ts  # 6 triggers: morning, eod, taskNudge, emailAlert, escalation, optimizer
│   │       ├── triggers-event.ts   # 3 triggers: preMeetingPrep, followUpReminder, crossSourcePairing
│   │       └── types.ts            # UserCtx type, dedupAdd() helper
│   ├── imessage/
│   │   ├── sdk.ts                  # Photon iMessage Kit wrapper — send/listen/normalize
│   │   ├── router.ts               # routeMessage() — isFromMe → ignore, else → agent
│   │   ├── batcher.ts              # MessageBatcher — 1.5s gap / 6s max before flush
│   │   └── bubble-split.ts         # splitIntoBubbles() — max 4 bubbles, semantic split
│   ├── integrations/
│   │   ├── composio.ts             # OAuth, executeWithFallback(), per-user entities
│   │   ├── calendar.ts             # pullTodayEvents, findFreeBlocks, analyzeCalendar, blockTime
│   │   └── gmail.ts                # pullUnreadEmails, analyzeGmail, saveEmailDraft, sendEmail
│   ├── minimax/
│   │   ├── llm.ts                  # generate(), generateJSON(), generateWithTools(), model fallback
│   │   └── vision.ts               # analyzeImage() — base64 + M2.7 multimodal
│   ├── memory/
│   │   └── db.ts                   # SQLite schema (6 tables) + all query functions
│   └── listener/
│       └── extractor.ts            # startExtractionLoop() + runExtractionOnce()
├── listener/
│   └── index.ts                    # Standalone listener process (runs on listener Mac)
├── data/                           # SQLite file created at runtime (data/nudge.db)
└── package.json
```

---

## 4. Boot Sequence

`npm start` → `npx tsx src/index.ts`

```
1. import "./config"            → load .env, validate 4 required keys, export config object
2. getDb()                      → create data/ dir, open SQLite, run schema migrations
3. startListening(callback)     → Photon SDK watcher (2s poll, excludeOwnMessages)
   └─ each message:
      - routeMessage() → ignore if isFromMe
      - getUserByPhone() → registerUser() if new
      - storeMessage()
      - handleAgentMessage()
4. startExtractionLoop()        → setInterval 30s: unprocessed messages → LLM → tasks/people
5. startProactiveEngine()       → scheduleTimers + setIntervals for all 9 triggers
6. startCrossRefLoop()          → setInterval 5min: calendar+email+tasks → LLM → cachedInsights
7. startServer()                → Bun.serve on LISTENER_PORT for listener bridge
```

If iMessage connection fails, systems 4-7 still start. Nudge logs `"running without iMessage — other systems still available"`.

---

## 5. Message Flow

```
Incoming iMessage (Photon SDK raw event)
  ↓
sdk.ts: normalizeMessage()         → NormalizedMessage { id, text, sender, chatId, isFromMe, isGroupChat, timestamp, attachments[] }
  ↓
sdk.ts: dedup check                → processedIds Set (max 10,000)
  ↓
router.ts: routeMessage()          → isFromMe → 'ignore', else → 'agent'
  ↓
index.ts callback:
  - getUserByPhone() / registerUser()
  - storeMessage() → messages table (direction='in')
  - handleAgentMessage()
  ↓
handler.ts: handleAgentMessage()
  ├─ /reset /demo /time /important /priority /poll → bypass batcher → processMessage()
  └─ everything else → batcher.add()
       ↓ (after 1.5s gap or 6s max)
     batcher.flush() → processMessage()
  ↓
handler.ts: processMessage()
  ├─ task completion detection: "done with X" → completeTaskByDescription()
  ├─ handleOnboarding() → returns true if still in onboarding
  ├─ skip empty / acknowledgment messages
  ├─ image attachment? → analyzeImage() → prepend to userContent
  ├─ buildSystem() → SYSTEM_PROMPT + context + temporal voice + POST_HISTORY_ENFORCEMENT
  ├─ createToolExecutor(phone)
  ├─ generateWithTools(system, userContent, TOOL_DEFS, executor) → max 5 tool rounds
  ├─ isDraft? validateDraft(text) : validateResponse(text)
  ├─ splitIntoBubbles() → sendBubbles()
  └─ logAgent()
```

---

## 6. Onboarding Flow

Onboarding state is stored in `users.onboard_stage`:
`'new'` → `'evaluating'` → `'waiting_oauth'` → `'active'`

```
Stage: new / evaluating
─────────────────────────────────────────────────────────────────
Bouncer LLM (BOUNCER_PROMPT):
  - Capacity check: if active users >= 6 → "at capacity rn"
  - Keeps conversation in onboardConvo Map<phone, string[]>
  - Aims to confirm: name + role + busyness
  - Once satisfied → emits "VERDICT: APPROVED" in response text
  - After approval:
    - generateJSON(EXTRACT_PROFILE_PROMPT, history) → { name, profile, email_heavy, calendar_heavy }
    - updateUser(phone, { name, profile, onboard_stage: 'waiting_oauth' })
    - getOAuthLinks(phone) → sends gmail: <url> and calendar: <url>
    - "same google account for both. text me when you're done"

Stage: waiting_oauth
─────────────────────────────────────────────────────────────────
On next message from user:
  - isDemoMode() ? skip check : checkUserConnected(phone) → { gmail, calendar }
  - If connected:
    - updateUser(phone, { onboard_stage: 'active' })
    - "locked in, {name}"
    - "give me a sec to look around..."
    - Promise.allSettled([analyzeCalendar, analyzeGmail])
    - generate(REVEAL_PROMPT) → splitIntoBubbles → validateResponse → sendBubbles
  - If not connected:
    - "don't see it yet — make sure you finished both links"

Stage: active
─────────────────────────────────────────────────────────────────
handleOnboarding() returns false → falls through to main processMessage() flow
```

**Demo mode shortcut**: `/demo` command sets `demoMode=true`. In `waiting_oauth`, the OAuth check is skipped — assumes already connected. Use for hackathon demos.

---

## 7. Demo Commands

All commands bypass the `MessageBatcher` (immediate processing).

| Command | Handler | Effect |
|---------|---------|--------|
| `/demo` | `processMessage()` | Sets `demoMode=true`, pre-warms calendar+gmail cache |
| `/time HH:MM` | `processMessage()` | Sets virtual clock via `setVirtualTime(h, m)`, fires `evaluate('time_change', ...)` |
| `/important` | `processMessage()` | Housekeeping scan: tasks vs email vs calendar, flags contradictions |
| `/priority` | `processMessage()` | Runs `rankTasks()` + `formatRankedPlan()` + LLM summary |
| `/poll` | `processMessage()` | Manually fires `evaluate('manual', ...)` decision engine |
| `/reset` | `processMessage()` | `resetDatabase()` wipes all tables, clears onboardConvo + pendingOAuth maps |

---

## 8. Agent System

### handler.ts

Key exports:
- `handleAgentMessage(msg)` — entry point from index.ts and batcher
- `classifyIntent(text)` — regex classifier returning `'task'|'email'|'schedule'|'draft'|'person'|'general'`

`classifyIntent()` regexes:
- `task`: `/\b(?:tasks?|todos?|focus|prioriti|urgent|what.*should|what.*next)/i`
- `email`: `/\b(?:emails?|inbox|unread|mails?|gmail|summar\w* emails?)/i`
- `schedule`: `/\b(?:calendar|schedule|meetings?|free at|busy|what time|standup|when\b.*\bis\b)/i`
- `draft`: `/\b(?:draft|write\b.*\b(?:to|reply)|reply to|respond to|compose|response to)/i`
- `person`: `/\b(?:who\b|what did \w+ (?:say|ask|send|want|need))/i`

### personality.ts

**`SYSTEM_PROMPT`** — defines Nudge's voice. Key rules:
- Synthesize data into one casual text
- Pattern observations in roast format: "u literally cant say no to meetings on tuesdays"
- Max 35 words, max 2 sentences, usually 1
- Match user's message length exactly
- Never say "i recall" or "you mentioned" — drop facts like you just casually know

**`POST_HISTORY_ENFORCEMENT`** — placed AFTER conversation history in system message for ~90-95% compliance. Hard rules: no periods at end, no emojis, no forbidden words/phrases/starters, max 35 words.

**`validateResponse(text)`** — pre-filter applied to all LLM responses:
1. Lowercase entire response
2. Strip AI openers (whole clause): "i'd be happy to...", "i'd love to help...", "let me help you...", "as an ai...", "as a language model..."
3. Strip filler/jargon words (regex replace): `certainly, absolutely, definitely, indeed, furthermore, moreover, additionally, nevertheless, nonetheless, regarding, assistance, apologize, delighted, utilize, leverage, facilitate, interestingly, comprehensive, robust, streamline, optimize, efficiency, productivity, workflow, database, api, server, agent, pipeline, searching, processing, fetching, analyzing, computing, algorithm`
4. Strip markdown: `**bold**` → plain, numbered lists, bullet points
5. Clean whitespace
6. Strip trailing period
7. Hard cap at 35 words
8. Cap at 1 exclamation mark, 1 question mark

**`validateDraft(text)`** — for `save_email_draft` tool responses only:
1. Strip preamble: "here's a draft:", "here's what I'd say:", etc.
2. Strip jargon words (subset of above)
3. Clean whitespace
Does NOT lowercase — email drafts need proper casing.

**`getTemporalVoice()`** — returns time-of-day tone string:
- 6-10am: `'morning — shorter, drier, efficient. nobody wants personality at 7am'`
- 10am-12pm: `'late morning — they're in the zone. be direct'`
- 12-2pm: `'lunch — casual. they're on their phone between bites'`
- 2-5pm: `'afternoon — peak energy. roasts land harder'`
- 5pm-11pm: `'evening — reflective. connect dots across the day'`
- 11pm+: `'night — minimal. they're done'`
- 12am-6am: `'late night — why are u awake. keep it real short'`

Uses `nowDate()` from `demo.ts` so virtual time affects voice.

### context.ts

`assembleContext(intent?, userText?, phone?, userId?)` — assembles full LLM context string.

Pulls in parallel: `analyzeCalendar(phone)`, `getTaskQueue(userId)`, `analyzeGmail(phone)`, `getRecentConversation(8, userId)`.

Sections and their intent-based ordering:

| Section | Content |
|---------|---------|
| `situation` | Current meeting + mins left, next meeting + mins until, urgent task count, next free block suggestion |
| `conversation` | Last 8 agent_log entries reversed (most recent last) |
| `events` | Today's calendar sorted by start time |
| `blocks` | Free blocks (30min+) sorted by start time |
| `tasks` | Open tasks max 10, urgency + deadline + assigned_by |
| `emails` | Top 5 unread emails with from + subject + snippet |
| `crossref` | People appearing in 2+ sources (inline cross-ref, not cached) |
| `calInsights` | LLM calendar insights string |
| `emailInsights` | LLM email triage string + action items |

Section ordering by intent (`SECTION_ORDER`):
- `task`: situation → conversation → tasks → calInsights → emailInsights → crossref → blocks → events → emails
- `email`: situation → conversation → emailInsights → emails → crossref → calInsights → tasks → events → blocks
- `schedule`: situation → conversation → events → calInsights → blocks → crossref → tasks → emailInsights → emails
- `draft`: situation → conversation → emailInsights → emails → crossref → tasks → calInsights → events → blocks
- `person`: situation → conversation → crossref → tasks → emailInsights → emails → calInsights → events → blocks

For `person` and `draft` intents, `fmtPersonDossier(name, userId)` is prepended using `extractPersonName()` / `extractDraftRecipient()`.

Note: `context.ts:assembleContext()` is used by the proactive engine's `sendProactive()`. The main `processMessage()` flow in `handler.ts` uses tool-calling instead (LLM pulls data on demand via tools).

### tools.ts

9 tools in OpenAI function-calling format (`TOOL_DEFS: ToolDef[]`):

| # | Name | Required Params | Optional Params | Notes |
|---|------|-----------------|-----------------|-------|
| 1 | `get_calendar` | none | — | Today's events, free blocks, insights |
| 2 | `get_emails` | none | — | Unread emails with triage + action items |
| 3 | `get_tasks` | none | — | Open tasks sorted by urgency |
| 4 | `get_person` | `name: string` | — | Person dossier: context, last contact, messages, tasks |
| 5 | `get_conversation` | none | `limit: number` (default 8) | Recent agent_log entries |
| 6 | `save_email_draft` | `to: string`, `subject: string`, `body: string` | — | Saves draft, does NOT send |
| 7 | `send_email` | `to: string`, `subject: string`, `body: string` | — | Actually sends immediately |
| 8 | `block_time` | `title: string`, `duration_min: number` | `date: string`, `hour: number` | Blocks calendar time; auto-finds free slot if no hour given |
| 9 | `get_cross_insights` | none | — | Returns `getCachedInsights()` from crossref loop |

`createToolExecutor(phone?)` returns the async executor function bound to the user's phone. Tool calls: `save_email_draft` → response goes through `validateDraft()`; all others → `validateResponse()`.

---

## 9. Task System

### Schema (tasks table — 18 columns)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | uuid | Auto-generated |
| `user_id` | TEXT | null | FK to users.id |
| `source` | TEXT | required | Where extracted from (e.g., `'imessage'`) |
| `source_ref` | TEXT | null | Reference ID in source system |
| `description` | TEXT | required | The task itself |
| `assigned_by` | TEXT | null | Person who assigned it |
| `deadline` | TEXT | null | Date string |
| `urgency` | INTEGER 1-5 | 3 | Higher = more urgent |
| `status` | TEXT | `'open'` | `open` / `done` / `dismissed` |
| `created_at` | TEXT | now | SQLite datetime |
| `updated_at` | TEXT | now | SQLite datetime |
| `estimated_minutes` | INTEGER | null | 15/30/45/60/90/120 |
| `effort_level` | TEXT | `'focused'` | `quick` / `focused` / `deep` |
| `environment` | TEXT | `'anywhere'` | `anywhere` / `computer` / `in-person` |
| `depends_on` | TEXT | null | Comma-separated task IDs |
| `deadline_source` | TEXT | null | `explicit` / `inferred` / `professor` / `teammate` |
| `deadline_confidence` | TEXT | `'inferred'` | `hard` / `soft` / `inferred` |
| `completed_at` | TEXT | null | Set when status → done |

### Ranking Engine — ranking.ts

`rankTasks(tasks[], freeBlocks[], currentTime?)` → `RankedTask[]` sorted by score descending.

**Scoring formula**:
```
score = (urgency * 3)
      + (deadlineScore * 2)
      + (calendarFitScore * 1.5)
      + (dependencyClearScore * 1)
```

**Component functions**:

`deadlineScore(deadline, confidence, now)`:
- No deadline → 2
- Overdue or < 24hr → 10
- 24-48hr → 6
- Further out → 3
- Multiplied by confidence: `hard` × 1.0, `soft` × 0.6, `inferred` × 0.3

`calendarFitScore(estimatedMinutes, freeBlocks, now)`:
- No estimate or no blocks → 0
- Fits in the very next future free block → 5
- Fits in any future block today → 3
- Doesn't fit → 0

`dependencyClearScore(dependsOn, allTasks)`:
- No dependencies → 3
- All dependencies completed → 3
- Any unmet dependency → -100 (effectively removes from ranking, `blocked: true`)

### Task Lifecycle

1. **Extract**: `extractor.ts:runExtractionOnce()` → LLM parses messages → `storeTasks()`
2. **Rank**: `ranking.ts:rankTasks()` → scored + sorted for display or proactive decisions
3. **Complete**: Two paths:
   - Natural language: `"done with X"` → `completeTaskByDescription(desc, userId)` — fuzzy match (50% keyword overlap), sets `status='done'`, `completed_at=now()`
   - Direct: `completeTask(taskId)` by exact ID
4. **Complete detection**: Regex `/(?:done|finished|completed|knocked out)\s+(?:with\s+)?(?:the\s+)?(.+)/i` in `processMessage()`, falls through to LLM for natural response

---

## 10. Proactive System

Two paths to send a proactive message:

**Path A: Interval triggers → sendProactive()**
```
setInterval / setTimeout
  ↓
trigger function (e.g., taskNudge)
  ↓
sendProactive(triggerType, prompt, userId, chatId, phone)  ← engine.ts
  ↓
assembleContext() → generate(SYSTEM_PROMPT, prompt) → validateResponse()
  ↓
checkGates(): MD5 hash → wasRecentlySent(hash, 48hr) → return null if seen
  ↓
sendText(chatId, text) → logProactive(triggerType, hash, userId)
```

**Path B: Event triggers → evaluate() decision engine**
```
Triggered by: listener bridge new messages, /time command, /poll command
  ↓
evaluate(trigger, userId, chatId, phone, newData)  ← decision-engine.ts
  ↓
Rate limit: countRecentProactive(60min) >= MAX_PROACTIVE_PER_HOUR → { action: 'silent' }
  ↓
scoreDisruption(cal):
  - In meeting → 8
  - Meeting in < PRE_MEETING_MINUTES → 7
  - Quiet hours → 10
  - Free → 2
  ↓
DECISION_PROMPT → generateJSON() → { urgency, should_send, message, reason }
  ↓
Decision gate: !should_send OR urgency < disruption → { action: 'queue' }
  ↓
Dedup: wasRecentlySent(hash, 48hr) → { action: 'silent' }
  ↓
sendProactive() → { action: 'send' }
```

### All 9 Triggers

**Scheduled (triggers-scheduled.ts)**:

| Trigger | Function | Interval | Condition |
|---------|----------|----------|-----------|
| Morning Briefing | `scheduleMorningBriefing()` → `morningBriefing()` | Once daily at `MORNING_BRIEFING_HOUR` (8am) | Always |
| End of Day Review | `scheduleEodReview()` → `endOfDayReview()` | Once daily at `EOD_REVIEW_HOUR` (6pm) | Always |
| Task Nudge | `taskNudge()` | Every 30min | Only if `urgency >= 4` tasks exist |
| Email Alert | `emailAlert()` | Every `EMAIL_POLL_MS` (10min) | Only if unread emails exist |
| Email Escalation | `emailEscalation()` | Every `EMAIL_POLL_MS` (10min) | Only if 3+ unread from same sender |
| Schedule Optimizer | `scheduleOptimizer()` | Every 15min | Only if next free block >= 30min AND urgency >= 3 task exists |

**Event-driven (triggers-event.ts)**:

| Trigger | Function | Interval | Condition |
|---------|----------|----------|-----------|
| Pre-Meeting Prep | `preMeetingPrep()` | Every `CALENDAR_POLL_MS` (5min) | Meeting starting within `PRE_MEETING_MINUTES` (15min) |
| Follow-Up Reminder | `followUpReminder()` | Every `CALENDAR_POLL_MS` (5min) | Meeting with attendees ended 30min-3hr ago |
| Cross-Source Pairing | `crossSourcePairing()` | Every `CALENDAR_POLL_MS` (5min) | Attendee of upcoming meeting (within 2hr) also appears in unread emails or open tasks |

**Decision gate** (used by Path B): Urgency score (1-10 from LLM) must exceed disruption score (2-10 based on calendar context) for the message to send. This prevents interrupting meetings or sending during quiet hours unless the urgency genuinely warrants it.

---

## 11. Listener Bridge

The listener bridge handles the two-Mac setup. The standalone listener Mac runs `listener/index.ts` as a separate process.

```
listener/index.ts (Listener Mac)
  ↓
IMessageSDK watcher (2s poll, excludeOwnMessages)
  - Skips isFromMe messages
  - Skips chats in IGNORE_CHAT_IDS
  - Skips empty messages
  - Batches 3s (BATCH_MS) before flushing
  ↓
fetch(AGENT_URL + '/api/messages', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + SECRET },
  body: { owner_phone: OWNER_PHONE, messages: [{ id, text, sender, chat_id, is_group, timestamp }] }
})
  ↓
server.ts: POST /api/messages handler
  - Authorization check
  - getUserByPhone(owner_phone) → userId, chatId
  - storeMessage() for each message
  - runExtractionOnce(userId) → returns count of extracted tasks
  - If extracted > 0: evaluate('listener', userId, chatId, phone, context) → decision engine
  ↓
Response: { ok: true, stored: N, extracted: N }
```

Health check: `GET /health` returns `'ok'` (no auth required).

---

## 12. Integration Layer

### composio.ts

Per-user entity model: phone number → `user-{digits}` entity ID in Composio.

Key functions:
- `checkUserConnected(phone)` → `{ gmail: boolean, calendar: boolean }` — checks active OAuth connections
- `getOAuthLinks(phone)` → `{ gmail?: string, calendar?: string }` — initiates OAuth flows, returns redirect URLs
- `executeWithFallback(strategies[], searchKeys[], label, phone?)` — tries each strategy in order, uses `findArrayInResponse()` to extract data from varied response shapes; returns first non-empty array
- `isMockMode()` — returns `true` if Composio init failed (no key or network error); all operations return empty/false in mock mode

### calendar.ts

**Pull**: `pullTodayEvents(phone?)` — 3 Composio action fallback strategies: `GOOGLECALENDAR_FIND_EVENT`, `GOOGLECALENDAR_EVENTS_LIST`

**Analyze**: `analyzeCalendar(phone?)` → `CalendarAnalysis { events, freeBlocks, insights, tags }`
- `findFreeBlocks(events)` — structural, gaps >= 30min
- `analyzeStructure(events)` — tags: `meeting_heavy`, `meeting_light`, `back_to_back`, `has_focus_blocks`
- LLM pass: `generateJSON(CALENDAR_ANALYSIS_PROMPT, scheduleText)` → insights[], prep_needed[], conflicts[]
- Falls back to structural if LLM fails

**Block**: `blockTime(title, startTime, durationMin, phone?)` — 4 Composio action strategies for `GOOGLECALENDAR_CREATE_EVENT`

**Auto-block**: `findAndBlockTime(title, durationMin, preferredDate?, phone?)` — finds first free block >= durationMin, blocks it; if none today, books 9am tomorrow

### gmail.ts

**Pull**: `pullUnreadEmails(maxResults, phone?)` — 3 Composio action fallback strategies: `GMAIL_FETCH_EMAILS`, `GMAIL_LIST_THREADS`

**Analyze**: `analyzeGmail(phone?)` → `GmailAnalysis { emails, insights, tags, topSenders, actionItems }`
- Structural: top senders by frequency, tags: `email_heavy`, `email_light`, `sender_escalation`
- LLM pass: `generateJSON(EMAIL_ANALYSIS_PROMPT, emailText)` → action_items[], can_ignore[], insights[], urgent_count
- Falls back to structural if LLM fails

**Draft**: `saveEmailDraft(to, subject, body, phone?)` — 3 Composio action strategies: `GMAIL_CREATE_DRAFT`, `GMAIL_DRAFTS_CREATE`

**Send**: `sendEmail(to, subject, body, phone?)` — 4 Composio action strategies: `GMAIL_SEND_EMAIL`, `GMAIL_EMAILS_SEND`, `GMAIL_SEND`

---

## 13. LLM & Vision

### minimax/llm.ts

**Client**: OpenAI SDK pointed at `${MINIMAX_API_HOST}/v1`

**Model fallback chain** (tried in order, first success wins):
1. `MiniMax-M2.7`
2. `minimax-m2.7`
3. `MiniMax-M2.7-highspeed`

All models fail → returns `""` for text, `{}` for JSON.

**Core functions**:
- `generate(system, user)` → `Promise<string>` — basic chat completion, strips `<think>` tags
- `generateJSON(system, user)` → `Promise<any>` — JSON mode + `response_format: { type: 'json_object' }`, auto-parses; extracts from markdown code blocks if needed
- `generateWithTools(system, user, tools, executor)` → `Promise<{ text: string; toolsCalled: string[] }>` — full tool-calling loop, max 5 rounds per model; appends tool results to messages and loops; on max-round hit, does one final completion without tools; falls back to `generate()` if all models fail tool-calling

**Helper**: `stripThinkTags(text)` — removes `<think>...</think>` blocks from reasoning models

### minimax/vision.ts

`analyzeImage(imagePath)` — reads image file as base64 data URI, sends to `MiniMax-M2.7` (no fallback) with `VISION_PROMPT`. Supports JPEG, PNG, GIF, WebP.

**VISION_PROMPT** instructs extraction of: assignment rubric items/percentages/deadlines, conversation asks/deadlines, schedule dates/events, notes action items, receipt amounts/dates. Returns plain text with specific numbers, dates, names.

When a user sends an image in iMessage, `processMessage()` calls `analyzeImage()`, prepends the analysis as `[user sent a photo: ...]` to `userContent`, and also stores the analysis as a message and runs `runExtractionOnce()` to extract tasks from photo content (rubrics, screenshots).

---

## 14. Personality & Validation

### System prompt structure built in handler.ts: `buildSystem(context)`

```
SYSTEM_PROMPT (with {context} filled)
+ "\ntone: " + getTemporalVoice()
+ "\n\n" + POST_HISTORY_ENFORCEMENT
```

`POST_HISTORY_ENFORCEMENT` is placed AFTER conversation history because LLM compliance is higher when rules appear at the end of the context window (Icarus DQ-D4-03 research finding).

### validateResponse() pipeline

Called on every LLM response before sending (except email drafts):
1. `text.toLowerCase()` — all lowercase
2. AI opener strip (regex per pattern, nukes entire opening clause)
3. Filler/jargon word removal (`fillerRe` = combined FILLER_WORDS + JARGON_WORDS)
4. Markdown artifact strip: `**bold**` → plain, `1. ` → removed, `- ` → removed
5. Whitespace normalization: collapse 3+ newlines → 2, collapse double spaces
6. Trailing period removal
7. Hard 35-word cap (slice after split on whitespace)
8. Exclamation cap: max 1 (`!` → replaced after first)
9. Question cap: max 1 (`?` → replaced after first)

### validateDraft() pipeline

Called only when `toolsCalled.includes('save_email_draft')`:
1. Strip preamble regex `DRAFT_PREAMBLE_RE`: "here's a draft:", "here's what I'd say:", etc.
2. Tech jargon removal (JARGON_WORDS only, not FILLER_WORDS)
3. Whitespace normalization
4. Does NOT lowercase, does NOT cap word count

### getTemporalVoice()

Reads `nowDate().getHours()`. Returns a tone instruction string injected into the system prompt. Respects virtual time from `demo.ts` so `/time` command changes voice mid-demo.

---

## 15. Memory & Persistence

SQLite file at `data/nudge.db`. WAL mode + 5s busy timeout.

### 6 Tables

**`users`**
```
id TEXT PK, phone TEXT UNIQUE, chat_id TEXT,
name TEXT, profile TEXT,
onboard_stage TEXT DEFAULT 'new',   -- 'new' | 'evaluating' | 'waiting_oauth' | 'active'
active INTEGER DEFAULT 1,
created_at TEXT DEFAULT datetime('now')
```

**`messages`**
```
id TEXT PK, user_id TEXT, chat_id TEXT NOT NULL, sender TEXT NOT NULL,
content TEXT, timestamp TEXT DEFAULT datetime('now'),
direction TEXT CHECK(direction IN ('in','out')),
has_attachment INTEGER DEFAULT 0, attachment_type TEXT, attachment_path TEXT,
processed INTEGER DEFAULT 0      -- 0=unprocessed, 1=extracted
```

**`tasks`** (base schema + 7 migration columns)
```
id TEXT PK, user_id TEXT, source TEXT NOT NULL, source_ref TEXT,
description TEXT NOT NULL, assigned_by TEXT, deadline TEXT,
urgency INTEGER DEFAULT 3 CHECK(urgency BETWEEN 1 AND 5),
status TEXT DEFAULT 'open' CHECK(status IN ('open','done','dismissed')),
created_at TEXT DEFAULT datetime('now'), updated_at TEXT DEFAULT datetime('now'),
-- migration columns (added via ALTER TABLE):
estimated_minutes INTEGER, effort_level TEXT DEFAULT 'focused',
environment TEXT DEFAULT 'anywhere', depends_on TEXT,
deadline_source TEXT, deadline_confidence TEXT DEFAULT 'inferred',
completed_at TEXT
```

**`people`**
```
id TEXT PK, user_id TEXT, name TEXT NOT NULL, phone TEXT,
last_contact TEXT, context_notes TEXT, open_tasks INTEGER DEFAULT 0
```

**`agent_log`**
```
id TEXT PK, user_id TEXT,
direction TEXT CHECK(direction IN ('in','out')),
content TEXT, message_type TEXT DEFAULT 'text', audio_path TEXT,
timestamp TEXT DEFAULT datetime('now')
```

**`proactive_log`**
```
id TEXT PK, user_id TEXT, trigger_type TEXT NOT NULL,
content_hash TEXT NOT NULL,       -- MD5 of message content for dedup
sent_at TEXT DEFAULT datetime('now')
```

### Key Queries

| Function | What it does |
|----------|-------------|
| `getActiveUsers()` | All users where `active=1` |
| `getUserByPhone(phone)` | Single user lookup |
| `getUserByChatId(chatId)` | Lookup by chatId or phone contained in chatId |
| `registerUser(phone, chatId, name?)` | `INSERT OR IGNORE`, returns id |
| `updateUser(phone, updates)` | Updates name/profile/onboard_stage |
| `storeMessage(msg)` | `INSERT OR IGNORE` (dedup on id) |
| `getUnprocessedMessages(limit, userId?)` | For extractor — where `processed=0` |
| `markProcessed(ids[])` | Batch UPDATE `processed=1` |
| `storeTasks(tasks[], userId?)` | Batch `INSERT OR IGNORE` (dedup on id) |
| `getTaskQueue(userId?)` | Open tasks by urgency DESC |
| `getTasksWithDetails(userId?)` | Alias for `getTaskQueue()` |
| `completeTask(taskId)` | Sets `status='done'`, `completed_at=now()` |
| `completeTaskByDescription(desc, userId?)` | Fuzzy match (50% keyword overlap), then `completeTask()` |
| `getDependentTasks(taskId)` | Tasks whose `depends_on` contains taskId |
| `logAgent(entry, userId?)` | Insert into agent_log |
| `logProactive(type, hash, userId?)` | Insert into proactive_log |
| `wasRecentlySent(hash, minutes, userId?)` | Dedup check for proactive messages |
| `countRecentProactive(minutes, userId?)` | Rate limit check |
| `getRecentConversation(limit, userId?)` | Last N agent_log entries DESC |
| `getPersonDossier(name, userId?)` | Person + messages + tasks (LIKE %name%) |
| `getTriggerEngagement(days, userId?)` | Analytics: proactive sends vs user responses within 30min |
| `resetDatabase()` | DELETE FROM all tables |

---

## 16. Background Systems

Three loops start on boot:

### Extraction Loop — `src/listener/extractor.ts`

`startExtractionLoop()` — `setInterval(30s)`

Each tick:
1. `getUnprocessedMessages(20)` — up to 20 unprocessed messages
2. If none, return early
3. Format: `[sender] content\n` per message
4. `generateJSON(PROMPT, batch)` → `{ tasks[], commitments[], people[] }`
5. Regex person extraction as fallback (`PERSON_RE` patterns)
6. Dedup LLM + regex people by name
7. `storeTasks()` → tasks table
8. `storePeopleFromResult()` → people table (`INSERT OR IGNORE` by name-slug id)
9. `markProcessed(ids)` — mark all as processed

`runExtractionOnce(userId?)` — same logic, scoped to userId, called on-demand from server.ts and handler.ts image handling.

### Cross-Ref Loop — `src/agent/crossref.ts`

`startCrossRefLoop(phone?)` — runs immediately then `setInterval(5min)`

Each tick:
1. Pull calendar + email + tasks in parallel
2. Format each source as bulleted text
3. `generate(CROSSREF_PROMPT, dataBlock)` → 3-5 bullet insights
4. Update `cachedInsights` (module-level string)
5. `getCachedInsights()` — returned by `get_cross_insights` tool

Uses a `running` guard to prevent concurrent runs.

### Proactive Engine — `src/agent/proactive/index.ts`

`startProactiveEngine()` — on boot:
1. For each active user: `scheduleMorningBriefing(u)` and `scheduleEodReview(u)` (self-rescheduling `setTimeout` chains)
2. Seven `setInterval` calls for the remaining 7 triggers, each calling `forEachUser(triggerFn)`

`forEachUser(fn)` — re-reads `getActiveUsers()` each tick, runs trigger for each, swallows per-user errors.

---

## 17. Configuration

### Required (app won't start without these)

| Variable | Purpose |
|----------|---------|
| `MINIMAX_API_KEY` | MiniMax API key |
| `MINIMAX_API_HOST` | MiniMax base URL (e.g., `https://api.minimax.chat`) |
| `COMPOSIO_API_KEY` | Composio API key for OAuth + tool execution |
| `AGENT_CHAT_IDENTIFIER` | iMessage chat ID that Nudge uses to send (set in Photon SDK) |

### Optional (with defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `QUIET_HOURS_START` | `23` | Hour (0-23) when proactive messages stop |
| `QUIET_HOURS_END` | `7` | Hour (0-23) when proactive messages resume |
| `MAX_PROACTIVE_PER_HOUR` | `3` | Rate limit for proactive sends per user |
| `MORNING_BRIEFING_HOUR` | `8` | Hour for daily morning briefing |
| `EOD_REVIEW_HOUR` | `18` | Hour for end-of-day review |
| `PRE_MEETING_MINUTES` | `15` | Minutes before meeting to trigger prep |
| `LISTENER_PORT` | `3456` | Port for listener bridge HTTP server |
| `LISTENER_SECRET` | `nudge-demo-2026` | Bearer token for listener bridge auth |

### Hardcoded intervals (in config.ts)

| Constant | Value | Used for |
|----------|-------|---------|
| `CALENDAR_POLL_MS` | 5 min | preMeetingPrep, followUpReminder, crossSourcePairing |
| `EMAIL_POLL_MS` | 10 min | emailAlert, emailEscalation |
| `MESSAGE_BATCH_MS` | 30s | (currently unused in main flow) |

### Listener-only env vars (listener/index.ts)

| Variable | Required | Purpose |
|----------|---------|---------|
| `AGENT_URL` | Yes | URL of agent Mac HTTP server |
| `OWNER_PHONE` | Yes | Owner's phone number |
| `LISTENER_SECRET` | No | Shared secret, default `nudge-demo-2026` |
| `IGNORE_CHAT_IDS` | No | Comma-separated chat IDs to skip |

---

## 18. Development

### Starting

```bash
npm start         # runs: npx tsx src/index.ts
npm run dev       # same
```

Do NOT use `bun run src/index.ts` — `better-sqlite3` is a native Node module and doesn't work with Bun's runtime. Test scripts use `bun` for everything except DB-related tests.

### Testing

```bash
npm run test:1-config     # validates env vars load
npm run test:2-db         # opens SQLite, lists tables
npm run test:3-llm        # calls MiniMax: "say hello in 3 words"
npm run test:5-composio   # checks mock mode status
npm run test:6-gmail      # pulls 3 unread emails
npm run test:7-calendar   # pulls today's events
npm run test:8-personality # validates voice filtering
```

Note: `test:4-tts` prints "TTS archived — skipped" (TTS removed from codebase).

### Demo mode

```
/demo                  → enable demo mode (skips OAuth check in onboarding)
/time 8:00             → pretend it's 8am (triggers morning voice, fires time_change evaluate)
/time 14:30            → pretend it's 2:30pm (afternoon voice)
/priority              → show ranked task plan
/important             → housekeeping check across all sources
/poll                  → manually fire decision engine
/reset                 → wipe all data, start over
```

### Debugging tips

- All modules prefix logs: `[sdk]`, `[handler]`, `[proactive]`, `[extractor]`, `[crossref]`, `[server]`, `[db]`, `[composio]`, `[calendar]`, `[gmail]`, `[llm]`
- `[handler] tools: get_calendar, get_tasks` — shows which tools were called per message
- `[server] decision engine: send (urgency 8 > disruption 2)` — shows proactive evaluation result
- `[batcher] chat123: queued "hey" (2 in batch)` — shows batching in action
- Composio mock mode: if `isMockMode()` is true, all calendar/email calls return empty — check `COMPOSIO_API_KEY`
- Virtual time via `/time` affects: `getTemporalVoice()`, `proactive/decision-engine.ts:scoreDisruption()`, `ranking.ts:deadlineScore()`, `context.ts:fmtSituation()`, `triggers-scheduled.ts:scheduleMorningBriefing/scheduleEodReview()`

### Key invariants

- All LLM responses go through `validateResponse()` before sending (except drafts → `validateDraft()`)
- All proactive sends check dedup (`wasRecentlySent`, 48hr window) before sending
- All tasks use `INSERT OR IGNORE` — description-level dedup via uuid prevents exact re-adds
- `userId` scoping: most DB functions accept `userId?` for multi-user safety; `undefined` = unscoped query across all users
- `better-sqlite3` is synchronous — DB calls never need `await`
- The `server.ts` uses `Bun.serve` not Node's `http` — this is the one Bun-specific piece in the codebase (isolated to server.ts)
