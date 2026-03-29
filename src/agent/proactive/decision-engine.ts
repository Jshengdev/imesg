import { analyzeCalendar, type CalendarAnalysis } from "../../integrations/calendar";
import { analyzeGmail, type GmailAnalysis } from "../../integrations/gmail";
import { getTaskQueue, getRecentConversation, wasRecentlySent, countRecentProactive } from "../../memory/db";
import { generateJSON } from "../../minimax/llm";
import { sendProactive } from "./engine";
import { nowDate, now } from "../../demo";
import { config } from "../../config";
import { createHash } from "crypto";
import { rankTasks } from "../ranking";

// --- Caching layer ---

let cachedCalendar: { data: CalendarAnalysis; at: number } | null = null;
let cachedEmail: { data: GmailAnalysis; at: number } | null = null;

async function getCachedCalendar(phone?: string, maxAgeMs = 120_000): Promise<CalendarAnalysis> {
  if (cachedCalendar && now() - cachedCalendar.at < maxAgeMs) return cachedCalendar.data;
  const data = await analyzeCalendar(phone);
  cachedCalendar = { data, at: now() };
  return data;
}

async function getCachedEmail(phone?: string, maxAgeMs = 300_000): Promise<GmailAnalysis> {
  if (cachedEmail && now() - cachedEmail.at < maxAgeMs) return cachedEmail.data;
  const data = await analyzeGmail(phone);
  cachedEmail = { data, at: now() };
  return data;
}

export function invalidateCache(): void {
  cachedCalendar = null;
  cachedEmail = null;
}

// --- Decision types ---

export interface EvalResult {
  action: "send" | "queue" | "update_tasks" | "suggest_block" | "silent";
  message?: string;
  reason: string;
}

// --- Scoring ---

function scoreDisruption(cal: CalendarAnalysis): number {
  const currentTime = nowDate();

  // Currently in a meeting
  const inMeeting = cal.events.some(e => e.start <= currentTime && e.end > currentTime);
  if (inMeeting) return 8;

  // Meeting in < 15 min
  const soonMeeting = cal.events.find(e => {
    const ms = e.start.getTime() - currentTime.getTime();
    return ms > 0 && ms < config.PRE_MEETING_MINUTES * 60 * 1000;
  });
  if (soonMeeting) return 7;

  // Quiet hours
  const h = currentTime.getHours();
  if (h >= config.QUIET_HOURS_START || h < config.QUIET_HOURS_END) return 10;

  // Free right now
  return 2;
}

// --- Main evaluation ---

const DECISION_PROMPT = `you are evaluating whether to send a proactive message to the user.

given:
- what triggered this: {trigger}
- new information: {newData}
- current tasks (ranked): {tasks}
- calendar: {calendar}
- recent conversation: {conversation}
- what you already told them recently: {priorMessages}
- current time: {time}

return JSON:
{
  "urgency": 1-10,
  "should_send": true/false,
  "message": "the proactive message to send (in nudge voice — lowercase, casual, short)",
  "reason": "why or why not"
}

urgency guide:
- 9-10: hard deadline < 24hr, or critical contradiction found
- 7-8: same person in 2+ sources, new email from meeting attendee
- 5-6: useful connection or reminder
- 3-4: routine check, nothing pressing
- 1-2: nothing actionable

CRITICAL rules:
- check what you already told them (above). if you already said it, DO NOT repeat it
- if nothing new since last message: should_send = false
- if the only change is a deadline getting closer: short and calm — "same as before, just watch out for [X] tomorrow"
- max 2 sentences. usually 1
- be specific — use names, times, subjects
- don't send just to send. silence > noise
- only send if there is genuinely NEW information or a deadline that just became urgent`;

export async function evaluate(
  trigger: string,
  userId: string,
  chatId: string,
  phone: string,
  newData?: string,
): Promise<EvalResult> {
  try {
    // Rate limit check
    const recentCount = countRecentProactive(60, userId);
    if (recentCount >= config.MAX_PROACTIVE_PER_HOUR) {
      return { action: "silent", reason: "rate limited" };
    }

    // Assemble snapshot
    const [cal, gmail] = await Promise.all([
      getCachedCalendar(phone),
      getCachedEmail(phone),
    ]);
    const tasks = getTaskQueue(userId);
    const ranked = rankTasks(tasks, cal.freeBlocks);
    const conversation = getRecentConversation(5, userId);
    const currentTime = nowDate();

    const disruption = scoreDisruption(cal);

    // Get what we already told them recently
    const priorOutgoing = conversation
      .filter(c => c.direction === "out")
      .slice(0, 5)
      .map(c => c.content.slice(0, 100))
      .join("\n");

    // Build prompt
    const prompt = DECISION_PROMPT
      .replace("{trigger}", trigger)
      .replace("{newData}", newData || "none")
      .replace("{tasks}", ranked.slice(0, 5).map(t => `${t.description} (urgency ${t.urgency}, ${t.estimated_minutes}min${t.deadline ? `, due ${t.deadline}` : ""})`).join("; "))
      .replace("{calendar}", cal.insights || "no calendar data")
      .replace("{conversation}", conversation.map(c => `${c.direction}: ${c.content.slice(0, 60)}`).join("\n") || "none")
      .replace("{priorMessages}", priorOutgoing || "nothing yet — first message")
      .replace("{time}", currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));

    const result = await generateJSON(
      "you are a proactive intelligence engine. evaluate and return JSON only.",
      prompt,
    );

    const urgency = typeof result.urgency === "number" ? result.urgency : 3;
    const message = result.message || "";

    // Decision gate
    if (!result.should_send || urgency < disruption) {
      return { action: "queue", reason: result.reason || `urgency ${urgency} < disruption ${disruption}` };
    }

    // Dedup check
    const hash = createHash("md5").update(message).digest("hex");
    if (wasRecentlySent(hash, 48 * 60, userId)) {
      return { action: "silent", reason: "dedup: similar message sent recently" };
    }

    // Send it
    await sendProactive(trigger, message, userId, chatId, phone);
    return { action: "send", message, reason: result.reason || `urgency ${urgency} > disruption ${disruption}` };

  } catch (err) {
    console.warn("[decision-engine] evaluation failed:", err);
    return { action: "silent", reason: `error: ${(err as Error).message}` };
  }
}
