# Agent Context Module Specification

## Overview
The context module assembles contextual information from various sources for the agent.

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
Formats time in 12-hour AM/PM format.

### `fmtEvents(events): string`
Formats calendar events as markdown.

### `fmtFreeBlocks(blocks): string`
Formats free time blocks as markdown.

### `fmtTasks(tasks): string`
Formats tasks as numbered list.

### `fmtEmails(emails): string`
Formats emails as bullet list.

### `fmtConversation(entries): string`
Formats recent conversation.

### `getSectionOrder(intent?): string[]`
Returns ordered section list based on intent.

### `extractPersonName(text): string | null`
Extracts person name from patterns.

### `assembleContext(intent?, userText?): Promise<string>`
Assembles all context into formatted sections.
