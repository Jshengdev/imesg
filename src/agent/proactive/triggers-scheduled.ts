import { config } from "../../config";
import { getTaskQueue } from "../../memory/db";
import { pullTodayEvents, findFreeBlocks } from "../../integrations/calendar";
import { pullUnreadEmails } from "../../integrations/gmail";
import { sendProactive } from "./engine";

export async function morningBriefing(): Promise<void> {
  try {
    await sendProactive("morning_briefing", "give a brief morning briefing: key meetings, top tasks, anything urgent from email. keep it tight.");
  } catch (e) { console.warn("[proactive] morning briefing failed:", e); }
}

export async function taskNudge(): Promise<void> {
  try {
    const tasks = getTaskQueue();
    const urgent = tasks.filter((t: any) => t.urgency >= 4);
    if (!urgent.length) return;
    const desc = urgent.slice(0, 3).map((t: any) => t.description).join("; ");
    await sendProactive("task_nudge", `nudge about these high-priority tasks: ${desc}`);
  } catch (e) { console.warn("[proactive] task nudge failed:", e); }
}

export async function emailAlert(): Promise<void> {
  try {
    const emails = await pullUnreadEmails(3);
    if (!emails.length) return;
    const summary = emails.map(e => `${e.from}: ${e.subject}`).join("; ");
    await sendProactive("email_alert", `flag these unread emails that may need attention: ${summary}`);
  } catch (e) { console.warn("[proactive] email alert failed:", e); }
}

const sentBlockTaskKeys = new Set<string>();

export async function scheduleOptimizer(): Promise<void> {
  try {
    const events = await pullTodayEvents();
    const blocks = findFreeBlocks(events);
    const now = new Date();
    const nextBlock = blocks.find(b => b.start.getTime() > now.getTime() && b.durationMin >= 30);
    if (!nextBlock) return;

    const tasks = getTaskQueue().filter((t: any) => t.urgency >= 3);
    if (!tasks.length) return;

    const top = tasks[0];
    const key = `${nextBlock.start.toISOString()}::${top.id}`;
    if (sentBlockTaskKeys.has(key)) return;
    if (sentBlockTaskKeys.size >= 200) sentBlockTaskKeys.clear();
    sentBlockTaskKeys.add(key);

    const blockTime = nextBlock.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const blockLen = nextBlock.durationMin;
    await sendProactive("schedule_optimizer",
      `you have a ${blockLen}-min gap at ${blockTime}. suggest using it for this task: "${top.description}"${top.assigned_by ? ` (from ${top.assigned_by})` : ""}. be specific about why now is the right time.`
    );
  } catch (e) { console.warn("[proactive] schedule optimizer failed:", e); }
}

const sentEscalationKeys = new Set<string>();

export async function emailEscalation(): Promise<void> {
  try {
    const emails = await pullUnreadEmails(20);
    const bySender = new Map<string, string[]>();
    for (const e of emails) {
      const key = e.from.toLowerCase();
      if (!bySender.has(key)) bySender.set(key, []);
      bySender.get(key)!.push(e.subject);
    }
    for (const [sender, subjects] of bySender) {
      if (subjects.length < 3) continue;
      const key = `escalation::${sender}`;
      if (sentEscalationKeys.has(key)) continue;
      if (sentEscalationKeys.size >= 200) sentEscalationKeys.clear();
      sentEscalationKeys.add(key);
      await sendProactive("email_escalation",
        `${sender} has ${subjects.length} unread emails: ${subjects.slice(0, 3).join("; ")}. this might need attention — suggest whether to reply now or batch.`
      );
    }
  } catch (e) { console.warn("[proactive] email escalation failed:", e); }
}

export async function endOfDayReview(): Promise<void> {
  try {
    const events = await pullTodayEvents();
    const tasks = getTaskQueue();
    const meetingCount = events.filter(e => e.attendees.length > 0).length;
    const openCount = tasks.length;
    const urgent = tasks.filter((t: any) => t.urgency >= 4).length;

    await sendProactive("eod_review",
      `end of day wrap-up. ${meetingCount} meeting${meetingCount !== 1 ? "s" : ""} today. ${openCount} task${openCount !== 1 ? "s" : ""} still open${urgent ? ` (${urgent} urgent)` : ""}. summarize what likely got done based on the meetings, flag what's still hanging, and suggest the #1 thing to start with tomorrow.`
    );
  } catch (e) { console.warn("[proactive] eod review failed:", e); }
}

export function scheduleMorningBriefing(): void {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), config.MORNING_BRIEFING_HOUR, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  setTimeout(async () => {
    await morningBriefing();
    scheduleMorningBriefing();
  }, ms);
  console.log(`[proactive] morning briefing scheduled in ${Math.round(ms / 60000)} min`);
}

export function scheduleEodReview(): void {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), config.EOD_REVIEW_HOUR, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  setTimeout(async () => {
    await endOfDayReview();
    scheduleEodReview();
  }, ms);
  console.log(`[proactive] eod review scheduled in ${Math.round(ms / 60000)} min`);
}
