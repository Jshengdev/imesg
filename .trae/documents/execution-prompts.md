# Nudge - Execution Prompts (Copy & Paste)

## 🚀 Wave 1: Listener Implementation

### 1.1 Complete Listener Watcher Loop
```
Implement the listener watcher loop in src/listener/watcher.ts. 

Requirements:
- Store every message in SQLite messages table with: id, chat_id, sender, content, timestamp, direction, has_attachment, attachment_type, attachment_path, processed
- Filter system messages, read receipts, delivery notifications
- Process messages in batches (every 30 seconds) to avoid overwhelming the LLM
- Call entity extraction for unprocessed messages
- Update processed flag after extraction
- Detect proactive triggers from new messages
- Use the existing database module from src/memory/db.ts
- Follow the database schema from PRD.md lines 510-521

Technical Details:
- Message type: IMessage from @photon-ai/imessage-kit
- Database: better-sqlite3, file: local.db
- Import entity extractor from ./extractor
- Import trigger detector from ./triggers
```

### 1.2 Implement Entity Extractor
```
Implement entity extraction using MiniMax M2.7 in src/listener/extractor.ts.

Requirements:
- Use MiniMax M2.7 via existing client in src/minimax/llm.ts to extract from messages:
  * TASKS: things user needs to do (who asked, what, when)
  * COMMITMENTS: things user promised (to whom, what, when)
  * MEETUPS: planned gatherings (who, when, where)
  * PENDING_QUESTIONS: questions asked to user without answers
  * DEADLINES: time-sensitive items
  * URGENCY: rate 1-5

- Store extracted entities in database:
  * tasks table: id, source='imessage', source_ref, description, assigned_by, assigned_to='self', deadline, urgency, status='pending', created_at, updated_at
  * people table: id, name, phone, email, last_contact, relationship_context, open_tasks
  * Update open_tasks count when new task assigned to person

- Use extraction prompt:
"You are analyzing iMessage conversations to extract actionable intelligence.
Given the following messages, extract:
1. TASKS: things the user needs to do (who asked, what, when)
2. COMMITMENTS: things the user promised (to whom, what, when)
3. MEETUPS: planned or proposed gatherings (who, when, where)
4. PENDING_QUESTIONS: questions asked to the user without answers yet
5. DEADLINES: any time-sensitive items
6. URGENCY: rate 1-5
Return as JSON. Be specific. Include the person's name and the exact ask."

- Process message batches efficiently (don't call LLM for every single message)
- Parse JSON response from LLM and store in database
- Use uuid for generating IDs
```

### 1.3 Implement Cross-Reference Logic
```
Implement cross-referencing logic in src/listener/crossref.ts.

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
- Calendar integration: src/integrations/calendar.ts (stub functions for now)
- Gmail integration: src/integrations/gmail.ts (stub functions for now)
- Create stub functions that return empty results
- Use MiniMax M2.7 for semantic matching
```

---

## 🚀 Wave 2: Composio Integration

### 2.1 Implement Composio Client
```
Implement Composio client in src/integrations/composio.ts.

Requirements:
1. Set up Composio client with API key from config
2. Connect to Johnny's Google account (pre-authorized OAuth)
3. Create helper functions:
   - getCalendarEvents(timeMin, timeMax, calendarId='primary')
   - getGmailEmails(query, maxResults=10)
   - getGmailThread(threadId)
4. Handle OAuth token refresh
5. Wrap all operations in try-catch with graceful fallbacks
6. Log all Composio operations for debugging

Pattern from PRD:
import { Composio } from "composio-core";
const composio = new Composio({ apiKey });
const entity = composio.getEntity(userId);
const events = await entity.execute({ actionName: "GOOGLECALENDAR_LIST_EVENTS", params: {...} });

Environment: COMPOSIO_API_KEY in .env
User ID: 'johnny'
```

### 2.2 Implement Calendar Integration
```
Implement calendar integration in src/integrations/calendar.ts.

Functions to implement:
- getTodayEvents(): Get all events for today
- getTomorrowEvents(): Get all events for tomorrow
- getUpcomingEvents(hours=24): Events in next N hours
- getFreeBlocks(date, minDuration=30): Free time slots in minutes
- isMeetingPrepped(event): Check if related emails exist
- getMeetingAttendees(event): Extract attendee emails/names
- formatEventsForAgent(events): Create readable summary

Requirements:
- Get today's and tomorrow's events
- Calculate free blocks (gaps between events > 30 minutes)
- Detect meeting conflicts or double-bookings
- Check if meetings are "prepped" (related emails exist)
- Pull attendee list for each event

Response format example:
"Today's Schedule:
- 10:00 AM: Standup (1h, 5 attendees) - no prep needed
- 2:00 PM: Sarah 1:1 (30min, prepped ✓)
- FREE: 11:00-12:00 (1hr), 3:30-5:00 (1.5hrs)
- 8:00 PM: Hackathon Demo"
```

### 2.3 Implement Gmail Integration
```
Implement Gmail integration in src/integrations/gmail.ts.

Functions to implement:
- getRecentEmails(maxResults=10): Latest unread emails
- getUrgentEmails(): Emails from people with open tasks
- getEmailsFromPerson(email, maxResults=5): Email history with someone
- getEmailsAboutEvent(eventTitle): Related email threads
- extractActionItems(email): Parse emails for action items
- getUnansweredEmails(hours=24): Emails user hasn't replied to
- formatEmailsForAgent(emails): Create readable summary

Requirements:
1. Get recent unread emails
2. Get urgent emails (from senders with open tasks)
3. Get emails about specific people/events
4. Extract action items from email threads
5. Check for unanswered emails > 24h
6. Format for Agent context

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

## 🚀 Wave 3: Agent Proactivity

### 3.1 Implement Proactive Engine
```
Implement proactive message delivery engine in src/agent/proactive/engine.ts.

Core class ProactiveEngine:
- constructor(): Initialize rate limiter, hash store, queue
- canSend(): Check rate limit and quiet hours
- shouldSend(trigger): Check anti-repetition, score threshold
- enqueue(message, trigger, priority): Add to priority queue
- processQueue(): Send messages in priority order
- recordSent(content, trigger): Log for rate limiting

Requirements:
1. Message rate limiting (max 3 per hour)
2. Quiet hours enforcement (11pm-7am no proactive messages)
3. Anti-repetition (don't send same/similar message within 48h)
4. Content hashing for duplicate detection
5. Queue system for proactive messages
6. Priority scoring: urgency * deadline_proximity * relevance

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

### 3.2 Implement Scheduled Triggers
```
Implement scheduled proactive triggers in src/agent/proactive/triggers-scheduled.ts.

Functions:
- checkScheduledTriggers(): Called by scheduler
- generateMorningBriefing(): Create morning briefing content
- generatePreMeetingPrep(event): Create meeting prep content
- sendProactiveMessage(content, triggerType): Via engine

Requirements:
1. Morning briefing (8:00 AM default, configurable via MORNING_BRIEFING_HOUR)
2. Pre-meeting prep (15 min before events, via PRE_MEETING_MINUTES)
3. Evening summary (optional, 8:00 PM)

Morning Briefing:
- Time: MORNING_BRIEFING_HOUR (default 8)
- Pull: Today's calendar + task queue + overnight emails
- Generate: Optimized day plan using MiniMax M2.7
- Format: "morning. you've got 3 things today: [events]. [priority task]. [scheduling suggestion]"
- Voice: Use TTS with "energized" emotion

Pre-Meeting Prep:
- Time: event.startTime - PRE_MEETING_MINUTES
- Pull: Event details + related emails + recent messages with attendees
- Generate: "heads up - [meeting] in 15 min. [context from emails/messages]. [prep suggestion]"
- Voice: Use TTS with "neutral/calm" emotion

Implementation:
- Use setInterval or cron-like scheduling
- Store last-triggered timestamps to avoid duplicates
- Check calendar every 5 minutes (CALENDAR_POLL_INTERVAL)
- Only trigger if meeting is within next 30 minutes
```

### 3.3 Implement Event Triggers
```
Implement event-based proactive triggers in src/agent/proactive/triggers-event.ts.

Functions to implement:
- checkTaskTriggers(): Check deadlines and commitments
- checkQuestionTriggers(): Find unanswered questions
- checkPersonTriggers(): Check person-based patterns
- generateTaskNudge(task): Format task reminder
- generateFollowUpNudge(person, question): Format follow-up
- generateBacklogNudge(person, taskCount): Format backlog notice

Requirements:
1. Task deadline approaching (within 2 hours)
2. Commitment due (promised to someone)
3. Unanswered question > 24 hours
4. New urgent task extracted
5. Pattern: 3+ tasks from same person
6. Person hasn't been contacted in 7+ days (with open tasks)

Trigger patterns from PRD:
1. "you told kayla you'd send the deck 2 days ago. want me to draft something?"
2. "sarah emailed about the budget twice and you haven't replied. knock that out during your 10am gap."
3. "you had coffee with sarah 2 days ago — want to send a thank-you?"

Integration:
- Called by Listener after message extraction
- Also called periodically (every 30 min) for time-based checks
- Use ProactiveEngine to send with proper rate limiting
```

---

## 🚀 Wave 4: Integration & Polish

### 4.1 Complete Main Entry Point
```
Complete the main entry point in src/index.ts to wire everything together.

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

### 4.2 Complete Agent Router
```
Complete the agent router in src/agent/router.ts.

Functions:
- agentProcess(msg): Main entry point
- normalizeMessage(msg): Convert to NormalizedMessage format
- routeMessage(msg): Route to appropriate handler
- sendResponse(text, options): Send via SDK with voice
- handleCommand(text): Process control commands

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
```

### 4.3 Context Assembly Polish
```
Polish context assembly in src/agent/context.ts for Agent responses.

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

### 4.4 Error Handling & Logging
```
Add comprehensive error handling and logging throughout the codebase.

Requirements:
1. Standardize error handling pattern:
   try {
     await operation();
   } catch (error) {
     console.error('[component/method]', error);
     return fallbackValue;
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

## 🎯 Quick Commands for Testing

### Test Listener
```bash
cd /Users/johnnysheng/Documents/trae_projects/imesg
bun run src/listener/watcher.ts
```

### Test MiniMax Integration
```bash
cd /Users/johnnysheng/Documents/trae_projects/imesg
bun run src/minimax/llm.ts
```

### Test Database
```bash
cd /Users/johnnysheng/Documents/trae_projects/imesg
bun run src/memory/db.ts
```

### Run Full System
```bash
cd /Users/johnnysheng/Documents/trae_projects/imesg
bun run src/index.ts
```

### Build
```bash
cd /Users/johnnysheng/Documents/trae_projects/imesg
bun run build
```

---

## 📋 Task Checklist

### Before Each Task:
- [ ] Read the PRD section for context
- [ ] Check existing implementation
- [ ] Copy prompt into TRAE
- [ ] Review generated code
- [ ] Test locally

### After Each Task:
- [ ] Verify implementation works
- [ ] Check for errors
- [ ] Update tasks.md if needed
- [ ] Commit with TRAE usage message

---

**Created:** March 28, 2026
**Status:** Ready to Execute
