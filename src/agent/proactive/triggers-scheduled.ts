import { config } from "../../config";
import { getTaskQueue } from "../../memory/db";
import { pullTodayEvents, findFreeBlocks } from "../../integrations/calendar";
import { pullUnreadEmails } from "../../integrations/gmail";
import { sendProactive } from "./engine";
import { nowDate } from "../../demo";
import { type UserCtx, dedupAdd } from "./types";

export async function morningBriefing(u: UserCtx): Promise<void> {
  try {
    await sendProactive("morning_briefing", "give a brief morning briefing: key meetings, top tasks, anything urgent from email. keep it tight.", u.userId, u.chatId, u.phone);
  } catch (e) { console.warn("[proactive] morning briefing failed:", e); }
}

export async function taskNudge(u: UserCtx): Promise<void> {
  try {
    const tasks = getTaskQueue(u.userId);
    const urgent = tasks.filter((t: any) => t.urgency >= 4);
    if (!urgent.length) return;
    const desc = urgent.slice(0, 3).map((t: any) => t.description).join("; ");
    await sendProactive("task_nudge", `nudge about these high-priority tasks: ${desc}`, u.userId, u.chatId, u.phone);
  } catch (e) { console.warn("[proactive] task nudge failed:", e); }
}

export async function emailAlert(u: UserCtx): Promise<void> {
  try {
    const emails = await pullUnreadEmails(3, u.phone);
    if (!emails.length) return;
    const summary = emails.map(e => `${e.from}: ${e.subject}`).join("; ");
    await sendProactive("email_alert", `flag these unread emails that may need attention: ${summary}`, u.userId, u.chatId, u.phone);
  } catch (e) { console.warn("[proactive] email alert failed:", e); }
}

const sentBlockTaskKeys = new Set<string>();

export async function scheduleOptimizer(u: UserCtx): Promise<void> {
  try {
    const events = await pullTodayEvents(u.phone);
    const blocks = findFreeBlocks(events);
    const now = nowDate();
    const nextBlock = blocks.find(b => b.start.getTime() > now.getTime() && b.durationMin >= 30);
    if (!nextBlock) return;

    const tasks = getTaskQueue(u.userId).filter((t: any) => t.urgency >= 3);
    if (!tasks.length) return;

    const top = tasks[0];
    const key = `${u.userId}::${nextBlock.start.toISOString()}::${top.id}`;
    if (dedupAdd(sentBlockTaskKeys, key)) return;

    const blockTime = nextBlock.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    await sendProactive("schedule_optimizer",
      `you have a ${nextBlock.durationMin}-min gap at ${blockTime}. suggest using it for this task: "${top.description}". be specific about why now is the right time.`,
      u.userId, u.chatId, u.phone);
  } catch (e) { console.warn("[proactive] schedule optimizer failed:", e); }
}

const sentEscalationKeys = new Set<string>();

export async function emailEscalation(u: UserCtx): Promise<void> {
  try {
    const emails = await pullUnreadEmails(20, u.phone);
    const bySender = new Map<string, string[]>();
    for (const e of emails) {
      const key = e.from.toLowerCase();
      if (!bySender.has(key)) bySender.set(key, []);
      bySender.get(key)!.push(e.subject);
    }
    for (const [sender, subjects] of bySender) {
      if (subjects.length < 3) continue;
      const key = `${u.userId}::escalation::${sender}`;
      if (dedupAdd(sentEscalationKeys, key)) continue;
      await sendProactive("email_escalation",
        `${sender} has ${subjects.length} unread emails: ${subjects.slice(0, 3).join("; ")}. this might need attention.`,
        u.userId, u.chatId, u.phone);
    }
  } catch (e) { console.warn("[proactive] email escalation failed:", e); }
}

export async function endOfDayReview(u: UserCtx): Promise<void> {
  try {
    const events = await pullTodayEvents(u.phone);
    const tasks = getTaskQueue(u.userId);
    const meetingCount = events.filter(e => e.attendees.length > 0).length;
    const openCount = tasks.length;
    const urgent = tasks.filter((t: any) => t.urgency >= 4).length;
    await sendProactive("eod_review",
      `end of day wrap-up. ${meetingCount} meeting${meetingCount !== 1 ? "s" : ""} today. ${openCount} task${openCount !== 1 ? "s" : ""} still open${urgent ? ` (${urgent} urgent)` : ""}. summarize what likely got done, flag what's hanging, suggest the #1 thing for tomorrow.`,
      u.userId, u.chatId, u.phone);
  } catch (e) { console.warn("[proactive] eod review failed:", e); }
}

export function scheduleMorningBriefing(u: UserCtx): void {
  const now = nowDate();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), config.MORNING_BRIEFING_HOUR, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  setTimeout(async () => {
    await morningBriefing(u);
    scheduleMorningBriefing(u);
  }, ms);
  console.log(`[proactive] morning briefing for ${u.phone} in ${Math.round(ms / 60000)} min`);
}

export function scheduleEodReview(u: UserCtx): void {
  const now = nowDate();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), config.EOD_REVIEW_HOUR, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  setTimeout(async () => {
    await endOfDayReview(u);
    scheduleEodReview(u);
  }, ms);
  console.log(`[proactive] eod review for ${u.phone} in ${Math.round(ms / 60000)} min`);
}
