# Imesg — Product Requirements Document

## This Document Is Self-Contained

Everything needed to build Nudge from scratch is in this document. No external context required. Paste this into a fresh session and execute.

***

## What Is IMSG

Nudge is a proactive AI personal assistant that lives in iMessage. It has two parts:

**Part 1 — The Listener:** Silently watches all your iMessage conversations. Extracts tasks, commitments, asks, meetup plans, and questions from your texts. Cross-references with Google Calendar and Gmail. Never sends a message to anyone. Invisible.

**Part 2 — The Agent:** A separate iMessage conversation thread where the AI talks to YOU. It uses everything the Listener learned to send you proactive voice briefings, optimized task queues, draft messages, follow-up reminders, and schedule suggestions. It also processes photos you send and responds via voice notes.

**The Listener is the ears. The Agent is the brain and mouth.**

***

## The Problem

Your tasks, commitments, and asks are scattered across three places: calendar events you haven't prepped for, emails with buried action items, and promises you made in text conversations. You spend more time figuring out WHAT to do and WHEN than actually doing it.

Every "solution" — Todoist, Notion, calendar apps — adds ANOTHER app to manage. They require you to open them, check them, maintain them. They require the exact executive function they're supposed to provide.

**IMESG cross-references your Gmail, Calendar, and iMessage conversations to extract every task, deadline, ask, and commitment — then optimizes your day and tells you what to do next, in voice, before you even think to ask.**

***

## The Pitch (30 seconds)

"Your calendar knows WHEN. Your email knows WHAT. Your texts know WHO. But nothing tells you what to do, in what order, right now.

Nudge is two things: a Listener that silently reads your texts and extracts every task, ask, and commitment — and an Agent that cross-references all of it with your calendar and email, then sends you a voice note saying 'here's your game plan, here's what's urgent, here's what can wait.'

No app. No dashboard. It lives in your iMessage. It talks to you before you think to ask."

***

## Hackathon Context

**Event:** Build with TRAE x MiniMax Hackathon at USC, March 27-28, 2026
**Duration:** 24 hours. Code freeze 6:30 PM PT March 28. Demos 8:00 PM PT.
**Team:** Johnny Sheng (AI engineer, built Icarus iMessage agent + 14,500 LOC companion agent) + Teri Shim (product designer, Riot Games/NatGeo, bilingual Korean-English, codes her own designs)
**Submit on:** Devpost (<https://build-with-trae-and-minimax.devpost.com/>)

### Judging Criteria

| Criteria                | Weight | Our Strategy                                                                                                                                |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Product Completeness    | 25%    | One tight two-part flow that works end-to-end. Listener extracts, Agent delivers voice briefings.                                           |
| TRAE AI Usage           | 20%    | Build entirely in TRAE AI. Show MCP integration, agent orchestration in commits. Screenshot TRAE in slides.                                 |
| MiniMax Integration     | 20%    | 3 modalities in critical path: M2.7 (reasoning), Speech 2.8 TTS (voice output), Vision (photo understanding). Deepest integration possible. |
| Innovation & Creativity | 20%    | TWO-PART architecture (Listener + Agent) is novel. Proactive optimization (not reactive chatbot). Cross-source intelligence.                |
| Presentation Quality    | 15%    | Voice notes play on real phone. Live demo of Listener extracting from real texts. Korean menu photo → Korean voice response.                |

### Prizes

- Main: 1st $800, 2nd $500, 3rd $200
- Photon Bonus: $1,000 credit + Residency Program interview (low competition, Johnny has Photon SDK experience)

### Rules

1. TRAE AI must be primary dev environment
2. At least one MiniMax API integration
3. Start fresh — no pre-built projects (reuse PATTERNS and KNOWLEDGE, not code)
4. Public GitHub repo with commit history
5. Physical check-in by 11 AM PT March 28

### Required Submission

- Project name + tagline
- 2-3 paragraph description
- Demo link
- Description of MiniMax API + TRAE stack usage
- Public GitHub repo with commit history
- Optional: 2-min demo video + 5-slide deck (DO BOTH for presentation score)

***

## Competitive Intelligence

### What Wins MiniMax Hackathons

- **Voice Root won 1st** at AWS x MiniMax (voice assistant + personal context using MiniMax Audio)
- **1/3 of ALL submissions used MiniMax Audio** — voice is THE differentiator
- **Trae judges want multi-agent orchestration + MCP** visible, not just autocomplete
- **"Would I personally use and install this?"** — the judge litmus test (Warren, Atlassian)
- **"The storytelling component is HUGE"** — Karen, Databricks
- Projects that felt like **real products, not demos**

### Direct Competitors (Why We're Different)

- **Sunday** (TreeHacks winner): iMessage concierge for social planning. Sunday = logistics (plan dinner). Nudge = understanding (optimize your day). Sunday is reactive (you ask it to plan). Nudge is proactive (it tells you what to do).
- **Bloom** (TreeHacks winner): Elderly caretaker app. Voice-first, proactive check-ins. We share the proactive philosophy but target a different demographic and use case.
- **Prio** (YC): Morning briefing for founders. Web app. We do it in iMessage with voice — zero friction.
- **Lindy** ($33M raised): Email triage + meeting prep. Dashboard-based. We cross-reference email + calendar + CONVERSATIONS (the missing data source).

### Our Unfair Advantage

1. Johnny built Icarus (full proactive iMessage agent, 269 TS files) and the Companion Agent (14,500 LOC, 22 agent modules). ARCHITECTURE KNOWLEDGE is our edge — we know every pitfall.
2. The two-part Listener/Agent split is novel. No hackathon project we've seen does this.
3. Voice-first output via MiniMax TTS = proven winner pattern.
4. Cross-referencing iMessage conversations + Calendar + Email = the missing link no competitor does.

***

## Technical Architecture

### System Diagram

```
ALL iMessage conversations on Johnny's Mac
        │
        ↓ (Photon Basic iMessage Kit — polls every 2s)
        │
   ┌────┴────────────────────────────────────┐
   │          THE LISTENER                    │
   │                                          │
   │  For every incoming/outgoing message:    │
   │  1. Store raw message (SQLite)           │
   │  2. Entity extraction (MiniMax M2.7):    │
   │     - People mentioned                   │
   │     - Tasks/asks detected                │
   │     - Commitments made                   │
   │     - Meetup plans                       │
   │     - Questions pending                  │
   │     - Sentiment/urgency                  │
   │  3. Cross-reference with:                │
   │     - Google Calendar (Composio)         │
   │     - Gmail (Composio)                   │
   │  4. Update shadow task list              │
   │  5. Update entity/people graph           │
   │  6. Detect proactive triggers            │
   │                                          │
   │  NEVER sends messages to contacts.       │
   │  INVISIBLE.                              │
   └────┬────────────────────────────────────┘
        │
        ↓ (triggers + intelligence)
        │
   ┌────┴────────────────────────────────────┐
   │          THE AGENT                       │
   │                                          │
   │  Communicates ONLY with Johnny via       │
   │  a dedicated iMessage thread.            │
   │                                          │
   │  PROACTIVE (Agent → Johnny):             │
   │  - Morning voice briefing (game plan)    │
   │  - Pre-meeting prep (context from email) │
   │  - Task reminders (from Listener data)   │
   │  - Follow-up nudges                      │
   │  - Schedule optimization suggestions     │
   │  - Urgent email alerts                   │
   │                                          │
   │  REACTIVE (Johnny → Agent):              │
   │  - "what should I focus on right now?"   │
   │  - "summarize my emails"                 │
   │  - "what did Teri ask me yesterday?"     │
   │  - [photo] → Vision → Voice response     │
   │  - "draft a reply to Prof. Kim"          │
   │                                          │
   │  ALL OUTPUT: MiniMax TTS voice notes     │
   │  (with text fallback)                    │
   └──────────────────────────────────────────┘
```

### Tech Stack

| Layer                   | Tool                                 | Why                                                                                       |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **iMessage Bridge**     | @photon-ai/imessage-kit (Basic) v2.x | Local SDK, polls chat.db, sends text + audio + image attachments. Runs on Johnny's Mac.   |
| **Runtime**             | Bun or Node.js 18+                   | Bun preferred (zero deps for iMessage kit). TypeScript.                                   |
| **LLM Reasoning**       | MiniMax M2.7                         | Hackathon requirement. 204K context, tool calling, JSON mode. OpenAI-compatible endpoint. |
| **Voice Output**        | MiniMax Speech 2.8 TTS               | 7 emotions, 40 languages, voice selection. Generates .m4a → sent as iMessage attachment.  |
| **Photo Understanding** | MiniMax Vision                       | Receives image attachments → analyzes → feeds to M2.7 for reasoning.                      |
| **Calendar**            | Composio → Google Calendar           | OAuth managed. Pull events, conflicts, free blocks, attendees.                            |
| **Email**               | Composio → Gmail                     | OAuth managed. Pull unread, urgent, threads, action items.                                |
| **Database**            | SQLite (better-sqlite3)              | Messages, entities, tasks, commitments, patterns. Local, zero ops.                        |
| **Dev Environment**     | TRAE AI                              | Required. Use for all coding. Show MCP integration in commits.                            |
| **MCP**                 | MiniMax MCP Server (uvx minimax-mcp) | Wire MiniMax tools into TRAE agent mode for dev workflow showcase.                        |

### MiniMax API Configuration

```
MINIMAX_API_KEY=<from hackathon form>
MINIMAX_API_HOST=https://api.minimax.io

# Text — OpenAI-compatible endpoint
Model: MiniMax-M2.7
Endpoint: https://api.minimax.io/v1/chat/completions
Supports: tool calling, JSON mode, 204K context

# TTS — Speech 2.8
Model: speech-2.8-turbo (low latency) or speech-2.8-hd (quality)
Emotions: neutral, happy, sad, angry, fearful, disgusted, surprised
Languages: 40+ (including Korean for Teri demo)
Output: audio file (.m4a or .mp3)

# Vision
Input: image file or base64
Output: text description/analysis
```

### Composio Configuration

```
COMPOSIO_API_KEY=<from composio.dev>

# One OAuth flow connects:
- GOOGLECALENDAR_FIND_EVENT / GOOGLECALENDAR_LIST_EVENTS
- GMAIL_FETCH_EMAILS / GMAIL_GET_THREAD

# Pattern (from Icarus codebase):
import { Composio } from "composio-core";
const composio = new Composio({ apiKey });
const entity = composio.getEntity(userId);
const events = await entity.execute({ actionName: "GOOGLECALENDAR_LIST_EVENTS", params: { calendarId: "primary", timeMin, timeMax } });
```

### Basic iMessage Kit Usage

```typescript
import { IMessageSDK } from "@photon-ai/imessage-kit";

const sdk = new IMessageSDK();

// Watch ALL conversations (The Listener)
await sdk.startWatching({
  onNewMessage: async (msg) => {
    // msg.text — message content
    // msg.sender — who sent it
    // msg.chatId — which conversation
    // msg.attachments — photos, files, audio
    await listenerProcess(msg);
  }
});

// Send text (The Agent → Johnny)
await sdk.send(JOHNNY_PHONE, "here's your task queue for today...");

// Send voice note (MiniMax TTS → file → iMessage)
const audioPath = await generateTTS("here's your game plan...", "happy");
await sdk.send(JOHNNY_PHONE, { files: [audioPath] });

// Send with text + audio
await sdk.send(JOHNNY_PHONE, { text: "morning briefing:", files: [audioPath] });

// Receive photo (from msg.attachments)
// → Send to MiniMax Vision → Get analysis → Generate TTS → Send audio response
```

***

## Feature Specification

### The Listener — Feature Details

**L1: Message Ingestion**

- Watch all incoming AND outgoing iMessages via Basic Kit polling
- Store every message: sender, recipient, content, timestamp, chat\_id, attachments
- Filter out system messages, read receipts, delivery notifications

**L2: Entity Extraction (MiniMax M2.7)**
For each message (or batched group of messages), extract:

- **People:** names mentioned, contact references
- **Tasks/Asks:** "can you send me X", "please review Y", "don't forget to Z"
- **Commitments:** "I'll do X", "I'll be there at Y", "let me get back to you"
- **Meetup Plans:** date/time/place mentions, "dinner Saturday?", "coffee Tuesday?"
- **Questions Pending:** questions asked TO the user that haven't been answered
- **Deadlines:** explicit dates, "by Friday", "before the meeting"
- **Sentiment/Urgency:** is this urgent? is someone frustrated? is this casual?

Extraction prompt pattern:

```
You are analyzing iMessage conversations to extract actionable intelligence.
Given the following messages, extract:
1. TASKS: things the user needs to do (who asked, what, when)
2. COMMITMENTS: things the user promised (to whom, what, when)
3. MEETUPS: planned or proposed gatherings (who, when, where)
4. PENDING_QUESTIONS: questions asked to the user without answers yet
5. DEADLINES: any time-sensitive items
6. URGENCY: rate 1-5

Return as JSON. Be specific. Include the person's name and the exact ask.
```

**L3: Calendar Cross-Reference**

- Pull today's + tomorrow's events from Google Calendar (Composio)
- For each extracted meetup plan → check calendar for conflicts
- For each calendar event → check if there are related email threads
- Detect: unprepped meetings, double-bookings, free blocks available for tasks

**L4: Email Cross-Reference**

- Pull recent unread/important emails from Gmail (Composio)
- Match email threads to people mentioned in conversations
- Extract action items from emails (same M2.7 extraction prompt)
- Detect: unanswered emails, approaching deadlines, related threads

**L5: Shadow Task List**
Maintain a running prioritized task list in SQLite:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  source TEXT,           -- 'imessage', 'email', 'calendar'
  source_id TEXT,        -- message_id or email_id
  task TEXT,             -- the actual task description
  assigned_by TEXT,      -- who asked (person name)
  deadline TEXT,         -- when it's due (if known)
  urgency INTEGER,       -- 1-5
  status TEXT,           -- 'pending', 'reminded', 'done'
  created_at TEXT,
  updated_at TEXT
);
```

**L6: Proactive Trigger Detection**
The Listener detects when to alert the Agent:

- New urgent task extracted → trigger Agent to notify
- Calendar event in 15 min + unprepped → trigger pre-meeting brief
- Commitment deadline approaching → trigger reminder
- Unanswered question older than 24h → trigger follow-up nudge
- Pattern: 3+ tasks from same person → trigger "you have a backlog with X"

### The Agent — Feature Details

**A1: Morning Voice Briefing (Proactive)**
Trigger: Scheduled, every morning (configurable time, default 8am)
Content:

- Today's calendar events (count, key meetings, free blocks)
- Overnight tasks extracted by Listener (new asks, commitments)
- Urgency-ranked task queue: "here's what I'd focus on today"
- Optimal sequencing: "do X during your 10am gap, Y after your 2pm meeting"
  Output: MiniMax TTS voice note (emotion: energized/neutral) + text summary

**A2: Pre-Meeting Prep (Proactive)**
Trigger: 15 minutes before any calendar event
Content:

- What the meeting is about (from calendar event description)
- Related email threads (from Gmail cross-reference)
- What the person asked/discussed recently (from Listener's conversation data)
- Suggested prep: "Sarah emailed about the budget review — you haven't replied yet"
  Output: MiniMax TTS voice note (emotion: neutral/calm)

**A3: Task Queue (Reactive + Proactive)**
Reactive: User texts "what should I do right now?" or "what's on my plate?"
Proactive: Sent after morning briefing, updated mid-day if priorities shift
Content:

- All pending tasks ranked by urgency + deadline
- Source attribution ("Kayla asked in GC", "Prof. Kim emailed", "you promised Sarah")
- Time estimates and scheduling suggestions
- Calendar-aware: "you have a 2-hour block before your 3pm — I'd tackle the deck"
  Output: MiniMax TTS voice note + structured text list

**A4: Follow-Up Nudges (Proactive)**
Trigger: Commitment deadline approaching, or 24h+ since unanswered question
Content:

- "you told Kayla you'd send the deck yesterday. want me to draft a message?"
- "Prof. Kim's email from Tuesday is still unanswered. the deadline is Friday."
- "you had coffee with Sarah 2 days ago — want to send a thank-you?"
  Output: MiniMax TTS voice note with suggested action

**A5: Draft Messages (Reactive)**
Trigger: User asks "draft a reply to X" or Agent suggests a draft
Content:

- Agent generates context-aware draft message
- Presents it to user for approval: "here's a draft for Kayla: 'hey! sending the deck over this afternoon, sorry for the delay!' — send it?"
- User replies YES → Agent could send via Basic Kit (if to a known contact) or user copies/pastes
  Output: Text draft for review

**A6: Photo Processing (Reactive)**
Trigger: User sends a photo to the Agent thread
Pipeline: Photo → MiniMax Vision → M2.7 reasoning → MiniMax TTS response
Scenarios:

- Receipt → "that's $32 at Trader Joe's. want me to add grocery tracking to your tasks?"
- Whiteboard → "I see 4 action items: \[list]. want me to add them to your task queue?"
- Korean menu → reads aloud in Korean (MiniMax 40-lang TTS), translates to English
- Screenshot → summarizes content, suggests action
- Document → extracts key points, voice summary
  Output: MiniMax TTS voice note with analysis

**A7: Email Triage (Reactive)**
Trigger: User texts "check my email" or "what emails need attention?"
Content:

- Top urgent/unread emails summarized
- Action items extracted
- Draft replies suggested
- Cross-referenced with calendar ("this email is about your Thursday meeting")
  Output: MiniMax TTS voice note + text list

**A8: Schedule Optimization (Reactive + Proactive)**
Trigger: User texts "optimize my week" or Agent detects scheduling opportunity
Content:

- Maps all tasks against calendar free blocks
- Suggests optimal sequencing
- Identifies conflicts and proposes resolutions
- "you said yes to dinner Saturday and brunch Sunday. I'd confirm dinner tonight and push brunch to 11:30 so you're not rushed"
  Output: MiniMax TTS voice note with proposed schedule

***

## Design Principles (Verbatim from Research)

### From Icarus Vision

> "You are the best company you'll ever get to run in your entire life. Our goal is to help you run that company to your best ability."

> "Companies spend billions collecting data about humans. The question underneath: why shouldn't YOU have your own context about your own life, working for you?"

> "Not a chatbot. Not a dashboard. The surprise IS the product."

> "Proactive over reactive. We text you, you don't prompt us."

> "If two users get the same message, something is broken."

### From SOTARE Philosophy

> "Everything the system does = learning. Every message triggers capture → interpret → act → measure."

> "The gap between what the agent THINKS was useful and what ACTUALLY was useful = the learning signal."

> "Save everything. Compress the best. Patterns emerge when looking backward."

> "1-3 human decisions per day, rest autonomous."

> "Each layer wraps the previous. Start simple, add complexity as layers."

### From Companion Agent

- **Anti-LLM validation:** No "I'd be happy to help!", no "Let me know if you need anything else!", no "Furthermore,", no "Great question!" — the agent texts like a friend, not a corporate chatbot
- **Banned words list:** Furthermore, Additionally, I'd be happy to, Let me know, Great question, Absolutely, I understand, Rest assured
- **Max 120 words per message.** If longer, split into multiple bubbles.
- **Match conversational energy.** Casual text → casual response. Urgent text → direct response.
- **Never use emojis unless the user does first.**

### From Teri Shim's Design Philosophy

> "Empathy as infrastructure — not a feature, the operating principle."

> "Hide the AI behind guided UX, not chatbots."

> "Effort fidelity, not visual fidelity — make it FEEL real fast."

> "Context is the moat — personal patterns make the agent valuable."

> "The gap IS the product — difference between AI generic and AI personal."

### From Hackathon Winner Analysis

- **Personality > Capability.** Sunday spent 5 prompt revisions on tone. Bloom spent money on voice quality.
- **Memory = the moat.** "When it remembers Sarah is gluten-free from 3 weeks ago, it stops being a tool."
- **15 hours on problem before code.** Bloom barely coded until 15hrs in.
- **"Would I personally use and install this?"** — the judge litmus test.
- **Voice is THE differentiator** at MiniMax hackathons. 1/3 of AWS x MiniMax submissions used audio.

***

## Personality Specification

**Name:** Nudge
**Voice:** Like a sharp, slightly irreverent executive assistant who genuinely gives a shit. Not corporate. Not sycophantic. Direct, concise, occasionally funny. Texts lowercase unless emphasizing something.

**Example proactive morning briefing:**

> "morning. you've got 3 things today: standup at 10, meeting with sarah at 2, and the hackathon demo at 8. the sarah meeting — she emailed about the budget twice and you still haven't replied. i'd knock that out before 2. your 10am gap is perfect for it. also teri asked for the design feedback in the gc yesterday, still pending. that can wait until tomorrow tho."

**Example task nudge:**

> "hey — you told kayla you'd send the deck 2 days ago. she hasn't followed up but it's hanging. want me to draft something?"

**Example photo response (receipt):**

> \[voice note] "32 bucks at trader joe's. snacks for the hackathon?"

**Example photo response (Korean menu):**

> \[voice note in Korean] "비빔밥 — 만 이천원..." \[switches to English] "that's bibimbap, 12,000 won. the kimchi jjigae is 9,000 won and it's usually the better deal at places like this."

**What it NEVER does:**

- Never says "I'd be happy to help" or any LLM-ism
- Never sends unprompted messages to the user's contacts
- Never shares data from one person's conversations with another
- Never sends more than 3 proactive messages per hour
- Never sends proactive messages during quiet hours (11pm-7am)
- Never presents raw data — always synthesized into action

***

## Database Schema

```sql
-- Messages (Listener stores all observed messages)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT,
  timestamp TEXT NOT NULL,
  direction TEXT NOT NULL,  -- 'inbound' or 'outbound' (from Johnny's perspective)
  has_attachment BOOLEAN DEFAULT FALSE,
  attachment_type TEXT,     -- 'image', 'audio', 'file'
  attachment_path TEXT,
  processed BOOLEAN DEFAULT FALSE
);

-- Tasks (extracted by Listener)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,      -- 'imessage', 'email', 'calendar'
  source_ref TEXT,           -- message_id, email_id, event_id
  description TEXT NOT NULL,
  assigned_by TEXT,          -- person who asked
  assigned_to TEXT,          -- usually 'self'
  deadline TEXT,
  urgency INTEGER DEFAULT 3, -- 1-5
  status TEXT DEFAULT 'pending', -- 'pending', 'reminded', 'done', 'dismissed'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- People (entity graph)
CREATE TABLE people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  last_contact TEXT,
  relationship_context TEXT, -- what we know about them
  open_tasks INTEGER DEFAULT 0
);

-- Agent conversation (Agent ↔ Johnny thread)
CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,  -- 'agent_to_user' or 'user_to_agent'
  content TEXT NOT NULL,
  message_type TEXT,        -- 'briefing', 'task_nudge', 'photo_response', 'query_response', 'draft'
  audio_path TEXT,          -- path to TTS audio file if voice note
  timestamp TEXT NOT NULL
);

-- Proactive message log (for anti-repetition + rate limiting)
CREATE TABLE proactive_log (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL, -- 'morning_brief', 'pre_meeting', 'task_nudge', 'follow_up'
  content_hash TEXT NOT NULL, -- for anti-repetition
  sent_at TEXT NOT NULL
);
```

***

## Implementation Plan (8 Hours)

### Phase 1: Foundation (2 hours)

**1.1 Project Setup (30 min)**

- Create fresh GitHub repo
- Initialize with Bun + TypeScript
- Install dependencies: @photon-ai/imessage-kit, better-sqlite3, composio-core, openai (for MiniMax OpenAI-compatible API), uuid, dotenv
- Set up .env with MINIMAX\_API\_KEY, MINIMAX\_API\_HOST, COMPOSIO\_API\_KEY
- Initialize SQLite database with schema above
- First commit in TRAE AI (screenshot for submission)

**1.2 iMessage Kit Connection (30 min)**

- Connect Basic iMessage Kit
- Verify: can read incoming messages via startWatching
- Verify: can send text messages via sdk.send()
- Verify: can send file attachments via sdk.send({files: \[path]})
- Set up message routing: separate Listener messages (all chats) from Agent messages (dedicated thread)

**1.3 MiniMax API Integration (30 min)**

- Set up MiniMax M2.7 text generation (OpenAI-compatible client)
- Test: send prompt → get response
- Set up MiniMax TTS: text → audio file (.m4a)
- Test: generate voice note → save to file → send via iMessage
- Set up MiniMax Vision: image → analysis
- Test: receive photo → send to Vision API → get description

**1.4 Basic Message Loop (30 min)**

- Listener: watch all messages, store in SQLite
- Agent: detect messages in dedicated thread, route to M2.7, respond
- Voice: Agent responses generated as TTS audio → sent as file attachment
- Photo: detect image attachment → Vision API → M2.7 → TTS → send audio response

### Phase 2: Intelligence (2 hours)

**2.1 Composio Integration (45 min)**

- Set up Composio client with API key
- Implement Google Calendar pull: today's events, tomorrow's events, free blocks
- Implement Gmail pull: unread emails, urgent threads, action items
- Test: pull real calendar data, pull real email data
- OAuth flow: ensure Johnny's Google account connected

**2.2 Listener Intelligence (45 min)**

- Implement entity extraction prompt (M2.7): messages → tasks, commitments, meetups, questions
- Process incoming messages in batches (every 30 seconds, batch unprocessed)
- Store extracted entities in tasks table and people table
- Cross-reference: for each extracted task, check calendar for related events
- Cross-reference: for each calendar event, check Gmail for related threads

**2.3 Agent Context Assembly (30 min)**

- Build context assembly function: pull from tasks table + calendar + email + recent messages
- Inject context into Agent's M2.7 system prompt
- Test: ask Agent "what's on my plate?" → get context-aware response with voice

### Phase 3: Proactivity (2 hours)

**3.1 Calendar Watcher (30 min)**

- Poll Google Calendar every 5 minutes
- Detect: event starting in 15 min → trigger pre-meeting prep
- Detect: morning time → trigger morning briefing
- Detect: end of day → trigger evening summary

**3.2 Email Watcher (30 min)**

- Poll Gmail every 10 minutes
- Detect: new urgent email → trigger notification
- Detect: email from person with open task → trigger cross-reference alert
- Detect: unanswered email older than 24h → trigger reminder

**3.3 Proactive Delivery Pipeline (30 min)**

- Implement rate limiter: max 3 messages per hour
- Implement quiet hours: no messages 11pm-7am
- Implement anti-repetition: hash content, skip if sent within 48h
- Implement notification scoring: urgency \* deadline\_proximity \* relevance

**3.4 Morning Briefing Generator (30 min)**

- Pull: today's calendar events + task queue + overnight emails + Listener extractions
- Generate: optimized day plan with M2.7 (what to do, when, in what order)
- Format: concise, personality-matched text
- Deliver: MiniMax TTS → voice note + text fallback → send to Agent thread

### Phase 4: Polish + Demo (2 hours)

**4.1 Personality Tuning (30 min)**

- Refine system prompt with banned words list
- Test: 10 sample conversations, verify no LLM-isms
- Test: photo responses sound natural
- Test: proactive messages feel helpful, not nagging
- Teri reviews personality and provides feedback

**4.2 Demo Preparation (30 min)**

- Script the 3-minute demo flow
- Pre-seed some conversations so Listener has data
- Test: morning briefing plays correctly
- Test: photo of Korean menu → Korean voice response works
- Test: task extraction from real texts works

**4.3 Demo Video (30 min)**

- Record 2-minute demo video showing:
  1. Proactive morning voice briefing
  2. "What should I focus on?" → voice response with optimized task queue
  3. Photo of receipt → voice analysis
  4. Photo of Korean menu → Korean + English voice response
  5. Follow-up nudge for overdue task
- Edit with clear narration

**4.4 Submission (30 min)**

- Create 5-slide deck:
  1. Problem (scattered tasks, 30 apps, attention tax)
  2. Solution (Listener + Agent, two-part architecture)
  3. Demo screenshot (iMessage conversation with voice notes)
  4. Architecture (system diagram)
  5. Team + Vision (Johnny + Teri, what's next)
- Write Devpost submission: name, tagline, 2-3 paragraphs, MiniMax usage description
- Push final code to GitHub
- Verify commit history shows TRAE AI usage
- Submit on Devpost

***

## Demo Script (3 minutes)

**0:00 — Hook**
"Your calendar knows when. Your email knows what. Your texts know who. But nothing cross-references them and tells you what to do RIGHT NOW. That's Nudge."

**0:15 — Two-Part Architecture**
"Nudge has two parts. The Listener silently watches all your iMessage conversations — extracting tasks, asks, and commitments. The Agent takes that intelligence, combines it with your calendar and email, and sends you proactive voice briefings."

**0:30 — Morning Briefing (pre-recorded or live)**
\[Play voice note on phone]
"morning. 3 things today — standup at 10, sarah meeting at 2, demo at 8. sarah emailed about the budget twice and you haven't replied. knock that out during your 10am gap before you see her. also teri needs the design feedback from the gc — that can wait until tomorrow."

**0:55 — Live Interaction**
Teri texts: "what's on my plate right now?"
Agent responds with voice note: "you've got 4 pending tasks. highest priority: reply to sarah's budget email — deadline's today. then the deck kayla asked for. the other two can wait."

**1:20 — Photo Intelligence**
Teri sends photo of a receipt.
Agent responds: \[voice] "47 bucks at sweetgreen. third time this week — you're on track to spend 200 on salads this month."
\[Audience laughs]

**1:40 — Korean Menu (The Wow Moment)**
Teri sends photo of Korean menu.
Agent responds: \[voice in Korean] "비빔밥, 만 이천원..." \[English] "bibimbap, 12,000 won. the japchae is 10,000 and it's the better deal."
\[Audience reacts]

**2:00 — Follow-Up Intelligence**
Show the Listener in action: "The Listener noticed that 3 people asked me things in group chats today. It extracted the tasks, cross-referenced with my calendar, and the Agent told me when to handle each one."

**2:15 — Architecture Slide**
"Two-part system. Listener + Agent. Powered by MiniMax M2.7 for reasoning, Speech 2.8 for voice, and Vision for photos. Calendar and email via Composio. Built entirely in TRAE AI in 8 hours."

**2:30 — Closer**
"Every app collects data about you for themselves. Nudge cross-references it all and gives it back to you — in voice, before you ask. No app. No dashboard. Just your texts, made intelligent."

***

## File Structure

```
nudge/
├── package.json
├── tsconfig.json
├── .env                    # API keys (DO NOT COMMIT)
├── .env.example            # Template
├── src/
│   ├── index.ts            # Entry point — starts Listener + Agent + watchers
│   ├── config.ts           # Environment variables + constants
│   │
│   ├── listener/
│   │   ├── watcher.ts      # iMessage Kit startWatching, message ingestion
│   │   ├── extractor.ts    # M2.7 entity extraction (tasks, people, commitments)
│   │   ├── crossref.ts     # Calendar + email cross-referencing
│   │   └── triggers.ts     # Proactive trigger detection
│   │
│   ├── agent/
│   │   ├── router.ts       # Message routing (text vs photo vs command)
│   │   ├── responder.ts    # M2.7 response generation with context
│   │   ├── proactive.ts    # Scheduled proactive messages (morning, pre-meeting)
│   │   ├── pipeline.ts     # Delivery pipeline (rate limit, quiet hours, anti-repeat)
│   │   └── personality.ts  # System prompt, banned words, style rules
│   │
│   ├── integrations/
│   │   ├── composio.ts     # Composio client setup
│   │   ├── calendar.ts     # Google Calendar pull + analysis
│   │   └── gmail.ts        # Gmail pull + triage
│   │
│   ├── minimax/
│   │   ├── client.ts       # MiniMax M2.7 text generation (OpenAI-compatible)
│   │   ├── tts.ts          # MiniMax Speech 2.8 TTS → audio file
│   │   └── vision.ts       # MiniMax Vision → image analysis
│   │
│   ├── memory/
│   │   ├── db.ts           # SQLite setup + prepared queries
│   │   ├── tasks.ts        # Task CRUD + priority ranking
│   │   ├── people.ts       # People/entity CRUD
│   │   └── messages.ts     # Message storage + retrieval
│   │
│   └── utils/
│       ├── time.ts         # Quiet hours, scheduling helpers
│       └── hash.ts         # Content hashing for anti-repetition
│
├── data/
│   └── nudge.db            # SQLite database (gitignored)
│
└── assets/
    └── audio/              # Generated TTS files (gitignored)
```

***

## Environment Variables

```bash
# MiniMax
MINIMAX_API_KEY=           # From hackathon form
MINIMAX_API_HOST=https://api.minimax.io

# Composio
COMPOSIO_API_KEY=          # From composio.dev

# iMessage
AGENT_THREAD_ID=           # Chat ID of the Agent ↔ Johnny thread

# Configuration
QUIET_HOURS_START=23       # 11pm
QUIET_HOURS_END=7          # 7am
MAX_PROACTIVE_PER_HOUR=3
MORNING_BRIEFING_HOUR=8
PRE_MEETING_MINUTES=15
CALENDAR_POLL_INTERVAL=300000   # 5 min
EMAIL_POLL_INTERVAL=600000      # 10 min
MESSAGE_BATCH_INTERVAL=30000    # 30 sec
```

***

## Key Risk Mitigations

| Risk                         | Likelihood | Mitigation                                                                                                                  |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| MiniMax M2.7 quality/latency | Medium     | Test early. Have system prompt tuned for M2.7 specifically. If too slow, use M2.7-highspeed.                                |
| MiniMax TTS audio quality    | Medium     | Test speech-2.8-turbo first, fall back to speech-2.8-hd. Test Korean specifically for demo.                                 |
| Composio OAuth flow          | Medium     | Set up OAuth FIRST before any code. Pre-connect Johnny's Google account.                                                    |
| Listener extraction accuracy | Medium     | Start with simple keyword extraction, layer M2.7 extraction on top. Don't over-engineer.                                    |
| Scope creep                  | High       | This PRD is the scope. Phase 1-4 only. No features beyond what's specified here.                                            |
| Basic Kit audio playback     | Low        | Audio files sent via send({files: \[]}) may not auto-play like native voice notes. Acceptable for demo — user taps to play. |
| "Start Fresh" rule           | Low        | All code is new. Architecture KNOWLEDGE from Icarus/Companion is reused, not code.                                          |

***

## Success Criteria

The project is done when:

1. Listener watches iMessage conversations and extracts tasks/commits/asks into SQLite
2. Agent responds to messages in dedicated thread with context-aware voice notes
3. Photos sent to Agent → Vision → Voice response works
4. Calendar + Email integration provides real data in Agent responses
5. At least one proactive message (morning briefing) sends automatically
6. Demo video recorded and submitted
7. Devpost submission complete with all required fields
8. GitHub repo has clean commit history showing TRAE AI usage

