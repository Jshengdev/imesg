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

const SEARCH_KEYS = ["items", "events", "event_data", "results", "data"];

export async function pullTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const raw = await executeWithFallback([
    { actionName: "GOOGLECALENDAR_FIND_EVENT", params: { calendarId: "primary", timeMin, timeMax } },
    { actionName: "GOOGLECALENDAR_EVENTS_LIST", params: { calendarId: "primary", timeMin, timeMax, maxResults: 250 } },
    { actionName: "GOOGLECALENDAR_FIND_EVENT", params: { timeMin, timeMax } },
  ], SEARCH_KEYS, "calendar");
  return raw.map(normalize);
}

function normalize(e: any): CalendarEvent {
  const startStr = e.start?.dateTime || e.start?.date || e.start;
  const endStr = e.end?.dateTime || e.end?.date || e.end;
  return {
    title: e.summary || e.title || "(no title)",
    start: new Date(startStr),
    end: new Date(endStr),
    attendees: (e.attendees || []).map((a: any) => a.email || a.displayName || "").filter(Boolean),
  };
}

export function findFreeBlocks(events: CalendarEvent[]): FreeBlock[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const blocks: FreeBlock[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const durationMin = (curr.start.getTime() - prev.end.getTime()) / 60000;
    if (durationMin >= 30) blocks.push({ start: prev.end, end: curr.start, durationMin });
  }
  return blocks;
}
