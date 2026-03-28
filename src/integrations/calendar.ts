import { executeWithFallback, getUserEntity, isMockMode } from "./composio";
import { generateJSON } from "../minimax/llm";
import { nowDate } from "../demo";
import { fmtTime } from "../utils";

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  durationMin: number;
}

export interface FreeBlock {
  start: Date;
  end: Date;
  durationMin: number;
}

export interface CalendarAnalysis {
  events: CalendarEvent[];
  freeBlocks: FreeBlock[];
  insights: string;
  tags: string[];
}

const SEARCH_KEYS = ["items", "events", "event_data", "results", "data"];

// --- Pull + Normalize ---

export async function pullTodayEvents(phone?: string): Promise<CalendarEvent[]> {
  const now = nowDate();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const raw = await executeWithFallback([
    { actionName: "GOOGLECALENDAR_FIND_EVENT", params: { calendarId: "primary", timeMin, timeMax } },
    { actionName: "GOOGLECALENDAR_EVENTS_LIST", params: { calendarId: "primary", timeMin, timeMax, maxResults: 250 } },
    { actionName: "GOOGLECALENDAR_FIND_EVENT", params: { timeMin, timeMax } },
  ], SEARCH_KEYS, "calendar", phone);
  return raw.map(normalize);
}

function normalize(e: any): CalendarEvent {
  const startStr = e.start?.dateTime || e.start?.date || e.start;
  const endStr = e.end?.dateTime || e.end?.date || e.end;
  const start = new Date(startStr);
  const end = new Date(endStr);
  return {
    title: e.summary || e.title || "(no title)",
    start,
    end,
    attendees: (e.attendees || []).map((a: any) => a.email || a.displayName || "").filter(Boolean),
    durationMin: Math.round((end.getTime() - start.getTime()) / 60000),
  };
}

// --- Structural Analysis (no LLM) ---

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

function analyzeStructure(events: CalendarEvent[]): { totalHours: number; backToBack: number; focusBlocks: number; tags: string[] } {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const totalHours = events.reduce((acc, e) => acc + e.durationMin / 60, 0);

  let backToBack = 0;
  let focusBlocks = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gapMin = (sorted[i].start.getTime() - sorted[i - 1].end.getTime()) / 60000;
    if (gapMin < 15) backToBack++;
    if (gapMin >= 120) focusBlocks++;
  }

  const tags: string[] = [];
  if (events.length > 5) tags.push("meeting_heavy");
  if (events.length <= 2) tags.push("meeting_light");
  if (backToBack >= 2) tags.push("back_to_back");
  if (focusBlocks > 0) tags.push("has_focus_blocks");

  return { totalHours, backToBack, focusBlocks, tags };
}

// --- LLM Analysis ---

const CALENDAR_ANALYSIS_PROMPT = `you are analyzing a user's calendar for today. extract ACTIONABLE insights only.

given the schedule below, return JSON:
{
  "insights": [
    "one sentence insight — what matters, what to watch out for, what to prep"
  ],
  "busiest_window": "e.g. 10am-2pm",
  "prep_needed": ["meeting title that needs prep and why"],
  "conflicts": ["any overlapping or too-tight transitions"]
}

be specific. reference actual meeting names and times. skip obvious stuff like "you have meetings today".
if there's nothing interesting, return empty arrays.`;

export async function analyzeCalendar(phone?: string): Promise<CalendarAnalysis> {
  const events = await pullTodayEvents(phone);
  const freeBlocks = findFreeBlocks(events);
  const structure = analyzeStructure(events);

  if (events.length === 0) {
    return { events, freeBlocks, insights: "clear schedule today — no meetings", tags: ["empty_calendar"] };
  }

  // Build schedule text for LLM
  const scheduleText = events
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(e => `- ${fmtTime(e.start)}-${fmtTime(e.end)}: ${e.title} (${e.durationMin}min)${e.attendees.length ? ` with ${e.attendees.slice(0, 3).join(", ")}` : ""}`)
    .join("\n");

  const blocksText = freeBlocks.length
    ? "\nfree blocks:\n" + freeBlocks.map(b => `- ${fmtTime(b.start)}-${fmtTime(b.end)} (${b.durationMin}min)`).join("\n")
    : "";

  const structText = `\n${events.length} meetings, ${Math.round(structure.totalHours)}h total, ${structure.backToBack} back-to-back, ${structure.focusBlocks} focus blocks (2h+ gaps)`;

  try {
    const analysis = await generateJSON(CALENDAR_ANALYSIS_PROMPT, scheduleText + blocksText + structText);
    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    const prepNeeded = Array.isArray(analysis.prep_needed) ? analysis.prep_needed : [];
    const conflicts = Array.isArray(analysis.conflicts) ? analysis.conflicts : [];

    const allInsights = [...insights, ...prepNeeded.map((p: string) => `prep: ${p}`), ...conflicts.map((c: string) => `conflict: ${c}`)];
    return {
      events,
      freeBlocks,
      insights: allInsights.length ? allInsights.join("\n") : `${events.length} meetings today, ${Math.round(structure.totalHours)}h total`,
      tags: structure.tags,
    };
  } catch (err) {
    console.warn("[calendar] LLM analysis failed, using structural:", err);
    return {
      events,
      freeBlocks,
      insights: `${events.length} meetings today, ${Math.round(structure.totalHours)}h total${structure.backToBack ? `, ${structure.backToBack} back-to-back` : ""}`,
      tags: structure.tags,
    };
  }
}

export async function blockTime(
  title: string,
  startTime: Date,
  durationMin: number,
  phone?: string,
): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) return { success: false, message: "composio offline — can't block time" };

  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
  const dateStr = startTime.toISOString().split("T")[0];

  const strategies = [
    { actionName: "GOOGLECALENDAR_CREATE_EVENT", params: { summary: title, start_time: startTime.toISOString(), end_time: endTime.toISOString(), calendarId: "primary" } },
    { actionName: "GOOGLECALENDAR_CREATE_EVENT", params: { title, start: { dateTime: startTime.toISOString() }, end: { dateTime: endTime.toISOString() } } },
    { actionName: "GOOGLECALENDAR_CREATE_EVENT", params: { summary: title, start_date_time: startTime.toISOString(), end_date_time: endTime.toISOString() } },
    { actionName: "GOOGLECALENDAR_EVENTS_INSERT", params: { summary: title, start: { dateTime: startTime.toISOString() }, end: { dateTime: endTime.toISOString() } } },
  ];

  try {
    const entity = phone ? await getUserEntity(phone) : null;
    for (const s of strategies) {
      try {
        const result = entity
          ? await entity.execute(s)
          : await executeWithFallback([s], ["id", "eventId", "success", "created"], "calendar-block", phone);
        if (result) {
          console.log(`[calendar] blocked ${fmtTime(startTime)}-${fmtTime(endTime)}: ${title}`);
          return { success: true, message: `blocked ${dateStr} ${fmtTime(startTime)}-${fmtTime(endTime)} — ${title}` };
        }
      } catch (err) {
        console.warn(`[calendar] ${s.actionName} failed:`, (err as Error).message);
      }
    }
    return { success: false, message: "couldn't block time — all strategies failed" };
  } catch (err) {
    return { success: false, message: `block failed: ${(err as Error).message}` };
  }
}

export async function findAndBlockTime(
  title: string,
  durationMin: number,
  preferredDate?: Date,
  phone?: string,
): Promise<{ success: boolean; message: string; blockedTime?: { start: Date; end: Date } }> {
  const targetDate = preferredDate || new Date();

  if (isMockMode()) return { success: false, message: "composio offline — can't find time" };

  const events = await pullTodayEvents(phone);
  const freeBlocks = findFreeBlocks(events).filter(b => b.durationMin >= durationMin);

  if (freeBlocks.length === 0) {
    const tomorrow = new Date(targetDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return await blockTime(title, tomorrow, durationMin, phone).then(r => ({
      ...r,
      blockedTime: r.success ? { start: tomorrow, end: new Date(tomorrow.getTime() + durationMin * 60000) } : undefined
    }));
  }

  const block = freeBlocks[0];
  const result = await blockTime(title, block.start, durationMin, phone);
  return {
    ...result,
    blockedTime: result.success ? { start: block.start, end: block.end } : undefined
  };
}
