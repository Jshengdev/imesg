# iMessage AI Assistant: Comprehensive Verification Checklist

This checklist consolidates all verification items from PRD, tasks, and codebase analysis to ensure complete project validation.

---

## 🚨 PRIORITY 1: CRITICAL BREAKING ISSUES

### Missing/Broken Exports
- [ ] **minimax/llm.ts** - Export `generateJSON`, `generate`, `stripThinkTags` functions
- [ ] **memory/db.ts** - Export `getUnprocessedMessages`, `markProcessed`, `storeTasks`, `getTaskQueue`, `countRecentProactive`, `wasRecentlySent`, `logProactive`, `getTriggerEngagement`, `logAgent`, `getRecentConversation`, `getPersonDossier`
- [ ] **config.ts** - Export `agentChatIdentifier`, `calendarPollMs`, `emailPollMs`

### Empty/Placeholder Files
- [ ] **src/minimax/client.ts** - Implement or delete
- [ ] **src/memory/messages.ts** - Implement or delete
- [ ] **src/memory/tasks.ts** - Implement or delete
- [ ] **src/imessage/listener.ts** - Implement actual functionality

### Database Functions
- [ ] `getUnprocessedMessages()` - Fetch messages not yet processed
- [ ] `markProcessed(messageId)` - Mark message as processed
- [ ] `storeTasks(tasks[])` - Store extracted tasks
- [ ] `getTaskQueue()` - Retrieve prioritized task list
- [ ] `getRecentConversation(limit)` - Get recent messages for context
- [ ] `getPersonDossier(personId)` - Get person profile and history
- [ ] `countRecentProactive(type, windowMs)` - Count proactive messages for rate limiting
- [ ] `wasRecentlySent(contentHash, windowMs)` - Check anti-repetition
- [ ] `logProactive(type, contentHash)` - Log proactive message
- [ ] `getTriggerEngagement(triggerType)` - Track trigger effectiveness
- [ ] `logAgent(direction, content)` - Log agent conversations

---

## ✅ PRIORITY 2: PROJECT SETUP & CONFIGURATION

### Dependencies
- [ ] Bun project initialized
- [ ] All dependencies installed successfully
- [ ] `tsconfig.json` properly configured
- [ ] `.env` file created with all required keys:
  - [ ] `MINIMAX_API_KEY`
  - [ ] `MINIMAX_API_HOST=https://api.minimax.io`
  - [ ] `COMPOSIO_API_KEY`
  - [ ] `AGENT_THREAD_ID` (chat ID for agent ↔ Johnny thread)
  - [ ] `QUIET_HOURS_START=23`
  - [ ] `QUIET_HOURS_END=7`
  - [ ] `MAX_PROACTIVE_PER_HOUR=3`
  - [ ] `MORNING_BRIEFING_HOUR=8`
  - [ ] `PRE_MEETING_MINUTES=15`
  - [ ] `CALENDAR_POLL_INTERVAL=300000`
  - [ ] `EMAIL_POLL_INTERVAL=600000`
  - [ ] `MESSAGE_BATCH_INTERVAL=30000`

### Dependency Cleanup (from codebase analysis)
- [ ] Remove duplicate `composio-core` (keep `@composio/core`)
- [ ] Remove unused `uuid` dependency
- [ ] Remove redundant `dotenv` dependency (Bun loads .env automatically)
- [ ] Choose one package manager and delete extra lock files:
  - [ ] Keep `bun.lock` OR
  - [ ] Delete `pnpm-lock.yaml` and `package-lock.json`

### Config Module
- [ ] `src/config.ts` loads all environment variables
- [ ] All config properties exported and typed

---

## 🗄️ PRIORITY 3: DATABASE IMPLEMENTATION

### Database Setup
- [ ] SQLite database initializes without errors
- [ ] All tables created:
  - [ ] `messages` table (Listener stores all observed messages)
  - [ ] `tasks` table (extracted by Listener)
  - [ ] `people` table (entity graph)
  - [ ] `agent_messages` table (Agent ↔ Johnny thread)
  - [ ] `proactive_log` table (for anti-repetition + rate limiting)

### Database Schema Verification
- [ ] Messages table has: id, chat_id, sender, content, timestamp, direction, has_attachment, attachment_type, attachment_path, processed
- [ ] Tasks table has: id, source, source_ref, description, assigned_by, assigned_to, deadline, urgency, status, created_at, updated_at
- [ ] People table has: id, name, phone, email, last_contact, relationship_context, open_tasks
- [ ] Agent_messages table has: id, direction, content, message_type, audio_path, timestamp
- [ ] Proactive_log table has: id, trigger_type, content_hash, sent_at

### Database Functions
- [ ] CRUD operations work for all tables
- [ ] Query performance acceptable (indexes on foreign keys)
- [ ] Data persists across restarts

---

## 🤖 PRIORITY 4: MINIMAX INTEGRATION

### LLM (M2.7)
- [ ] `src/minimax/llm.ts` - `getCompletion()` function works
- [ ] OpenAI-compatible endpoint configured
- [ ] Tool calling supported
- [ ] JSON mode works
- [ ] Context window (204K) utilized properly
- [ ] Response quality acceptable for task extraction

### TTS (Speech 2.8)
- [ ] `src/minimax/tts.ts` - `textToSpeech()` function works
- [ ] Generates .m4a audio files
- [ ] Emotion control works (neutral, happy, sad, angry, fearful, disgusted, surprised)
- [ ] Language support verified:
  - [ ] English voice output
  - [ ] Korean voice output (for demo)
- [ ] Audio quality acceptable
- [ ] Latency acceptable for real-time use

### Vision
- [ ] `src/minimax/vision.ts` - `analyzeImage()` function works
- [ ] Accepts image file or base64
- [ ] Returns text description/analysis
- [ ] Works with photos sent via iMessage

### Integration Tests
- [ ] Send prompt → get response (LLM)
- [ ] Generate voice note → save to file (TTS)
- [ ] Receive photo → send to Vision → get description (Vision)

---

## 📱 PRIORITY 5: iMESSAGE INTEGRATION

### Photon iMessage Kit
- [ ] `@photon-ai/imessage-kit` installed and working
- [ ] `src/imessage/sdk.ts` implemented:
  - [ ] `sendText()` function
  - [ ] `sendAudio()` function
  - [ ] `startListening()` function
  - [ ] `send()` with file attachments
- [ ] Can read incoming messages via `startWatching`
- [ ] Can send text messages via `sdk.send()`
- [ ] Can send file attachments via `sdk.send({files: [path]})`

### Message Routing
- [ ] `src/imessage/router.ts` - Message routing logic implemented
- [ ] Separate Listener messages (all chats) from Agent messages (dedicated thread)
- [ ] Filter system messages, read receipts, delivery notifications
- [ ] Detect image attachments
- [ ] Detect voice attachments

### Listener Implementation
- [ ] `src/listener/watcher.ts` - iMessage Kit startWatching, message ingestion
- [ ] `src/listener/extractor.ts` - M2.7 entity extraction (tasks, people, commitments)
- [ ] `src/listener/crossref.ts` - Calendar + email cross-referencing
- [ ] `src/listener/triggers.ts` - Proactive trigger detection

### Agent Implementation
- [ ] `src/agent/router.ts` - Message routing (text vs photo vs command)
- [ ] `src/agent/responder.ts` - M2.7 response generation with context
- [ ] `src/agent/proactive.ts` - Scheduled proactive messages (morning, pre-meeting)
- [ ] `src/agent/pipeline.ts` - Delivery pipeline (rate limit, quiet hours, anti-repeat)
- [ ] `src/agent/personality.ts` - System prompt, banned words, style rules

---

## 📅 PRIORITY 6: COMPOSIO INTEGRATION

### Composio Setup
- [ ] Single Composio package used (not duplicate)
- [ ] `src/integrations/composio.ts` - Full implementation working
- [ ] OAuth flow configured for Johnny's Google account
- [ ] API key properly set

### Google Calendar Integration
- [ ] `src/integrations/calendar.ts` - Google Calendar integration implemented
- [ ] `src/composio/calendar.ts` - DELETE (duplicate, consolidate)
- [ ] Can pull today's events
- [ ] Can pull tomorrow's events
- [ ] Can detect free blocks
- [ ] Can list event attendees
- [ ] Real calendar data accessible

### Gmail Integration
- [ ] `src/integrations/gmail.ts` - Gmail integration implemented
- [ ] Can pull unread emails
- [ ] Can pull urgent emails
- [ ] Can fetch email threads
- [ ] Real email data accessible

### Composio Agent
- [ ] `src/agents/ComposioAgent.ts` - DELETE (mock agent, unused)
- [ ] Composio client used only in integrations folder

---

## 🧠 PRIORITY 7: LISTENER INTELLIGENCE

### Entity Extraction (MiniMax M2.7)
- [ ] Extraction prompt implemented for:
  - [ ] People mentioned (names, contact references)
  - [ ] Tasks/Asks ("can you send me X", "please review Y")
  - [ ] Commitments ("I'll do X", "I'll be there at Y")
  - [ ] Meetup Plans (date/time/place mentions)
  - [ ] Questions Pending (asked TO user without answers)
  - [ ] Deadlines (explicit dates, "by Friday")
  - [ ] Sentiment/Urgency (1-5 scale)

### Storage & Processing
- [ ] Messages stored in SQLite with all metadata
- [ ] Entity extraction runs on incoming messages
- [ ] Batching works (process every 30 seconds)
- [ ] Extracted entities stored in tasks table
- [ ] Extracted entities stored in people table

### Cross-Referencing
- [ ] For each extracted meetup → check calendar for conflicts
- [ ] For each calendar event → check Gmail for related threads
- [ ] Detect unprepped meetings
- [ ] Detect double-bookings
- [ ] Detect free blocks available for tasks

### Proactive Triggers
- [ ] New urgent task extracted → triggers Agent notification
- [ ] Calendar event in 15 min + unprepped → triggers pre-meeting brief
- [ ] Commitment deadline approaching → triggers reminder
- [ ] Unanswered question older than 24h → triggers follow-up nudge
- [ ] Pattern: 3+ tasks from same person → triggers backlog notification

---

## 🎤 PRIORITY 8: AGENT FUNCTIONALITY

### Morning Voice Briefing (Proactive)
- [ ] Trigger: Scheduled, configurable time (default 8am)
- [ ] Pulls today's calendar events
- [ ] Pulls overnight tasks from Listener
- [ ] Generates urgency-ranked task queue
- [ ] Optimal sequencing suggestions
- [ ] Output: MiniMax TTS voice note + text summary
- [ ] Emotion: energized/neutral

### Pre-Meeting Prep (Proactive)
- [ ] Trigger: 15 minutes before any calendar event
- [ ] Shows meeting context from calendar
- [ ] Shows related email threads from Gmail
- [ ] Shows recent conversation with person from Listener
- [ ] Output: MiniMax TTS voice note
- [ ] Emotion: neutral/calm

### Task Queue (Reactive + Proactive)
- [ ] Responds to "what should I do right now?"
- [ ] Responds to "what's on my plate?"
- [ ] All pending tasks ranked by urgency + deadline
- [ ] Source attribution ("Kayla asked in GC", "Prof. Kim emailed")
- [ ] Time estimates and scheduling suggestions
- [ ] Calendar-aware sequencing
- [ ] Output: MiniMax TTS voice note + structured text list

### Follow-Up Nudges (Proactive)
- [ ] Commitment deadline approaching
- [ ] 24h+ since unanswered question
- [ ] Contextual suggestions ("want me to draft a message?")
- [ ] Output: MiniMax TTS voice note with suggested action

### Draft Messages (Reactive)
- [ ] Trigger: "draft a reply to X"
- [ ] Context-aware draft generation
- [ ] Presents for user approval
- [ ] Output: Text draft for review

### Photo Processing (Reactive)
- [ ] Trigger: User sends photo to Agent thread
- [ ] Pipeline: Photo → Vision → M2.7 → TTS response
- [ ] Receipt analysis works
- [ ] Whiteboard/action item extraction works
- [ ] Korean menu → Korean voice + English translation
- [ ] Screenshot summarization works
- [ ] Document key point extraction works
- [ ] Output: MiniMax TTS voice note with analysis

### Email Triage (Reactive)
- [ ] Trigger: "check my email" or "what emails need attention?"
- [ ] Top urgent/unread emails summarized
- [ ] Action items extracted
- [ ] Draft replies suggested
- [ ] Cross-referenced with calendar
- [ ] Output: MiniMax TTS voice note + text list

### Schedule Optimization (Reactive + Proactive)
- [ ] Trigger: "optimize my week" or scheduling opportunity detected
- [ ] Maps all tasks against calendar free blocks
- [ ] Suggests optimal sequencing
- [ ] Identifies conflicts
- [ ] Proposes resolutions
- [ ] Output: MiniMax TTS voice note with proposed schedule

---

## 🛡️ PRIORITY 9: ANTI-SPAM & SAFETY

### Rate Limiting
- [ ] Max 3 proactive messages per hour enforced
- [ ] Quiet hours: no messages 11pm-7am enforced
- [ ] Anti-repetition: hash content, skip if sent within 48h
- [ ] Notification scoring: urgency × deadline_proximity × relevance

### Privacy & Security
- [ ] Never sends messages to user's contacts
- [ ] Never shares data from one person's conversations with another
- [ ] All data stored locally in SQLite
- [ ] API keys not committed to repo

### Personality Guards
- [ ] No LLM-isms ("I'd be happy to help!", "Let me know if you need anything else!")
- [ ] Banned words enforced: Furthermore, Additionally, I'd be happy to, Let me know, Great question, Absolutely, I understand, Rest assured
- [ ] Max 120 words per message (split into multiple bubbles if longer)
- [ ] Match conversational energy
- [ ] No emojis unless user uses them first

---

## 🧪 PRIORITY 10: TESTING & QUALITY

### Error Handling
- [ ] Try-catch blocks throughout application
- [ ] Graceful degradation when services fail
- [ ] Meaningful error messages
- [ ] No unhandled promise rejections
- [ ] Logging for debugging

### Unit Tests
- [ ] Config module tests
- [ ] Database CRUD tests
- [ ] MiniMax API integration tests
- [ ] Message routing tests
- [ ] Entity extraction prompt tests

### Integration Tests
- [ ] Full listener loop test
- [ ] Full agent loop test
- [ ] iMessage send/receive test
- [ ] Calendar integration test
- [ ] Gmail integration test

### Linting & Type Checking
- [ ] ESLint runs without errors
- [ ] TypeScript compiles without errors
- [ ] No type assertions where types are available
- [ ] Consistent code style

---

## 📦 PRIORITY 11: CLEANUP (From Codebase Analysis)

### Delete Unused Files
- [ ] `src/agents/` directory - DELETE (unused mock agents)
- [ ] `src/orchestrator.ts` - DELETE (not imported anywhere)
- [ ] `src/composio/calendar.ts` - DELETE (duplicate)
- [ ] `src/agents/ComposioAgent.ts` - DELETE (mock agent)
- [ ] `index.ts` (root) - DELETE (leftover scaffold)
- [ ] `sdk_example.py` - DELETE (unrelated Python file)
- [ ] `ideation-doc/` folder - DELETE (outdated hackathon docs)

### Documentation Cleanup
- [ ] Consolidate duplicate PRD files
- [ ] Delete redundant architecture docs
- [ ] Single source of truth for specs in `.trae/documents/`

### Lock File Cleanup
- [ ] Delete `pnpm-lock.yaml` (if using Bun)
- [ ] Delete `package-lock.json` (if using Bun)

---

## 🎯 PRIORITY 12: SUCCESS CRITERIA (From PRD)

The project is complete when:

1. [ ] Listener watches iMessage conversations
2. [ ] Listener extracts tasks/commits/asks into SQLite
3. [ ] Agent responds to messages in dedicated thread
4. [ ] Agent responses are context-aware
5. [ ] Voice notes generated via MiniMax TTS
6. [ ] Photos sent to Agent → Vision → Voice response works
7. [ ] Calendar integration provides real data
8. [ ] Email integration provides real data
9. [ ] At least one proactive message sends automatically (morning briefing)
10. [ ] Rate limiting and quiet hours work
11. [ ] No LLM-isms in responses
12. [ ] Korean voice output works (for demo)

---

## 🚀 PRIORITY 13: HACKATHON SUBMISSION (If Applicable)

### Submission Requirements
- [ ] Project name + tagline
- [ ] 2-3 paragraph description
- [ ] Demo link
- [ ] Description of MiniMax API usage
- [ ] Description of TRAE stack usage
- [ ] Public GitHub repo with commit history
- [ ] 2-minute demo video
- [ ] 5-slide deck

### Demo Flow (3 minutes)
- [ ] 0:00-0:15 - Hook + architecture explanation
- [ ] 0:15-0:55 - Morning briefing voice note plays
- [ ] 0:55-1:20 - Live interaction ("what's on my plate?")
- [ ] 1:20-1:40 - Photo intelligence (receipt analysis)
- [ ] 1:40-2:00 - Korean menu → Korean voice response
- [ ] 2:00-2:15 - Listener in action explanation
- [ ] 2:15-2:30 - Architecture slide + closer

### Commit History
- [ ] Shows TRAE AI usage
- [ ] Shows MCP integration
- [ ] Shows multi-agent orchestration
- [ ] Clean, readable commit messages

---

## 📊 VERIFICATION SUMMARY

### Quick Status Check
Run these commands to verify status:

```bash
# Check all exports work
bun run --watch

# Test iMessage connection
bun run src/imessage/test.ts

# Test MiniMax APIs
bun run src/minimax/test.ts

# Test database
bun run src/memory/test.ts

# Test Composio
bun run src/integrations/test.ts

# Full integration test
bun run src/index.ts

# Lint
bun run lint

# Type check
tsc --noEmit
```

### File Structure Verification
```
src/
├── index.ts ✓
├── config.ts ✓
├── listener/
│   ├── watcher.ts
│   ├── extractor.ts
│   ├── crossref.ts
│   └── triggers.ts
├── agent/
│   ├── router.ts
│   ├── responder.ts
│   ├── proactive/
│   │   ├── index.ts
│   │   ├── engine.ts
│   │   ├── triggers-event.ts
│   │   └── triggers-scheduled.ts
│   ├── context.ts
│   ├── handler.ts
│   └── personality.ts
├── integrations/
│   ├── composio.ts ✓
│   ├── calendar.ts ✓
│   └── gmail.ts ✓
├── minimax/
│   ├── client.ts (EMPTY - fix or delete)
│   ├── llm.ts ✓
│   ├── tts.ts ✓
│   └── vision.ts ✓
├── memory/
│   ├── db.ts ✓
│   ├── messages.ts (EMPTY - fix or delete)
│   ├── tasks.ts (EMPTY - fix or delete)
│   └── people.ts ✓
├── imessage/
│   ├── sdk.ts ✓
│   ├── router.ts ✓
│   └── listener.ts (PLACEHOLDER - implement or delete)
└── utils/
    ├── time.ts ✓
    └── hash.ts ✓
```

---

## 🎉 DONE! 

When all checkboxes above are marked complete, the project is production-ready.

**Last Updated**: March 28, 2026
**Total Checkboxes**: ~150+
**Estimated Completion**: When all items checked off
