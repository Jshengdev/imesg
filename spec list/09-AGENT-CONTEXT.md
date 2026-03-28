# Agent Context Module Specification

## Overview
The context module (`src/agent/context.ts`) assembles contextual information from various sources (calendar, tasks, email, conversation) for the agent to use in generating responses.

## Dependencies
- Internal: `pullTodayEvents`, `findFreeBlocks` from `../integrations/calendar`
- Internal: `getTaskQueue`, `getRecentConversation`, `getPersonDossier` from `../memory/db`
- Internal: `pullUnreadEmails` from `../integrations/gmail`

## Data Types

### CalendarEvent
```typescript
interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
}
```

### FreeBlock
```typescript
interface FreeBlock {
  start: Date;
  end: Date;
  durationMin: number;
}
```

### EmailSummary
```typescript
interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
}
```

## Public API

### `fmtTime(date: Date): string`
Formats time in 12-hour format with AM/PM.

**Example:** `fmtTime(new Date(2026, 3, 28, 14, 30))` → `"2:30 PM"`

### `fmtEvents(events: CalendarEvent[]): string`
Formats calendar events as markdown section.

**Output:**
```markdown
## your schedule today
- 10:00 AM: Team Standup (Alice, Bob)
- 2:30 PM: Project Review
```

### `fmtFreeBlocks(blocks: FreeBlock[]): string`
Formats free time blocks as markdown section.

**Output:**
```markdown
## free blocks
- 11:00 AM-12:00 PM (60 min)
- 3:00 PM-4:30 PM (90 min)
```

### `fmtTasks(tasks: any[]): string`
Formats tasks as numbered list with urgency and deadline.

**Output:**
```markdown
## task queue
1. Review PR from Sarah [urgency: 4] [due: today]
2. Update documentation [urgency: 3] [due: tomorrow]
```

### `fmtEmails(emails: EmailSummary[]): string`
Formats top 5 emails as bullet list.

**Output:**
```markdown
## unread emails
- from Alice: Re: Project Update — Hey, just wanted to give you a quick...
- from Bob: Meeting Tomorrow — Don't forget we have our weekly sync...
```

### `fmtConversation(entries: any[]): string`
Formats recent conversation for context.

**Output:**
```markdown
## recent conversation
user: can you check my calendar for tomorrow?
nudge: looks like you have two meetings... what do you need?
```

### `getSectionOrder(intent?: string): string[]`
Returns ordered section list based on user intent.

| Intent | Section Order |
|--------|---------------|
| `task` | conversation, tasks, blocks, events, emails |
| `email` | conversation, emails, tasks, events, blocks |
| `schedule` | conversation, events, blocks, tasks, emails |
| `draft` | conversation, emails, tasks, events, blocks |
| `person` | conversation, tasks, emails, events, blocks |
| default | conversation, events, blocks, tasks, emails |

### `extractPersonName(text: string): string | null`
Extracts person name from text using patterns:
- "what did Sarah say..."
- "anything from John..."
- "to Alice..."

### `extractDraftRecipient(text: string): string | null`
Extracts email recipient from draft requests:
- "reply to Sarah about..."
- "draft email to Bob..."

### `assembleContext(intent?: string, userText?: string): Promise<string>`
Assembles all context data into formatted sections.

**Parameters:**
- `intent?: string` - User intent for section ordering
- `userText?: string` - User text for person/draft extraction

**Returns:** Formatted context string with sections

**Behavior:**
1. Fetches events, tasks, emails, conversation in parallel
2. Calculates free blocks from events
3. Orders sections by intent
4. Adds dossier section for person/draft intents
5. Dossier is prepended if present

## Usage Example
```typescript
import { assembleContext } from './context';

// Get full context for agent
const context = await assembleContext('schedule');
// Returns formatted sections with calendar first

// Get context with person extraction
const contextWithPerson = await assembleContext('person', 'what did Sarah say?');
// Returns context with Sarah's dossier prepended
```
