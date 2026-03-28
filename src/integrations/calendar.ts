import { executeWithFallback } from "./composio.js";

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
}

export interface FreeBlock {
  start: Date;
  end: Date;
  durationMin: number;
}

const CALENDAR_SEARCH_KEYS = ["items", "events", "event_data", "results", "data"];

function getTodayDateRange(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  return {
    timeMin: startOfToday.toISOString(),
    timeMax: startOfTomorrow.toISOString()
  };
}

export function normalize(e: any): CalendarEvent {
  const title = e.summary || e.title || "(no title)";

  let start: Date;
  let end: Date;

  if (e.start?.dateTime) {
    start = new Date(e.start.dateTime);
  } else if (e.start?.date) {
    start = new Date(e.start.date);
  } else {
    start = new Date();
  }

  if (e.end?.dateTime) {
    end = new Date(e.end.dateTime);
  } else if (e.end?.date) {
    end = new Date(e.end.date);
  } else {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const attendees: string[] = [];
  if (e.attendees && Array.isArray(e.attendees)) {
    for (const a of e.attendees) {
      const emailOrName = a.email || a.displayName;
      if (emailOrName) {
        attendees.push(emailOrName);
      }
    }
  }

  return {
    title,
    start,
    end,
    attendees
  };
}

export async function pullTodayEvents(): Promise<CalendarEvent[]> {
  const { timeMin, timeMax } = getTodayDateRange();

  const strategies = [
    {
      actionName: "GOOGLECALENDAR_FIND_EVENT",
      params: {
        calendarId: "primary",
        timeMin,
        timeMax
      }
    },
    {
      actionName: "GOOGLECALENDAR_LIST_EVENTS",
      params: {
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 250
      }
    },
    {
      actionName: "GOOGLECALENDAR_FIND_EVENT",
      params: {
        timeMin,
        timeMax
      }
    }
  ];

  const rawEvents = await executeWithFallback(
    strategies,
    CALENDAR_SEARCH_KEYS,
    "pullTodayEvents"
  );

  return rawEvents.map(normalize);
}

export function findFreeBlocks(events: CalendarEvent[]): FreeBlock[] {
  if (events.length === 0) {
    return [];
  }

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  const freeBlocks: FreeBlock[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = sorted[i].end;
    const nextStart = sorted[i + 1].start;

    if (nextStart > currentEnd) {
      const durationMs = nextStart.getTime() - currentEnd.getTime();
      const durationMin = Math.floor(durationMs / (1000 * 60));

      if (durationMin >= 30) {
        freeBlocks.push({
          start: currentEnd,
          end: nextStart,
          durationMin
        });
      }
    }
  }

  return freeBlocks;
}
