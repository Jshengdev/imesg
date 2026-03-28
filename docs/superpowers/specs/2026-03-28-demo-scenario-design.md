# Nudge Demo Scenario — Student Day

## Overview

A 2-minute screen recording showing a college student's day managed by Nudge. Real data from real people (friends send test emails, texts, calendar events). The demo shows Nudge going from stranger to indispensable in one continuous arc — extracting tasks from conversations, reading photos, drafting replies, ranking priorities against calendar gaps, and proactively surfacing the right info at the right time without being asked.

**Core thesis:** Nudge reorganizes your priorities using your Gmail, Calendar, and what people text you — all without you explicitly telling it to save anything.

---

## Demo Commands

Five slash commands for demo control. These are harness, not user features.

### `/demo`

Pre-loads real calendar + email data in background and auto-connects OAuth (no link clicking needed). The user still goes through the full bouncer onboarding naturally. When the bouncer approves, the reveal fires instantly with real data already cached — no cold start.

**Behavior:**
1. Set a module-level `demoMode = true` flag
2. Register user immediately with `onboard_stage: 'new'`
3. Kick off background fetch: `analyzeCalendar(phone)` + `analyzeGmail(phone)` — cache results in memory
4. When `demoMode` is true, `checkUserConnected()` returns `{ gmail: true, calendar: true }` without checking Composio (the real OAuth must already be done on this phone before the demo)
5. Bouncer proceeds normally — user still chats through it
6. On `VERDICT: APPROVED`, handler sees connections are "ready" → skips `waiting_oauth` → goes straight to reveal using pre-cached data
7. Set `onboard_stage: 'active'`

**Pre-requisite:** OAuth for Gmail + Calendar must already be completed for this phone number before demo day. `/demo` doesn't create OAuth connections — it just skips the check-and-wait loop.

### `/time HH:MM`

Sets a virtual clock. All proactive trigger evaluations, temporal voice, and "right now" context use this time instead of `Date.now()`. Enables fast-forwarding through a day during recording.

**Behavior:**
1. Parse `HH:MM` into a virtual timestamp for today's date
2. Store in a module-level `virtualTime` variable
3. Export a `now()` function that returns `virtualTime ?? Date.now()`
4. All code that currently calls `new Date()` or `Date.now()` for time-of-day logic uses `now()` instead
5. After setting time, immediately run the proactive decision engine for all active users
6. Send confirmation: "time set to 4:00 pm" (in nudge voice)

### `/important`

On-demand housekeeping scan. Reads current emails, cross-refs against task list and calendar, flags contradictions or pressing changes to the plan.

**Behavior:**
1. Pull latest emails + calendar + task queue
2. Run cross-reference analysis (existing `crossref.ts` logic)
3. Compare against current task priorities — has anything changed?
4. LLM synthesizes: what's new, what contradicts, what needs attention now
5. Send result as proactive-style message

### `/priority`

Runs the task ranking engine. Returns a prioritized plan: what to do, in what order, estimated time, mapped to calendar gaps. Offers to block calendar time.

**Behavior:**
1. Pull task queue + calendar events + free blocks
2. Run task ranking engine (see Task Ranking Engine section)
3. LLM formats as a natural plan: "you've got a 2hr gap at 4. hit the writeup first (45min), then the reading (30min). want me to block those?"
4. If user confirms → create calendar events via Composio

### `/poll`

Forces all three input channels to check for new data and run through the proactive decision engine.

**Behavior:**
1. Run message extraction on any unprocessed messages
2. Pull new emails since last check
3. Pull calendar updates
4. Feed all new data through the proactive decision engine
5. Engine decides: send proactive message, update tasks, stay silent, or suggest calendar blocks

---

## Proactive Decision Engine

Replaces the current 9 independent interval-based triggers with a unified decision-making loop.

### Architecture

```
New data arrives (text / email poll / calendar poll / /poll / /time)
  ↓
Assemble current snapshot:
  - task queue (ranked)
  - calendar (events + free blocks)
  - virtual time (or real time)
  - recent conversation (what did we just talk about?)
  - what changed since last evaluation
  ↓
LLM Decision Gate:
  - urgency score (1-10): how pressing is this new info?
  - disruption score (1-10): how busy is the user right now?
  - action: "send", "queue", "update_tasks", "suggest_block"
  ↓
urgency > disruption → act (send message, suggest block, etc.)
urgency ≤ disruption → queue silently for next evaluation
```

### Input Channels

| Channel | Trigger | What it feeds |
|---------|---------|---------------|
| Message listener | Real-time (on incoming iMessage) | Extractor pulls tasks/people → engine evaluates |
| Email poller | Interval (10min) or `/poll` | New unread emails → triage → engine evaluates |
| Calendar poller | Interval (5min) or `/poll` | Event changes, approaching meetings → engine evaluates |
| Virtual time | `/time HH:MM` | Time change → re-evaluate all scheduled triggers |

### Decision Outputs

The engine can decide to:
1. **Send proactive text** — surface a connection, alert about deadline, prep for meeting
2. **Stay silent** — user is busy, info isn't urgent enough to interrupt
3. **Update task list** — new email changes a deadline, mark task as blocked, re-rank
4. **Suggest calendar block** — "want me to block 4-5:30 for the writeup?"
5. **Queue for later** — interesting but not time-sensitive, surface during next gap

### Replacing Current Triggers

The 9 current triggers become **evaluation contexts** within the engine, not independent timers:

| Old trigger | New behavior |
|-------------|-------------|
| Morning briefing | Engine fires when `/time` hits morning hour, or on real schedule |
| EOD review | Engine fires at EOD time |
| Pre-meeting prep | Engine detects meeting within threshold of current time |
| Task nudge | Engine notices high-urgency tasks during free blocks |
| Email alert | Engine evaluates on email poll results |
| Email escalation | Engine detects repeat-sender pattern |
| Schedule optimizer | Engine matches tasks to free blocks during ranking |
| Follow-up reminder | Engine detects recently ended meetings |
| Cross-source pairing | Engine cross-refs attendees against emails/tasks |

---

## Task Ranking Engine

Upgrades the current simple urgency integer (1-5) into a multi-dimensional ranking system.

### Task Schema Extensions

Add to the existing `tasks` table:

| Field | Type | Description |
|-------|------|-------------|
| `estimated_minutes` | INTEGER | LLM-inferred time to complete (15, 30, 45, 60, 90, 120) |
| `effort_level` | TEXT | 'quick' (< 15min), 'focused' (15-60min), 'deep' (60min+) |
| `environment` | TEXT | 'anywhere' (phone ok), 'computer', 'in-person', 'specific-location' |
| `depends_on` | TEXT | Comma-separated task IDs this task is blocked by |
| `deadline_source` | TEXT | Where the deadline came from: 'explicit', 'inferred', 'professor', 'teammate' |
| `deadline_confidence` | TEXT | 'hard' (professor said tomorrow), 'soft' (teammate implied soon), 'inferred' |
| `completed_at` | TEXT | Timestamp when marked done (null if open) |

### Ranking Algorithm

Score each task, sort descending:

```
score = (urgency * 3)                          // existing 1-5, weighted heavily
      + (deadline_proximity * 2)               // hours until deadline, inverted
      + (calendar_fit * 1.5)                   // does it fit in the next free block?
      + (dependency_clear * 1)                 // are its blockers resolved?
      + (cross_source_mentions * 0.5)          // mentioned by multiple people/sources
```

**deadline_proximity:** Hard deadlines within 24hr get max score. Soft deadlines decay slower. No deadline = baseline.

**calendar_fit:** If the task's `estimated_minutes` fits in the next free block AND its `environment` matches (anywhere or computer), it gets a boost.

**dependency_clear:** Tasks with unresolved `depends_on` get penalized to zero — they can't be done yet.

### Task Lifecycle

```
Extracted (from text/email/photo)
  ↓ LLM infers: time estimate, effort, environment, deadline, dependencies
Task created (status: open)
  ↓ Ranked against other tasks + calendar
  ↓ User asks "what should i do" or /priority → see ranked list
  ↓ User completes: "done with the reading"
Task completed (status: done, completed_at set)
  ↓ Engine re-ranks remaining tasks
  ↓ Unblocks dependent tasks
  ↓ If all subtasks of a parent done → surface that too
```

**Auto-extraction:** Tasks are created from:
- iMessages (extractor picks up "can you do X by Friday")
- Emails (professor says "assignment due tomorrow")
- Photos (user sends photo of assignment sheet → vision reads it → creates tasks)
- User explicitly says "remind me to X"

**Completion detection:** User says "done with X" or "finished the reading" → LLM matches to open task → marks complete → re-ranks.

**Staleness:** Tasks older than 7 days with no activity get flagged: "still on this or should i drop it?"

---

## New Tool: Block Calendar Time

Add to existing tool definitions in `tools.ts`.

### Tool Definition

```
block_calendar_time
  description: block time on the user's calendar for a task
  params:
    title: string — event title (usually task description)
    start_time: string — ISO datetime
    duration_minutes: number — how long to block
```

### Implementation

Uses Composio `GOOGLECALENDAR_CREATE_EVENT` (with fallback strategies like other Composio calls). Creates a calendar event with:
- Title: task description
- Duration: estimated_minutes from task
- Description: "Blocked by Nudge — {task description}"
- No attendees (focus block)

---

## Demo Scenario Script

### Setup (before recording)

Have friends prepare:

**Emails (from a friend acting as professor + teammate):**
1. Professor Kim: "CS 301 Final Project — reminder that your group writeup is due tomorrow by 11:59pm. Make sure all team members have contributed."
2. Teammate Sarah: "hey did you see kim's email? i finished my section, can you review it? also we need the data analysis part"
3. Mom: "Don't forget dinner Thursday! Also did you pay rent?"

**Calendar events (create manually):**
- 9:00-10:15 — CS 301 Lecture
- 10:30-11:30 — Office Hours (Prof Kim)
- 12:00-12:30 — Lunch w/ Sarah
- 4:00-6:00 — FREE (this is the gap)
- 6:30-7:30 — Study Group

**iMessages (friends send during recording):**
- Teammate Sarah: "hey have u started the data analysis part yet? kim just emailed and its due tmrw"
- Mom: "call me when you get a chance honey"

**Photo:**
- A screenshot or photo of the assignment rubric showing: writeup (40%), data analysis (30%), presentation (30%), due dates

### Recording Script

| Timestamp | Action | What Nudge does | Feature shown |
|-----------|--------|-----------------|---------------|
| 0:00-0:15 | Text Nudge. Bouncer: "who dis". Quick back-and-forth, name confirmed. | Gatekeeping personality, approves user. | Onboarding, personality |
| 0:15-0:30 | `/demo` already ran. Bouncer approves → reveal fires. | "so ur in cs 301 with kim... and sarah's been blowing up ur inbox" | Email + calendar awareness, cross-source |
| 0:30-0:45 | Sarah texts: "hey have u started the data analysis part yet?" | Nudge extracts task, connects to professor's email: "sarah's asking about the analysis part — kim wants the writeup by tomorrow 11:59. u have a gap at 4, want me to block it?" | Auto task extraction, cross-source pairing, calendar gap detection |
| 0:45-1:00 | User: "yeah block it" | Nudge blocks 4:00-5:30 on calendar: "blocked. also ur mom texted — not urgent, queue that for after study group?" | Calendar blocking, priority triage |
| 1:00-1:15 | User sends photo of assignment rubric | Nudge reads it: "writeup 40%, analysis 30%, presentation 30%... analysis is the bottleneck since sarah's waiting on u" | Vision, task creation from photo |
| 1:15-1:30 | User: "what should i do first?" or `/priority` | Ranked plan: "1. data analysis (sarah's blocked on u, 45min) 2. review sarah's section (15min) 3. writeup contributions (30min). presentation can wait — not due til next week. all fits in ur 4-5:30 block" | Task ranking engine |
| 1:30-1:45 | User: "draft a reply to sarah" | Nudge drafts: "just saw kim's email — gonna knock out the analysis part during my 4pm block, can review ur section after. we're good" | Email drafting with full context |
| 1:45-1:55 | User: "done with the analysis" | "nice. sarah's unblocked now — want me to text her? review her section is next (15min). still on track for 11:59" | Task completion, re-ranking, lifecycle |
| 1:55-2:00 | `/time 18:00` | EOD: "3 of 5 done today. writeup contributions still open — that's ur #1 for tomorrow morning. see u then" | Proactive EOD review, continuity |

---

## Verification Checklist

### Pre-Demo Verification

Run each of these before recording. Every check must pass.

**1. Onboarding Flow**
- [ ] `/reset` clears everything
- [ ] New text triggers bouncer ("who dis")
- [ ] 2-3 exchanges → VERDICT: APPROVED
- [ ] Profile extracted (name, what they do)
- [ ] `/demo` pre-caches data, skips OAuth wait
- [ ] Reveal references real email senders + calendar events by name

**2. Data Ingestion**
- [ ] Real emails pulled via Composio (professor, teammate, mom)
- [ ] Real calendar events pulled (CS 301, Office Hours, Lunch, Study Group)
- [ ] Incoming iMessage from Sarah captured and stored
- [ ] Extractor creates task from Sarah's text
- [ ] Photo analyzed by vision, tasks created from rubric

**3. Task System**
- [ ] Tasks created with: description, estimated_minutes, effort_level, environment, deadline, source
- [ ] `/priority` returns ranked list mapped to calendar gaps
- [ ] "done with X" marks task complete, re-ranks remaining
- [ ] Dependent tasks unblock when blockers complete
- [ ] Completed tasks show `completed_at` timestamp

**4. Proactive Decision Engine**
- [ ] `/time 08:00` triggers morning briefing
- [ ] `/time 15:45` triggers gap suggestion (4pm block)
- [ ] `/poll` pulls new data and evaluates
- [ ] `/important` flags contradictions against current plan
- [ ] Engine stays silent when urgency < disruption
- [ ] Engine sends when urgency > disruption

**5. Calendar Blocking**
- [ ] "block 4-5:30 for analysis" creates real Google Calendar event
- [ ] Event shows in next calendar pull
- [ ] Blocked time no longer appears as free block

**6. Drafting**
- [ ] "draft a reply to sarah" generates contextual email draft
- [ ] Draft saved to Gmail drafts (not sent)
- [ ] Draft references current tasks, deadlines, plan

**7. Cross-Source Intelligence**
- [ ] Sarah appears in: iMessage + email + task → Nudge connects all three
- [ ] Professor Kim appears in: email + calendar → Nudge connects both
- [ ] Mom appears in: iMessage only → Nudge correctly deprioritizes

**8. End-to-End Timing**
- [ ] Full demo runs in under 2 minutes with natural pacing
- [ ] No visible loading delays > 2 seconds
- [ ] All proactive messages arrive without user prompting (via `/time` or `/poll`)

### Live Test Procedure

1. `bun run start` — boot Nudge
2. Send `/reset` via iMessage → clean slate
3. Have friends send the prepared emails (3) and calendar events (5) to your real Google account
4. Send first text to Nudge → bouncer starts
5. Walk through the recording script above
6. After each step, verify the expected behavior before moving on
7. If any step fails, check `[handler]` / `[proactive]` / `[extractor]` console logs

---

## Files to Create/Modify

### New Files
- `src/demo.ts` — `/demo`, `/time`, `/poll` command handlers + virtual clock
- `src/agent/ranking.ts` — task ranking engine (scoring, calendar fitting, re-ranking)
- `src/agent/proactive/decision-engine.ts` — unified decision gate replacing interval triggers

### Modified Files
- `src/agent/handler.ts` — route `/demo`, `/time`, `/poll`, `/important`, `/priority` commands; handle "done with X" completion
- `src/agent/tools.ts` — add `block_calendar_time` tool definition + executor
- `src/memory/db.ts` — add new task columns, completion queries, staleness queries
- `src/agent/proactive/index.ts` — wire up decision engine alongside existing triggers
- `src/listener/extractor.ts` — enrich extracted tasks with time estimate, effort, environment
- `src/integrations/calendar.ts` — add `createCalendarEvent()` function
- `src/config.ts` — add virtual time support
