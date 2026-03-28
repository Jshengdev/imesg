# Calendar Integration Specification

## Overview
The calendar module (`src/integrations/calendar.ts`) provides Google Calendar integration via Composio.

## Dependencies
- Internal: `executeWithFallback` from `./composio`

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

## Public API

### `pullTodayEvents(): Promise<CalendarEvent[]>`
Retrieves today's calendar events.

**Returns:** Array of CalendarEvent objects

**Execution Strategies (in order):**
1. `GOOGLECALENDAR_FIND_EVENT` with `calendarId: "primary"`
2. `GOOGLECALENDAR_EVENTS_LIST` with `calendarId: "primary"`
3. `GOOGLECALENDAR_FIND_EVENT` without `calendarId`

**Search Keys:** `["items", "events", "event_data", "results", "data"]`

### `normalize(event: any): CalendarEvent`
Normalizes raw API response to CalendarEvent format.

**Parameters:**
- `event: any` - Raw event from API

**Returns:** Normalized CalendarEvent

**Field Mapping:**
| Raw Field | Normalized Field |
|-----------|------------------|
| `event.start.dateTime` | `start` |
| `event.start.date` | `start` (as date) |
| `event.summary` | `title` |
| `event.title` | `title` |
| `event.attendees` | `attendees` |

**Attendee Extraction:**
```typescript
attendees: (e.attendees || []).map((a: any) => a.email || a.displayName || "").filter(Boolean)
```

### `findFreeBlocks(events: CalendarEvent[]): FreeBlock[]`
Calculates free time blocks between events.

**Parameters:**
- `events: CalendarEvent[]` - Sorted array of events

**Returns:** Array of FreeBlock where gap >= 30 minutes

**Algorithm:**
1. Sort events by start time
2. For each adjacent pair:
   - Calculate gap between previous end and current start
   - If gap >= 30 min, add to blocks

**Example:**
```
Events: [10:00-11:00, 14:00-15:00]
FreeBlocks: [{start: 11:00, end: 14:00, durationMin: 180}]
```

## Usage Example
```typescript
import { pullTodayEvents, findFreeBlocks } from './integrations/calendar';

// Get today's events
const events = await pullTodayEvents();
console.log(`You have ${events.length} meetings today`);

// Find free time
const freeBlocks = findFreeBlocks(events);
if (freeBlocks.length > 0) {
  console.log(`You have ${freeBlocks[0].durationMin} minutes free at ${freeBlocks[0].start}`);
}
```

## Error Handling
- Returns empty array if Composio is in mock mode
- Falls back through strategies if first fails
- Returns empty events array if all strategies fail
