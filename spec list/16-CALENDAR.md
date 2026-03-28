# Calendar Integration Specification

## Overview
The calendar module provides Google Calendar integration via Composio.

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

**Strategies:**
1. `GOOGLECALENDAR_FIND_EVENT` with calendarId
2. `GOOGLECALENDAR_EVENTS_LIST`
3. `GOOGLECALENDAR_FIND_EVENT` without calendarId

### `normalize(event): CalendarEvent`
Normalizes raw API response.

### `findFreeBlocks(events): FreeBlock[]`
Calculates free time blocks between events.

**Algorithm:**
1. Sort events by start time
2. For each gap >= 30 min, add to blocks
