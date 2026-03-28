# Demo Commands Specification

## Overview
Demo commands enable time simulation and housekeeping features for showcasing iMesg's autonomous capabilities.

## Dependencies
- Internal: `config` from `../config`
- Internal: `analyzeGmail`, `sendEmail` from `../integrations/gmail`
- Internal: `getTaskQueue`, `markTaskDone` from `../memory/db`
- Internal: `analyzeCalendar`, `blockTime`, `findAndBlockTime` from `../integrations/calendar`

## Email Sending (Not Just Drafting)

### Overview
Users can draft emails AND send them immediately. The system distinguishes between:
- **Draft**: `save_email_draft` — saves to Gmail drafts (user reviews before sending)
- **Send**: `send_email` — sends immediately (user says "send it", "just do it", etc.)

### Usage Patterns

**Draft Only:**
```
YOU: draft an email to sarah about the budget
NUDGE: here's the draft:
Subject: Q2 Budget Review
...
💾 draft saved. want me to send it or make changes?
```

**Send Immediately:**
```
YOU: send it
NUDGE: sent ✓ — "Q2 Budget Review" to sarah@company.com
```

### `sendEmail()` Function
```typescript
async function sendEmail(
  to: string,
  subject: string,
  body: string,
  phone?: string
): Promise<{ success: boolean; message: string }>
```

**Composio Actions (fallback chain):**
1. `GMAIL_SEND_EMAIL` with to, subject, body
2. `GMAIL_SEND_EMAIL` with raw base64 message
3. `GMAIL_EMAILS_SEND`
4. `GMAIL_SEND`

### LLM Tool Definition
```json
{
  "name": "send_email",
  "description": "SEND an email immediately to the specified recipient. USE THIS when the user says 'send', 'just send it', 'go ahead and send', 'do it', or wants to send an email RIGHT NOW. does NOT save a draft — actually sends it.",
  "parameters": {
    "type": "object",
    "properties": {
      "to": { "type": "string", "description": "recipient email address" },
      "subject": { "type": "string", "description": "email subject line" },
      "body": { "type": "string", "description": "the full email body text" }
    },
    "required": ["to", "subject", "body"]
  }
}
```

### Demo Flow
1. User reviews drafted email
2. User says "send it" or "just send it"
3. LLM recognizes send intent → calls `send_email` tool
4. Email sent immediately via Composio
5. Confirmation shown: "sent ✓ — 'subject' to recipient"

## Calendar Time Blocking

### Overview
Block time on the user's calendar for focused work sessions, tasks, or any time protection.

### Usage Patterns

**Block Specific Time:**
```
YOU: block 2 hours for thesis work tomorrow at 9am
NUDGE: blocked ✓ tomorrow 9:00 AM - 11:00 AM — thesis work
```

**Find and Block First Available:**
```
YOU: block 1 hour for PR review
NUDGE: blocked ✓ today 12:00 PM - 1:00 PM — PR review
   (found 12-1pm free slot)
```

### `blockTime()` Function
```typescript
async function blockTime(
  title: string,
  startTime: Date,
  durationMin: number,
  phone?: string
): Promise<{ success: boolean; message: string }>
```

### `findAndBlockTime()` Function
```typescript
async function findAndBlockTime(
  title: string,
  durationMin: number,
  preferredDate?: Date,
  phone?: string
): Promise<{
  success: boolean;
  message: string;
  blockedTime?: { start: Date; end: Date }
}>
```

**Behavior:**
1. Analyze today's calendar
2. Find free blocks >= requested duration
3. If found: block first available
4. If not found: suggest tomorrow 9am
5. Return confirmation with blocked time

### Composio Actions (fallback chain)
1. `GOOGLECALENDAR_CREATE_EVENT` with start_time, end_time
2. `GOOGLECALENDAR_CREATE_EVENT` with start/end objects
3. `GOOGLECALENDAR_CREATE_EVENT` with start_date_time
4. `GOOGLECALENDAR_EVENTS_INSERT`

### LLM Tool Definition
```json
{
  "name": "block_time",
  "description": "block out time on the user's calendar for a specific task or focus time. use when user wants to block calendar time for working on a task, thesis, or any focused work session.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "what to call this time block (e.g. 'thesis work', 'focus time', 'PR review')" },
      "duration_min": { "type": "number", "description": "how many minutes to block (e.g. 60 for 1 hour, 120 for 2 hours)" },
      "date": { "type": "string", "description": "optional: date string like '2024-03-15' or 'tomorrow', defaults to today" },
      "hour": { "type": "number", "description": "optional: hour of day (0-23), defaults to first available free slot" }
    },
    "required": ["title", "duration_min"]
  }
}
```

### Demo Flows

**Smart Time Blocking:**
```
YOU: I need to work on my thesis, block some time
NUDGE: blocked ✓ today 12:00 PM - 1:00 PM — thesis work
   found a free hour during lunch

want me to add prep buffer? could block 9-11am tomorrow instead
```

**Explicit Time Blocking:**
```
YOU: block 2 hours for thesis work tomorrow morning
NUDGE: blocked ✓ tomorrow 9:00 AM - 11:00 AM — thesis work
```

**Context-Aware Blocking:**
After `/priority` shows thesis task:
```
YOU: block time for thesis work
NUDGE: based on your tasks and free blocks, blocked ✓:
   12:00 PM - 1:00 PM today — thesis outline work
   (found during your lunch break)

   tomorrow looks clearer too — want me to block 9-11am tomorrow?
```

## Time Simulation System

### `TimeContext` Interface
```typescript
interface TimeContext {
  simulatedTime: Date | null;
  isSimulating: boolean;
}
```

### `/time` Command
Sets simulated time for testing proactive triggers.

**Usage:** `/time 9:30 AM` or `/time tomorrow 8:00 AM`

**Behavior:**
1. Parse time string (supports: "9:30 AM", "tomorrow 8am", "+2 hours", "next monday")
2. Set `config.simulatedTime`
3. Return confirmation: "time set to [time] — simulation mode active"
4. Proactive engine checks both real clock AND simulated time
5. Auto-deactivate simulation after 5 minutes OR on `/time reset`

**Triggers to Test:**
- Morning briefing (8 AM)
- Task nudges (urgent tasks)
- Meeting prep (15 min before)
- EOD review (6 PM)

### `getCurrentTime(): Date`
Returns simulated time if active, else real system time.

### `shouldTriggerProactive(type, lastTriggered): boolean`
Evaluates if a proactive trigger should fire based on:
- Time difference (real or simulated)
- Rate limiting
- Dedup checks

## Housekeeping Command

### `/important` Command
Scans emails for pressing items that contradict current plans.

**Usage:** `/important`

**Behavior:**
1. Pull unread emails (last 10)
2. Pull today's calendar events
3. Pull open tasks
4. LLM analysis: "Check if any emails contradict or conflict with calendar/tasks"
5. Display prioritized conflicts:

```
⚠️ CONFLICTS DETECTED:
1. [URGENT] sarah@company.com - "RE: Budget" 
   ↳ Meeting in 30min about budget — haven't replied
2. [SCHEDULE] professor@university.edu - "Assignment due"
   ↳ Due tomorrow but you have 3 meetings today
3. [ATTENTION] john@team.com - "Quick question"
   ↳ Waiting 2 days — low priority but still pending
```

**Conflicts to Detect:**
- Unanswered emails from upcoming meetings
- Email deadlines conflicting with calendar
- Escalated senders (3+ unread from same person)
- Tasks that need email follow-up
- Time-sensitive emails (today/tomorrow)

### `analyzeConflicts(emails, calendar, tasks): ConflictReport`

```typescript
interface ConflictReport {
  conflicts: Conflict[];
  warnings: Warning[];
  pendingFollowUps: FollowUp[];
}

interface Conflict {
  type: 'schedule' | 'deadline' | 'escalation';
  priority: 'high' | 'medium' | 'low';
  email: EmailSummary;
  relatedItem: CalendarEvent | Task;
  suggestion: string;
}
```

## Priority Command

### `/priority` Command
Re-ranks and displays tasks based on calendar and deadlines.

**Usage:** `/priority` or `/priority 5` (show top N)

**Behavior:**
1. Pull task queue
2. Pull today's calendar
3. LLM ranking considering:
   - Explicit deadlines
   - Meeting conflicts
   - Urgency scores
   - Assigned-by importance
   - Inferred deadlines from context
4. Display ranked list:

```
📋 PRIORITY QUEUE:
━━━━━━━━━━━━━━━━━━
1. [🔥 URGENT] Reply to sarah about budget
   ↳ Meeting in 30min | from: Sarah Chen
   ⏰ deadline: 10:00 AM (inferred)

2. [⚡ HIGH] Email professor draft
   ↳ Due tomorrow 11:59 PM | from: Dr. Smith
   ⏰ deadline: Tomorrow 9:00 AM (2h prep buffer)

3. [📅 SCHEDULED] Team standup prep
   ↳ Meeting at 2:00 PM | topic: sprint review
   💡 prepare talking points

4. [📌 NORMAL] Call mom
   ↳ mentioned "call when free" | no deadline
   ⏰ suggested: after 5pm

5. [🧹 LOW] Follow up with john
   ↳ waiting 2 days | not urgent
```

### `rankTasks(tasks, calendar): RankedTask[]`

```typescript
interface RankedTask {
  rank: number;
  task: Task;
  reason: string;
  deadline: Date | null;
  inferredDeadline: boolean;
  calendarConflict: boolean;
  suggestion: string;
}
```

## Task Completion Tracking

### `/done` Command
Mark tasks as completed during the day.

**Usage:** `/done 1,2` or `/done reply to sarah`

**Behavior:**
1. Parse task IDs or task description
2. Mark tasks as 'done' in database
3. Show updated priority queue
4. Celebrate completion: "✅ done! 3 tasks left — keep it up"

### `/remaining` Command
Show remaining tasks for the day.

**Usage:** `/remaining`

**Behavior:**
1. Pull open tasks
2. Group by time sensitivity
3. Display quick status:

```
📊 TODAY'S STATUS:
━━━━━━━━━━━━━━━━━━
✅ Completed: 3 tasks
⏳ Remaining: 5 tasks
   • 2 due today
   • 3 flexible

💡 Suggestion: Finish sarah email, then clear calendar conflicts
```

## Command Routing

### `parseCommand(text: string): Command | null`

**Supported Commands:**
| Command | Pattern | Handler |
|---------|---------|---------|
| `/time` | `/time [time]` or `/time reset` | handleTimeCommand |
| `/important` | `/important` or `/important scan` | handleImportantCommand |
| `/priority` | `/priority [n]` or `/priority` | handlePriorityCommand |
| `/done` | `/done [ids]` or `/done [desc]` | handleDoneCommand |
| `/remaining` | `/remaining` | handleRemainingCommand |

**Flow:**
1. Check if message starts with `/`
2. Route to appropriate handler
3. Execute command logic
4. Format response
5. Send via `sendBubbles()`

## Time Simulation in Proactive Engine

### Modifications to `startProactiveEngine()`

```typescript
function shouldRunTrigger(triggerType: string, scheduleHour: number): boolean {
  const now = getCurrentTime();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if current time matches trigger schedule
  if (currentHour !== scheduleHour) return false;
  if (currentMinute > 5) return false; // within 5 min window
  
  // Check dedup and rate limits
  return checkGates(triggerType);
}
```

### `advanceTime(hours: number): void`
Jump forward in simulation:
- `/time +2h` — advance 2 hours
- Useful for testing evening triggers during demo

### Demo Mode Flag
```typescript
const config = {
  ...,
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  SIMULATION_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
};
```

When DEMO_MODE=true:
- All triggers fire immediately on next poll cycle
- Reduced quiet hours restrictions
- Verbose logging for demonstration
