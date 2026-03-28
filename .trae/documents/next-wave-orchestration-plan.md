# Nudge - Next Wave Development Orchestration Plan

## 📅 Plan Created: March 28, 2026 (Day 2 - Hackathon)
## 🎯 Current Status: Foundation Complete, Implementation Wave Starting
## ⏰ Time Remaining: ~10 hours until code freeze (6:30 PM PT)

---

## Executive Summary

**What's Done ✅:**
- Phase 1: Scaffolding (Bun, TypeScript, all dependencies)
- MiniMax integration infrastructure (LLM, TTS, Vision)
- iMessage SDK wrapper
- Database schema (SQLite)
- Agent personality & validation system
- Agent handler with intent classification
- Orchestrator for agent-based task execution

**What's Pending ❌:**
- Listener watcher implementation (actual message processing)
- Entity extraction (MiniMax M2.7 for tasks/commitments)
- Calendar & Gmail integration (Composio)
- Proactive triggers (morning briefing, pre-meeting prep)
- Cross-referencing logic (calendar + email + iMessage)
- Error handling & testing
- Full integration & demo

---

## 🎯 Critical Path Analysis

Based on judging criteria and demo requirements:

```
P0 (MUST HAVE - Demo Critical):
1. Listener message processing → extract tasks
2. Agent response with voice (TTS)
3. Basic calendar/email integration
4. Morning briefing proactive message

P1 (SHOULD HAVE - Demo Impact):
5. Photo processing pipeline (Vision → TTS)
6. Task queue with urgency ranking
7. Follow-up nudges
8. Pre-meeting prep

P2 (NICE TO HAVE - Polish):
9. Rate limiting & anti-repetition
10. Comprehensive error handling
11. Testing suite
12. Performance optimization
```

---

## 🚀 Wave 1: Listener Implementation (2 hours)

### Objective
Implement the core listener loop that watches iMessage conversations and extracts actionable intelligence.

### Tasks

#### 1.1 Complete Listener Watcher Loop (45 min)
**File:** `src/listener/watcher.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant with Listener/Agent architecture
Task: Complete the listener watcher implementation in src/listener/watcher.ts
Current State: Function listenerProcess(msg) exists but only logs message
Requirements:
1. Store every message in SQLite messages table (id, chat_id, sender, content, timestamp, direction, has_attachment, attachment_type, attachment_path, processed)
2. Filter system messages, read receipts, delivery notifications
3. Process messages in batches (every 30 seconds) to avoid overwhelming the LLM
4. Call entity extraction for unprocessed messages
5. Update processed flag after extraction
6. Detect proactive triggers from new messages
7. Use the existing database module from src/memory/db.ts
8. Follow the database schema from PRD.md (lines 510-521)

Technical Details:
- Message type: IMessage from @photon-ai/imessage-kit
- Database: better-sqlite3, file: local.db
- Table: messages (see PRD schema)
- Import entity extractor from ./extractor
- Import trigger detector from ./triggers
- Batch processing: collect messages for 30s, then process together
```

#### 1.2 Implement Entity Extractor (45 min)
**File:** `src/listener/extractor.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Implement entity extraction using MiniMax M2.7 in src/listener/extractor.ts
Requirements:
1. Use MiniMax M2.7 (via existing client in src/minimax/llm.ts) to extract from messages:
   - TASKS: things user needs to do (who asked, what, when)
   - COMMITMENTS: things user promised (to whom, what, when)
   - MEETUPS: planned gatherings (who, when, where)
   - PENDING_QUESTIONS: questions asked to user without answers
   - DEADLINES: time-sensitive items
   - URGENCY: rate 1-5

2. Store extracted entities in database:
   - tasks table: id, source='imessage', source_ref, description, assigned_by, assigned_to='self', deadline, urgency, status='pending', created_at, updated_at
   - people table: id, name, phone, email, last_contact, relationship_context, open_tasks
   - Update open_tasks count when new task assigned to person

3. Extraction prompt pattern (from PRD line 277-290):
   "You are analyzing iMessage conversations to extract actionable intelligence.
   Given the following messages, extract:
   1. TASKS: things the user needs to do (who asked, what, when)
   2. COMMITMENTS: things the user promised (to whom, what, when)
   3. MEETUPS: planned or proposed gatherings (who, when, where)
   4. PENDING_QUESTIONS: questions asked to the user without answers yet
   5. DEADLINES: any time-sensitive items
   6. URGENCY: rate 1-5

   Return as JSON. Be specific. Include the person's name and the exact ask."

4. Process message batches efficiently (don't call LLM for every single message)
5. Parse JSON response from LLM and store in database
6. Use uuid for generating IDs

Technical Details:
- Import generate from src/minimax/llm.ts
- Import database functions from src/memory/db.ts
- Import task CRUD from src/memory/tasks.ts
- Import people CRUD from src/memory/people.ts
- Return structured extraction results
```

#### 1.3 Implement Cross-Reference Logic (30 min)
**File:** `src/listener/crossref.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant with calendar/email cross-referencing
Task: Implement cross-referencing logic in src/listener/crossref.ts
Requirements:
1. When task extracted → check Google Calendar for:
   - Related events (same person, similar topic)
   - Conflicts with deadline
   - Free blocks available for task completion
   
2. When calendar event detected → check Gmail for:
   - Related email threads with attendees
   - Action items from event description
   - Unanswered emails from attendees
   
3. Match people across sources:
   - iMessage sender → person record
   - Calendar attendee → email address
   - Gmail sender → link to person
   
4. Update task urgency based on cross-references:
   - Meeting with person + open task from them = higher urgency
   - Calendar deadline + related task = confirm/flag
   - Free block + high urgency task = suggest scheduling

Technical Details:
- Calendar integration: src/integrations/calendar.ts (will be implemented in Wave 2)
- Gmail integration: src/integrations/gmail.ts (will be implemented in Wave 2)
- For now, create stub functions that return empty results
- Use MiniMax M2.7 for semantic matching ("is this email about the same thing as this task?")
- Focus on entity linking and relationship building
```

---

## 🚀 Wave 2: Composio Integration (2 hours)

### Objective
Connect Google Calendar and Gmail to provide real context to the Agent.

### Tasks

#### 2.1 Implement Composio Client (30 min)
**File:** `src/integrations/composio.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - iMessage AI assistant with calendar/email integration
Task: Implement Composio client in src/integrations/composio.ts
Requirements:
1. Set up Composio client with API key from config
2. Connect to Johnny's Google account (pre-authorized OAuth)
3. Create helper functions for common operations:
   - getCalendarEvents(timeMin, timeMax, calendarId='primary')
   - getGmailEmails(query, maxResults=10)
   - getGmailThread(threadId)
4. Handle OAuth token refresh
5. Wrap all operations in try-catch with graceful fallbacks
6. Log all Composio operations for debugging

Technical Details:
- Composio SDK: composio-core
- Pattern from PRD (line 216-219):
  import { Composio } from "composio-core";
  const composio = new Composio({ apiKey });
  const entity = composio.getEntity(userId);
  const events = await entity.execute({ actionName: "GOOGLECALENDAR_LIST_EVENTS", params: {...} });
- Environment: COMPOSIO_API_KEY in .env
- User ID: 'johnny' or similar identifier
```

#### 2.2 Implement Calendar Integration (45 min)
**File:** `src/integrations/calendar.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Implement calendar integration in src/integrations/calendar.ts
Requirements:
1. Get today's and tomorrow's events
2. Calculate free blocks (gaps between events > 30 minutes)
3. Detect meeting conflicts or double-bookings
4. Check if meetings are "prepped" (related emails exist)
5. Pull attendee list for each event
6. Format events for Agent context injection

Functions to implement:
- getTodayEvents(): Get all events for today
- getTomorrowEvents(): Get all events for tomorrow
- getUpcomingEvents(hours=24): Events in next N hours
- getFreeBlocks(date, minDuration=30): Free time slots in minutes
- isMeetingPrepped(event): Check if related emails exist
- getMeetingAttendees(event): Extract attendee emails/names
- formatEventsForAgent(events): Create readable summary

Response format example:
"Today's Schedule:
- 10:00 AM: Standup (1h, 5 attendees) - no prep needed
- 2:00 PM: Sarah 1:1 (30min, prepped ✓)
- FREE: 11:00-12:00 (1hr), 3:30-5:00 (1.5hrs)
- 8:00 PM: Hackathon Demo"
```

#### 2.3 Implement Gmail Integration (45 min)
**File:** `src/integrations/gmail.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Implement Gmail integration in src/integrations/gmail.ts
Requirements:
1. Get recent unread emails
2. Get urgent emails (from senders with open tasks)
3. Get emails about specific people/events
4. Extract action items from email threads
5. Check for unanswered emails > 24h
6. Format for Agent context

Functions to implement:
- getRecentEmails(maxResults=10): Latest unread emails
- getUrgentEmails(): Emails from people with open tasks
- getEmailsFromPerson(email, maxResults=5): Email history with someone
- getEmailsAboutEvent(eventTitle): Related email threads
- extractActionItems(email): Parse emails for action items
- getUnansweredEmails(hours=24): Emails user hasn't replied to
- formatEmailsForAgent(emails): Create readable summary

Response format example:
"Unread Emails (3):
- Sarah (2h ago): "RE: Budget Review" - ACTION NEEDED
- Teri (5h ago): "Design mockups attached"
- Prof. Kim (1d ago): "Office hours changed" - UNANSWERED

Action Items:
- Sarah: Needs budget numbers before 2pm meeting
- Teri: Review design mockups"
```

---

## 🚀 Wave 3: Agent Proactivity (2 hours)

### Objective
Implement proactive message delivery - the key differentiator that makes Nudge feel like a real assistant.

### Tasks

#### 3.1 Implement Proactive Engine (45 min)
**File:** `src/agent/proactive/engine.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant with rate limiting and anti-repetition
Task: Implement proactive message delivery engine in src/agent/proactive/engine.ts
Requirements:
1. Message rate limiting (max 3 per hour)
2. Quiet hours enforcement (11pm-7am no proactive messages)
3. Anti-repetition (don't send same/similar message within 48h)
4. Content hashing for duplicate detection
5. Queue system for proactive messages
6. Priority scoring: urgency * deadline_proximity * relevance

Core class ProactiveEngine:
- constructor(): Initialize rate limiter, hash store, queue
- canSend(): Check rate limit and quiet hours
- shouldSend(trigger): Check anti-repetition, score threshold
- enqueue(message, trigger, priority): Add to priority queue
- processQueue(): Send messages in priority order
- recordSent(content, trigger): Log for rate limiting

Rate limiting:
- Track sent messages in memory with timestamps
- Window: 1 hour rolling
- Max: 3 messages per window
- Use: src/utils/time.ts for quiet hours

Anti-repetition:
- Hash message content (SHA256)
- Store in Set with trigger type and timestamp
- TTL: 48 hours
- Check: Similar hash + same trigger type = skip
```

#### 3.2 Implement Scheduled Triggers (45 min)
**File:** `src/agent/proactive/triggers-scheduled.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Implement scheduled proactive triggers in src/agent/proactive/triggers-scheduled.ts
Requirements:
1. Morning briefing (8:00 AM default, configurable via MORNING_BRIEFING_HOUR)
2. Pre-meeting prep (15 min before events, via PRE_MEETING_MINUTES)
3. Evening summary (optional, 8:00 PM)

Morning Briefing trigger:
- Time: MORNING_BRIEFING_HOUR (default 8)
- Pull: Today's calendar + task queue + overnight emails
- Generate: Optimized day plan using MiniMax M2.7
- Format: "morning. you've got 3 things today: [events]. [priority task]. [scheduling suggestion]"
- Voice: Use TTS with "energized" emotion

Pre-Meeting Prep trigger:
- Time: event.startTime - PRE_MEETING_MINUTES
- Pull: Event details + related emails + recent messages with attendees
- Generate: "heads up - [meeting] in 15 min. [context from emails/messages]. [prep suggestion]"
- Voice: Use TTS with "neutral/calm" emotion

Implementation:
- Use setInterval or cron-like scheduling
- Store last-triggered timestamps to avoid duplicates
- Check calendar every 5 minutes (CALENDAR_POLL_INTERVAL)
- Only trigger if meeting is within next 30 minutes

Functions:
- checkScheduledTriggers(): Called by scheduler
- generateMorningBriefing(): Create morning briefing content
- generatePreMeetingPrep(event): Create meeting prep content
- sendProactiveMessage(content, triggerType): Via engine
```

#### 3.3 Implement Event Triggers (30 min)
**File:** `src/agent/proactive/triggers-event.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Implement event-based proactive triggers in src/agent/proactive/triggers-event.ts
Requirements:
1. Task deadline approaching (within 2 hours)
2. Commitment due (promised to someone)
3. Unanswered question > 24 hours
4. New urgent task extracted
5. Pattern: 3+ tasks from same person
6. Person hasn't been contacted in 7+ days (with open tasks)

Trigger patterns (from PRD line 325-331):

1. "you told kayla you'd send the deck 2 days ago. want me to draft something?"
2. "sarah emailed about the budget twice and you haven't replied. knock that out during your 10am gap."
3. "you had coffee with sarah 2 days ago — want to send a thank-you?"

Functions to implement:
- checkTaskTriggers(): Check deadlines and commitments
- checkQuestionTriggers(): Find unanswered questions
- checkPersonTriggers(): Check person-based patterns
- generateTaskNudge(task): Format task reminder
- generateFollowUpNudge(person, question): Format follow-up
- generateBacklogNudge(person, taskCount): Format backlog notice

Integration:
- Called by Listener after message extraction
- Also called periodically (every 30 min) for time-based checks
- Use ProactiveEngine to send with proper rate limiting
```

---

## 🚀 Wave 4: Integration & Polish (2 hours)

### Objective
Wire everything together, add error handling, and prepare for demo.

### Tasks

#### 4.1 Complete Main Entry Point (30 min)
**File:** `src/index.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - iMessage AI assistant
Task: Complete the main entry point in src/index.ts to wire everything together
Current State: Basic watcher loop exists but doesn't process messages
Requirements:
1. Import and initialize all modules:
   - Database initialization (src/memory/db.ts)
   - Proactive engine initialization (src/agent/proactive/engine.ts)
   - Scheduled triggers setup (src/agent/proactive/triggers-scheduled.ts)
   - iMessage SDK

2. Message routing:
   - Agent thread (AGENT_THREAD_ID) → agentProcess(msg)
   - All other threads → listenerProcess(msg)

3. Startup sequence:
   - Initialize database
   - Start iMessage watcher
   - Start scheduled trigger checks
   - Start event trigger checks (periodic)
   - Log "Nudge is running..."

4. Graceful shutdown:
   - Handle SIGINT/SIGTERM
   - Close database connections
   - Stop watchers
   - Log shutdown

5. Error handling:
   - Wrap everything in try-catch
   - Log errors with context
   - Don't crash on individual message errors

Environment variables (from config):
- AGENT_THREAD_ID: chat ID for agent thread
- MORNING_BRIEFING_HOUR: default 8
- CALENDAR_POLL_INTERVAL: 300000 (5 min)
- EMAIL_POLL_INTERVAL: 600000 (10 min)
```

#### 4.2 Complete Agent Router (30 min)
**File:** `src/agent/router.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - iMessage AI assistant
Task: Complete the agent router in src/agent/router.ts
Current State: Basic router exists, agent handler needs integration
Requirements:
1. Normalize incoming messages (from IMessage SDK format)
2. Route to appropriate handler based on:
   - Text messages → intent classification → response
   - Photo attachments → Vision → response
   - Voice attachments → transcribe → response (future)
   - Commands (e.g., "stop", "pause") → control responses

3. Response delivery:
   - Generate text response via handler
   - Convert to voice via TTS
   - Send via iMessage SDK
   - Log to agent_messages table

4. Handle special commands:
   - "what's on my plate?" → task queue
   - "check my email" → email triage
   - "schedule" → calendar summary
   - "stop notifications" → disable proactive
   - "resume notifications" → enable proactive

5. Error recovery:
   - Retry failed sends (max 2 times)
   - Fallback to text-only if TTS fails
   - Log all failures

Functions:
- agentProcess(msg): Main entry point
- normalizeMessage(msg): Convert to NormalizedMessage format
- routeMessage(msg): Route to appropriate handler
- sendResponse(text, options): Send via SDK with voice
- handleCommand(text): Process control commands
```

#### 4.3 Context Assembly Polish (30 min)
**File:** `src/agent/context.ts`

**Prompt for TRAE:**
```
Context: Building Nudge - proactive iMessage AI assistant
Task: Polish context assembly in src/agent/context.ts for Agent responses
Current State: Basic context assembly exists
Requirements:
1. Fetch relevant context based on intent:
   - Task queries → pull from tasks table + calendar
   - Email queries → pull from Gmail
   - Person queries → pull from people table + message history
   - Schedule queries → pull from calendar
   - General → pull overview of everything

2. Format context for LLM injection:
   - Max context length: 2000 tokens (M2.7 can handle 204K but keep concise)
   - Prioritize: urgent tasks, upcoming meetings, recent messages
   - Include attribution: who asked, source, when

3. Cross-reference:
   - Task → related emails + calendar events
   - Person → their open tasks + recent messages
   - Meeting → related emails + tasks about attendees

4. Intelligent filtering:
   - Don't include completed tasks
   - Don't include old (>7 days) non-urgent messages
   - Highlight items needing action

Format example:
"Context:
- TODAY: 3 meetings (10am standup, 2pm Sarah 1:1, 8pm demo)
- FREE: 11:00-12:00, 3:30-5:00
- TASKS (4 pending):
  1. [URGENT] Reply to Sarah's budget email (deadline: today 2pm)
  2. Send deck to Kayla (promised yesterday)
  3. Review Teri's design mockups
  4. Prep demo script
- SARAH: 2 unread emails, 1 open task
- RECENT: Teri asked for design feedback in GC yesterday"
```

#### 4.4 Error Handling & Logging (30 min)
**File:** Throughout codebase

**Prompt for TRAE:**
```
Context: Building Nudge - iMessage AI assistant
Task: Add comprehensive error handling and logging throughout the codebase
Requirements:
1. Standardize error handling pattern:
   try {
     await operation();
   } catch (error) {
     console.error('[component/method]', error);
     return fallbackValue; // or throw
   }

2. Logging levels:
   - console.log: Startup, shutdown, major events
   - console.error: Errors (always with context)
   - console.debug: Verbose info (only in development)

3. Critical error recovery:
   - iMessage SDK failures → retry 2x, then notify user
   - MiniMax API failures → retry 2x, then graceful degradation
   - Composio failures → continue without calendar/email
   - Database failures → log, attempt reconnect, fail gracefully

4. Health checks:
   - Periodic check (every 5 min) that all integrations are working
   - Log health status
   - Alert if degraded mode

5. Error messages to user:
   - Friendly, not technical
   - "something went wrong — try again in a sec"
   - "having trouble with [feature] right now"
   - Never expose internal errors
```

---

## 🎯 Success Criteria

### Must Have (Demo Critical):
- ✅ Listener processes messages and extracts tasks
- ✅ Agent responds with voice notes
- ✅ Morning briefing sends proactively
- ✅ Photo → Vision → Voice response works
- ✅ Calendar/email integration provides real data

### Should Have (Demo Impact):
- ✅ Task queue with urgency ranking
- ✅ Follow-up nudges work
- ✅ Pre-meeting prep triggers
- ✅ Cross-referencing (task ↔ calendar ↔ email)

### Nice to Have (Polish):
- ⏸️ Rate limiting works correctly
- ⏸️ Anti-repetition prevents duplicate messages
- ⏸️ Comprehensive testing
- ⏸️ Performance optimization

---

## 📝 TRAE Orchestration Prompts Summary

### Quick Reference - Copy & Use:

**Wave 1 - Listener:**
```
/trae Implement the listener watcher loop in src/listener/watcher.ts. Store messages in SQLite, filter system messages, batch process every 30 seconds, call entity extraction, detect proactive triggers. Use existing database module and entity extractor.
```

**Wave 1 - Entity Extraction:**
```
/trae Implement entity extraction using MiniMax M2.7 in src/listener/extractor.ts. Extract TASKS, COMMITMENTS, MEETUPS, PENDING_QUESTIONS, DEADLINES, URGENCY from messages. Store in database. Use the extraction prompt pattern from PRD.md.
```

**Wave 2 - Composio:**
```
/trae Implement Composio client in src/integrations/composio.ts. Set up Google Calendar and Gmail integration. Create helper functions for common operations. Handle OAuth token refresh.
```

**Wave 3 - Proactive Engine:**
```
/trae Implement proactive message delivery engine in src/agent/proactive/engine.ts. Include rate limiting (max 3/hour), quiet hours (11pm-7am), anti-repetition (48h TTL), priority scoring, and queue system.
```

**Wave 3 - Scheduled Triggers:**
```
/trae Implement scheduled triggers in src/agent/proactive/triggers-scheduled.ts. Morning briefing (8am), pre-meeting prep (15min before), evening summary. Use MiniMax TTS with appropriate emotions.
```

**Wave 4 - Integration:**
```
/trae Complete the main entry point in src/index.ts to wire everything together. Initialize all modules, set up message routing, start scheduled checks, handle graceful shutdown, add comprehensive error handling.
```

---

## 🔄 Dependencies Between Waves

```
Wave 1 (Listener)
    ↓
Wave 2 (Composio) ← Can run parallel with Wave 1
    ↓
Wave 3 (Proactivity) ← Depends on Wave 1 + 2
    ↓
Wave 4 (Integration) ← Depends on Wave 1 + 2 + 3
```

**Recommendation:** Start Wave 1 and Wave 2 in parallel (different team members), then Wave 3, then Wave 4.

---

## 🎯 Demo Flow Script

For the 3-minute demo (practice this!):

**0:00 - Hook**
"Your calendar knows when. Your email knows what. Your texts know who. But nothing tells you what to do, right now. That's Nudge."

**0:15 - Architecture**
"Nudge has two parts. The Listener silently watches your texts and extracts every task. The Agent combines that with your calendar and email, then sends you voice briefings."

**0:30 - Morning Briefing (pre-recorded)**
[Play voice note] "morning. 3 things today — standup at 10, sarah meeting at 2, demo at 8. knock out sarah's budget email during your 10am gap. teri needs design feedback."

**0:55 - Live: Task Query**
[Text from Teri: "what's on my plate?"]
[Nudge responds with voice: prioritized task list]

**1:20 - Photo Intelligence**
[Send receipt photo]
[Nudge voice: "$32 at Trader Joe's. third time this week."]

**1:40 - Korean Menu (Wow moment)**
[Send Korean menu photo]
[Nudge voice in Korean + English: "bibimbap, 12,000 won..."]

**2:00 - Architecture Slide**
"Listener + Agent. Powered by MiniMax M2.7, Speech 2.8, Vision. Built entirely in TRAE AI."

**2:30 - Closer**
"No app. No dashboard. Just your texts, made intelligent."

---

## 🚨 Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| MiniMax API rate limits | Medium | Implement caching, retry with backoff, degrade gracefully |
| Composio OAuth issues | Medium | Pre-authorize, have fallback without calendar/email |
| Listener extraction quality | Medium | Start with keyword extraction, layer LLM on top |
| TTS quality/ Korean | Medium | Test early, have English fallback ready |
| Scope creep | High | Stick to P0 tasks, cut P1/P2 if behind |

---

## ✅ Checklist Before Code Freeze

- [ ] Listener extracts tasks from messages
- [ ] Agent responds with voice notes
- [ ] Morning briefing sends automatically
- [ ] Photo → Vision → Voice works
- [ ] Calendar shows real events
- [ ] Gmail shows real emails
- [ ] Demo flow tested 3+ times
- [ ] No obvious bugs in critical path
- [ ] Commit history shows TRAE usage
- [ ] Submitted on Devpost

---

**Plan Created By:** TRAE AI
**Date:** March 28, 2026
**Status:** Ready for Execution
**Next Action:** Start Wave 1 (Listener Implementation)
