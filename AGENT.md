# Nudge — iMessage AI Assistant

## Overview

Nudge is an AI-powered iMessage assistant that responds to text messages with context-aware replies using MiniMax M2.7 + Speech 2.8 TTS. It integrates with Gmail and Google Calendar via Composio to provide personalized, proactive assistance.

**Core Philosophy**: Not a helpful assistant — a sharp friend who happens to have access to your calendar, email, and tasks. Voice is lowercase, casual, and occasionally roast-y.

## Architecture

### Message Flow

```
Incoming iMessage
  ↓
[src/imessage/sdk.ts] - Normalize + deduplicate + debug log
  ↓
[src/imessage/router.ts] - isFromMe? ignore : agent
  ↓
[src/agent/handler.ts] - Onboarding check → Intent classify → Context assemble → LLM → Validate → Reply
  ↓
iMessage response (text + optional voice note)
```

### Background Systems

```
[src/index.ts] - Boot sequence
  ↓
[src/listener/extractor.ts] - 30s loop: batch messages → M2.7 extracts tasks/people → SQLite
  ↓
[src/agent/proactive/] - 9 triggers (scheduled + event-driven)
  ↓
[src/agent/crossref.ts] - 5min loop: cross-reference calendar + email + tasks
```

## Directory Structure

```
imesg/
├── src/
│   ├── index.ts                          # Boot sequence
│   ├── config.ts                         # Environment configuration
│   ├── agent/
│   │   ├── handler.ts                    # Main message handler + onboarding
│   │   ├── context.ts                   # Context assembly for LLM
│   │   ├── personality.ts                # System prompt + voice validation
│   │   ├── tools.ts                      # Tool definitions + executor
│   │   ├── crossref.ts                  # Cross-source intelligence
│   │   └── proactive/
│   │       ├── index.ts                 # Proactive engine orchestrator
│   │       ├── engine.ts                # Proactive send logic
│   │       ├── triggers-scheduled.ts    # Time-based triggers (6)
│   │       └── triggers-event.ts        # Event-based triggers (3)
│   ├── imessage/
│   │   ├── sdk.ts                       # Photon iMessage Kit wrapper
│   │   ├── router.ts                    # Message routing
│   │   ├── batcher.ts                   # Rapid-fire message batching
│   │   └── bubble-split.ts              # Long response splitting
│   ├── integrations/
│   │   ├── composio.ts                  # Per-user OAuth + tool execution
│   │   ├── calendar.ts                 # Google Calendar integration
│   │   └── gmail.ts                    # Gmail integration
│   ├── minimax/
│   │   ├── llm.ts                      # M2.7 wrapper + tool calling
│   │   ├── tts.ts                      # Speech 2.8 TTS
│   │   └── vision.ts                   # Image analysis
│   ├── memory/
│   │   └── db.ts                       # SQLite schema + queries
│   └── listener/
│       └── extractor.ts                # Background task/people extraction
├── frontend/                            # Next.js dashboard (future)
├── data/                               # SQLite database (created at runtime)
└── audio/                              # Generated TTS files (created at runtime)
```

## Core Modules

### [src/index.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/index.ts)

Boot sequence that initializes all systems:
1. Database initialization (WAL mode, 5s busy timeout)
2. iMessage listener (auto-registers new users)
3. Background extraction loop
4. Proactive engine
5. Cross-reference loop

Graceful degradation: If iMessage connection fails, runs without it.

### [src/config.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/config.ts)

Required environment variables:
- `MINIMAX_API_KEY` - MiniMax API key
- `MINIMAX_API_HOST` - MiniMax API base URL
- `COMPOSIO_API_KEY` - Composio API key
- `AGENT_CHAT_IDENTIFIER` - iMessage chat identifier

Optional configuration:
- `QUIET_HOURS_START/END` (default 23-7) - No proactive messages
- `MAX_PROACTIVE_PER_HOUR` (default 3) - Rate limit proactive sends
- `MORNING_BRIEFING_HOUR` (default 8) - Morning briefing time
- `EOD_REVIEW_HOUR` (default 18) - End-of-day review time
- `PRE_MEETING_MINUTES` (default 15) - Pre-meeting prep trigger window
- `CALENDAR_POLL_MS` (default 300000 = 5min)
- `EMAIL_POLL_MS` (default 600000 = 10min)
- `MESSAGE_BATCH_MS` (default 30000 = 30s)

### [src/imessage/sdk.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/imessage/sdk.ts)

Photon iMessage Kit wrapper providing:
- `sendText(to, text)` - Send text message
- `sendBubbles(to, bubbles[])` - Send multiple messages with 600-1200ms delays
- `sendAudio(to, audioPath, caption?)` - Send audio with optional caption
- `sendWithVoice(to, text, ttsFn)` - Generate TTS and send, fallback to text
- `startListening(onMessage)` - Start watching for incoming messages

Message normalization: Handles multiple Photon SDK formats into `NormalizedMessage`:
```typescript
interface NormalizedMessage {
  id: string;
  text: string;
  sender: string;
  chatId: string;
  isFromMe: boolean;
  isGroupChat: boolean;
  timestamp: number;
  attachments: { path: string; mimeType?: string }[];
}
```

Deduplication: Maintains in-memory Set of processed message IDs (max 10,000).

### [src/imessage/router.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/imessage/router.ts)

Simple routing: `routeMessage(msg)` returns `'agent'` or `'ignore'`.
- Ignores messages from self (`isFromMe: true`)
- Everything else → agent

### [src/imessage/batcher.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/imessage/batcher.ts)

Rapid-fire message batching:
- Collects multiple messages within 1.5s gaps
- Forces flush after 6s max wait
- Deduplicates identical messages
- Combines into single context

Not currently used in main flow — available for future multi-message scenarios.

### [src/imessage/bubble-split.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/imessage/bubble-split.ts)

Long response splitting for iMessage bubbles:
- Max 4 bubbles per response
- Prefers newline splits (LLM naturally separates thoughts)
- Semantic splitting at: "also", "anyway", "btw", "oh and", "but", "however", "though"
- Merges tiny segments (<20 chars) with previous

## Agent System

### [src/agent/handler.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/handler.ts)

Main message handler orchestrating:

**Onboarding Flow (Bouncer Pattern)**:
1. New user → "who dis" energy, playful gatekeeping
2. Gathers: confirmed first name + what they do + how busy
3. Once approved → sends OAuth links (Gmail + Calendar)
4. After OAuth complete → "locked in, {name}" + feature hints

**Main Flow**:
1. `/reset` command - wipes database, restarts onboarding
2. Skip acknowledgments (ok, got it, thanks, bet, cool, etc.)
3. Image handling → vision analysis + text context
4. LLM with tool calling (max 5 rounds)
5. Validate response → send

**Intent Classification** (regex-based):
- `task` - tasks, todos, focus, priority
- `email` - emails, inbox, unread, gmail
- `schedule` - calendar, schedule, meetings, availability
- `draft` - draft, write, reply, compose
- `person` - who, what did X say/ask/send

### [src/agent/personality.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/personality.ts)

**System Prompt**: Defines Nudge's personality — lowercase, casual, roast-y friend who gives a shit.

**Post-History Enforcement**: Placed AFTER conversation for 90-95% compliance:
- Max 120 words
- No numbered lists
- No "Here's" or "So," starts
- One question max
- Max 1 exclamation mark

**Validation Functions**:
- `validateResponse(text)` - Enforces voice rules, strips banned phrases, word limit
- `validateDraft(text)` - Strips preamble, tech jargon
- `getTemporalVoice()` - Time-of-day aware tone (6am-10am: efficient, 5pm-9pm: warmer)

**Banned Phrases** (50+ phrases including):
- Assistant language: "i'd be happy to", "let me help you", "great question"
- Formal: "certainly", "absolutely", "indeed"
- Tech jargon: "database", "api", "server", "agent", "pipeline"

**Banned Words**: "utilize", "leverage", "facilitate", "algorithm", "optimize", etc.

### [src/agent/context.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/context.ts)

Context assembly with intent-aware section ordering:

**Intent-Specific Order**:
- `task`: situation → conversation → tasks → calInsights → emailInsights → crossref → blocks → events → emails
- `email`: situation → conversation → emailInsights → emails → crossref → ...
- `schedule`: situation → conversation → events → calInsights → blocks → ...
- `draft`: situation → conversation → emailInsights → emails → crossref → ...
- `person`: situation → conversation → crossref → tasks → ...

**Sections**:
1. **situation** - "Right now" anchor: current meeting, time until next, urgent tasks, next free block
2. **conversation** - Last 8 messages
3. **events** - Today's calendar sorted by time
4. **blocks** - Free blocks (30min+) sorted by time
5. **tasks** - Open tasks sorted by urgency (max 10)
6. **emails** - Unread emails with from + subject + snippet (max 5)
7. **crossref** - People appearing in 2+ sources (calendar + email, etc.)
8. **calInsights** - LLM-generated calendar insights
9. **emailInsights** - LLM-generated email triage + action items

**Person Extraction**:
- `extractPersonName(text)` - Parses "what did X say" patterns
- `extractDraftRecipient(text)` - Parses "reply to X" patterns
- `fmtPersonDossier(name)` - Formats person data from DB

### [src/agent/tools.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/tools.ts)

OpenAI function-calling format tool definitions:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_calendar` | Today's events, free blocks, insights | Schedule/meeting questions |
| `get_emails` | Unread emails with triage | Email/inbox questions |
| `get_tasks` | Open task queue by urgency | What to focus on |
| `get_person` | Person dossier (messages, tasks, context) | User mentions someone by name |
| `get_conversation` | Recent conversation history | Context on prior discussion |
| `save_email_draft` | Create draft in Gmail (NOT send) | Draft/write/reply requests |
| `get_cross_insights` | Cross-source connections | Connect dots before advice |

Tool executor uses Composio per-user entities when available.

### [src/agent/crossref.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/crossref.ts)

Background intelligence loop (5-minute interval):
- Pulls calendar, email, tasks
- Uses LLM to find meaningful connections:
  - Same person in calendar + email + tasks
  - Prep needed before meetings based on email
  - Task deadlines conflicting with calendar
  - Unanswered emails from task-assigners
  - Follow-ups after recent meetings
- Caches insights for `get_cross_insights` tool

## Proactive System

### [src/agent/proactive/index.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/proactive/index.ts)

Orchestrator that:
1. Schedules daily triggers (morning briefing, EOD review) per user on boot
2. Starts interval triggers for all active users:
   - Pre-meeting prep: every 5min
   - Task nudge: every 30min
   - Email alert: every 10min
   - Email escalation: every 10min
   - Schedule optimizer: every 15min
   - Follow-up reminder: every 5min
   - Cross-source pairing: every 5min

### [src/agent/proactive/engine.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/proactive/engine.ts)

`sendProactive(triggerType, prompt, userId, chatId, phone)`:
1. Assembles full context for user
2. Generates response via LLM with personality
3. Validates response
4. Checks duplicate gate (48hr dedup)
5. Logs to proactive_log table
6. Sends via iMessage

### [src/agent/proactive/triggers-scheduled.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/proactive/triggers-scheduled.ts)

**Time-Based Triggers**:

1. **Morning Briefing** (config.MORNING_BRIEFING_HOUR, default 8am)
   - Key meetings today
   - Top tasks
   - Urgent email items
   - Keep it tight

2. **End of Day Review** (config.EOD_REVIEW_HOUR, default 6pm)
   - Meeting count
   - Open tasks + urgent count
   - What likely got done
   - What's hanging
   - #1 thing for tomorrow

3. **Task Nudge** (every 30min)
   - Only if urgency >= 4 tasks exist
   - Max 3 tasks mentioned
   - "; " separated list

4. **Email Alert** (every 10min)
   - Pulls 3 unread emails
   - Flags may-need-attention items
   - Summary format: "from: subject; from: subject"

5. **Email Escalation** (every 10min)
   - Detects 3+ unread from same sender
   - One alert per sender (dedup)
   - Heads-up format

6. **Schedule Optimizer** (every 15min)
   - Finds next free block (30min+) after now
   - Matches with urgency >= 3 task
   - One suggestion per block
   - Specific time + task + why now

### [src/agent/proactive/triggers-event.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/agent/proactive/triggers-event.ts)

**Event-Based Triggers**:

1. **Pre-Meeting Prep** (every 5min)
   - Detects meetings starting in next 15min (configurable)
   - One alert per meeting
   - Includes: title, attendees, time until
   - "what should i know?" framing

2. **Follow-Up Reminder** (every 5min)
   - Finds meetings that ended 30min-3hr ago
   - Only meetings with attendees
   - Asks if follow-ups needed
   - One reminder per meeting

3. **Cross-Source Pairing** (every 5min)
   - Looks for upcoming meetings (within 2hr)
   - Cross-references attendees against:
     - Unread emails (sender name match)
     - Open tasks (assigned_by name match)
   - First match triggers alert
   - Format: "heads up — {name} appears in {sources}. connect the dots."

## Integration Layer

### [src/integrations/composio.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/integrations/composio.ts)

**Per-User OAuth**:
- Phone number → safe entity ID (user-{digits})
- `getOAuthLinks(phone)` - Initiates Gmail + Google Calendar OAuth
- `checkUserConnected(phone)` - Checks active connections

**Tool Execution with Fallback**:
- `executeWithFallback(strategies[], searchKeys[], label, phone)`
- Tries multiple Composio action strategies
- Searches result for expected data keys
- Returns first non-empty array found
- Handles mock mode (no Composio key)

### [src/integrations/calendar.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/integrations/calendar.ts)

**Pull**:
- `pullTodayEvents(phone?)` - Gets today's calendar via Composio
- Tries 3 action strategies: GOOGLECALENDAR_FIND_EVENT, GOOGLECALENDAR_EVENTS_LIST
- Normalizes to `CalendarEvent[]`

**Structural Analysis** (no LLM):
- `findFreeBlocks(events)` - Gaps >= 30min between meetings
- `analyzeStructure(events)` - Total hours, back-to-back count, focus blocks, tags

**LLM Analysis**:
- `analyzeCalendar(phone?)` - Full analysis with insights
- Generates: insights[], busiest_window, prep_needed[], conflicts[]
- Falls back to structural analysis if LLM fails

### [src/integrations/gmail.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/integrations/gmail.ts)

**Pull**:
- `pullUnreadEmails(maxResults, phone?)` - Gets unread via Composio
- Tries 3 action strategies: GMAIL_FETCH_EMAILS, GMAIL_LIST_THREADS
- Normalizes to `EmailSummary[]`

**Structural Analysis** (no LLM):
- Top senders by frequency
- Tags: email_heavy (10+), email_light (2-), sender_escalation (3+ from same)

**LLM Analysis**:
- `analyzeGmail(phone?)` - Full triage
- Generates: action_items[], can_ignore[], insights[], urgent_count
- Falls back to structural if LLM fails

**Draft Saving**:
- `saveEmailDraft(to, subject, body, phone?)` - Creates Gmail draft
- Tries 3 strategies
- Returns success/failure message

## LLM & Voice

### [src/minimax/llm.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/minimax/llm.ts)

**Client**: OpenAI SDK with MiniMax base URL

**Model Fallback Chain**:
1. MiniMax-M2.7
2. minimax-m2.7
3. MiniMax-M2.7-highspeed

**Core Functions**:
- `generate(system, user)` - Basic completion
- `generateJSON(system, user)` - JSON mode, auto-parses
- `generateWithTools(system, user, tools, executor)` - Tool calling (max 5 rounds)

**Helpers**:
- `stripThinkTags(text)` - Removes `<think>...</think>` tags
- `extractJSON(text)` - Extracts JSON from markdown code blocks

### [src/minimax/tts.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/minimax/tts.ts)

Speech 2.8 TTS with endpoint fallback:
1. `/v1/t2a_v2`
2. `/v1/text_to_speech`
3. `/v1/tts`

Voice: `male-qn-qingse` with emotion setting

Output: MP3 files in `audio/` directory

### [src/minimax/vision.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/minimax/vision.ts)

M2.7 multimodal image analysis:
- Reads image file as base64
- Sends to chat completion with image_url
- Returns description text

## Memory & Persistence

### [src/memory/db.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/memory/db.ts)

SQLite database (better-sqlite3) with WAL mode.

**Schema**:

```sql
users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  chat_id TEXT,
  name TEXT,
  profile TEXT,
  onboard_stage TEXT DEFAULT 'new',
  active INTEGER DEFAULT 1,
  created_at DATETIME
)

messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  chat_id TEXT,
  sender TEXT,
  content TEXT,
  timestamp DATETIME,
  direction TEXT CHECK(in/out),
  has_attachment INTEGER,
  attachment_type TEXT,
  attachment_path TEXT,
  processed INTEGER DEFAULT 0
)

tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  source TEXT,
  source_ref TEXT,
  description TEXT,
  assigned_by TEXT,
  deadline TEXT,
  urgency INTEGER 1-5 DEFAULT 3,
  status TEXT CHECK(open/done/dismissed),
  created_at DATETIME,
  updated_at DATETIME
)

people (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT,
  phone TEXT,
  last_contact TEXT,
  context_notes TEXT,
  open_tasks INTEGER DEFAULT 0
)

agent_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  direction TEXT CHECK(in/out),
  content TEXT,
  message_type TEXT DEFAULT 'text',
  audio_path TEXT,
  timestamp DATETIME
)

proactive_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  trigger_type TEXT,
  content_hash TEXT,
  sent_at DATETIME
)
```

**Key Queries**:
- `getActiveUsers()` - All active users
- `getUserByPhone(phone)` - User lookup by phone
- `getUserByChatId(chatId)` - User lookup by chat (with phone-in-chatId fallback)
- `storeMessage(msg)` - Insert with dedup (INSERT OR IGNORE)
- `getUnprocessedMessages(limit, userId?)` - For extractor
- `markProcessed(ids)` - Batch update
- `storeTasks(tasks[], userId?)` - Batch insert with dedup
- `getTaskQueue(userId?)` - Open tasks sorted by urgency
- `getRecentConversation(limit, userId?)` - Last N agent exchanges
- `getPersonDossier(name, userId?)` - Person + messages + tasks
- `logAgent(entry)` - Agent activity logging
- `logProactive(trigger_type, hash, userId)` - Proactive send logging
- `wasRecentlySent(hash, minutes, userId?)` - 48hr proactive dedup
- `countRecentProactive(minutes, userId?)` - Rate limit check
- `getTriggerEngagement(days, userId?)` - Trigger analytics
- `resetDatabase()` - Full wipe for /reset command

## Background Systems

### [src/listener/extractor.ts](file:///Users/johnnysheng/Documents/trae_projects/imesg/src/listener/extractor.ts)

30-second extraction loop:

1. Fetch unprocessed messages (max 20)
2. Send batch to M2.7 for extraction:
   - Tasks (description, assigned_by, deadline, urgency)
   - Commitments (description, to_whom, deadline)
   - People (name, context)
3. Regex fallback for people extraction (pattern matching)
4. Store tasks in DB
5. Store people in DB (dedup by name)
6. Mark messages as processed

**LLM Prompt**:
```
Analyze these iMessage messages. Extract as JSON:
{"tasks":[...],"commitments":[...],"people":[...]}
Be specific. Include names and exact asks.
```

## Onboarding Flow

```
New User Texts Nudge
  ↓
Bouncer: "who dis" / "new phone who dis"
  ↓
User responds
  ↓
Bouncer: guesses name/job/busyness playfully
  ↓
Keeps chatting until has: confirmed name + what they do + how busy
  ↓
"VERDICT: APPROVED"
  ↓
Extract profile via LLM JSON
  ↓
Update user: name, profile, onboard_stage='waiting_oauth'
  ↓
Send OAuth links: Gmail + Calendar
  ↓
User completes OAuth
  ↓
User texts again
  ↓
checkUserConnected() → both connected
  ↓
Update user: onboard_stage='active'
  ↓
"locked in, {name}"
  ↓
Feature hints
  ↓
Full agent access
```

**Max Users**: 6 active users (capacity check during onboarding)

**Bouncer Rules**:
- ONE message at a time, short, lowercase
- Never explain what Nudge is
- Be funny, roast a little
- Gatekeeping IS the charm

## Message Processing Flow

```
Raw iMessage (Photon SDK format)
  ↓
normalizeMessage() → NormalizedMessage
  ↓
Deduplicate (in-memory Set)
  ↓
routeMessage() → isFromMe? → agent or ignore
  ↓
Auto-register if new phone
  ↓
storeMessage() → SQLite
  ↓
handleAgentMessage()
  ├─ /reset? → resetDatabase() → restart
  ├─ Onboarding check → handleOnboarding()
  ├─ Skip acknowledgments
  ├─ Image? → analyzeImage() → append to text
  ├─ generateWithTools() → LLM + tools (5 rounds max)
  ├─ validateResponse() or validateDraft()
  ├─ sendText()
  └─ logAgent()
  ↓
Response sent
```

## Error Handling

**Layered Fallbacks**:
1. iMessage SDK fails → runs without iMessage
2. Extraction loop fails → logs, continues
3. Proactive engine fails → logs, continues
4. LLM all models fail → returns empty/error
5. Composio in mock mode → returns empty arrays
6. Individual trigger fails → logs warning, continues

**Rate Limiting**:
- Proactive: 3 per hour per user (configurable)
- Proactive dedup: 48hr per content hash
- Tool calls: max 5 rounds per message

## Testing

**Test Commands**:
```bash
bun run test:1-config      # Config loading
bun run test:2-db          # Database initialization
bun run test:3-llm         # LLM generation
bun run test:4-tts          # TTS generation
bun run test:5-composio     # Composio mock mode check
bun run test:6-gmail        # Gmail pull
bun run test:7-calendar     # Calendar pull
bun run test:8-personality  # Voice validation
bun run testbench           # Full test suite
```

**Note**: Database tests require `npx tsx` (not bun) due to better-sqlite3.

## Configuration Best Practices

1. **API Keys**: Use `.env` file, never commit
2. **Quiet Hours**: Set start/end to prevent late-night proactives
3. **Poll Intervals**: Balance freshness vs. API costs
4. **Max Users**: 6 user limit for quality control
5. **Proactive Rate**: 3/hour prevents spam while staying helpful

## Development Guidelines

- **Config Keys**: Always SCREAMING_SNAKE (e.g., `config.MINIMAX_API_KEY`)
- **Tool Calling**: Pull data before giving advice
- **Validation**: All LLM responses MUST go through `validateResponse()`
- **Error Handling**: Graceful degradation, never crash the main loop
- **User Scoping**: Most functions take `userId` for multi-user safety
- **Proactive Gates**: Always check dedup + rate limits before sending
- **Onboarding**: Funnel users, don't just help everyone immediately

## Dependencies

- **@photon-ai/imessage-kit** - iMessage SDK
- **better-sqlite3** - SQLite database
- **composio-core** - OAuth + tool orchestration
- **openai** - LLM client
- **dotenv** - Environment variables
- **uuid** - ID generation
