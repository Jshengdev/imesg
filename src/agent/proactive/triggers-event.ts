import { config } from "../../config";
import { getTaskQueue } from "../../memory/db";
import { pullTodayEvents } from "../../integrations/calendar";
import { pullUnreadEmails } from "../../integrations/gmail";
import { sendProactive } from "./engine";
import { normalizeNameWords } from "../../utils";
import { now } from "../../demo";

type UserCtx = { userId: string; chatId: string; phone: string };

const sentEventIds = new Set<string>();

export async function preMeetingPrep(u: UserCtx): Promise<void> {
  try {
    const events = await pullTodayEvents(u.phone);
    const nowMs = now();
    const threshold = config.PRE_MEETING_MINUTES * 60 * 1000;
    for (const ev of events) {
      const ms = ev.start.getTime() - nowMs;
      const evKey = `${u.userId}::${ev.title}::${ev.start.toISOString()}`;
      if (ms > 0 && ms <= threshold && !sentEventIds.has(evKey)) {
        if (sentEventIds.size >= 500) sentEventIds.clear();
        sentEventIds.add(evKey);
        await sendProactive("pre_meeting", `prep me for my upcoming meeting: "${ev.title}" starting in ${Math.round(ms / 60000)} min. attendees: ${ev.attendees.join(", ") || "none listed"}. what should i know?`, u.userId, u.chatId, u.phone);
      }
    }
  } catch (e) { console.warn("[proactive] pre-meeting failed:", e); }
}

const sentFollowUpKeys = new Set<string>();

export async function followUpReminder(u: UserCtx): Promise<void> {
  try {
    const events = await pullTodayEvents(u.phone);
    const nowMs = now();
    for (const ev of events) {
      const elapsed = nowMs - ev.end.getTime();
      if (elapsed < 30 * 60 * 1000 || elapsed > 3 * 60 * 60 * 1000) continue;
      if (!ev.attendees.length) continue;
      const key = `${u.userId}::${ev.title}::${ev.end.toISOString()}`;
      if (sentFollowUpKeys.has(key)) continue;
      if (sentFollowUpKeys.size >= 200) sentFollowUpKeys.clear();
      sentFollowUpKeys.add(key);
      const ago = Math.round(elapsed / 60000);
      await sendProactive("follow_up",
        `meeting "${ev.title}" ended ${ago} min ago (with ${ev.attendees.slice(0, 3).join(", ")}). any follow-ups needed?`,
        u.userId, u.chatId, u.phone);
    }
  } catch (e) { console.warn("[proactive] follow-up failed:", e); }
}

const sentPairingKeys = new Set<string>();

export async function crossSourcePairing(u: UserCtx): Promise<void> {
  try {
    const nowMs = now();
    const [events, emails, tasks] = await Promise.all([
      pullTodayEvents(u.phone), pullUnreadEmails(10, u.phone), Promise.resolve(getTaskQueue(u.userId)),
    ]);
    const upcoming = events.filter(e => e.start.getTime() > nowMs && e.start.getTime() - nowMs <= 2 * 60 * 60 * 1000);
    if (!upcoming.length) return;

    const normalize = normalizeNameWords;
    const emailNames = new Map<string, string>();
    for (const e of emails) { for (const w of normalize(e.from)) if (w.length > 2) emailNames.set(w, e.subject); }
    const taskNames = new Map<string, string>();
    for (const t of tasks) { if (t.assigned_by) for (const w of normalize(t.assigned_by)) if (w.length > 2) taskNames.set(w, t.description); }

    for (const ev of upcoming) {
      for (const att of ev.attendees) {
        for (const w of normalize(att)) {
          const emailSubj = emailNames.get(w);
          const taskDesc = taskNames.get(w);
          if (!emailSubj && !taskDesc) continue;
          const key = `${u.userId}::pairing::${w}::${ev.title}`;
          if (sentPairingKeys.has(key)) continue;
          if (sentPairingKeys.size >= 200) sentPairingKeys.clear();
          sentPairingKeys.add(key);
          const sources = [`meeting "${ev.title}"`];
          if (emailSubj) sources.push(`email re: "${emailSubj}"`);
          if (taskDesc) sources.push(`task: "${taskDesc}"`);
          await sendProactive("cross_source", `heads up — "${w}" appears in ${sources.join(" + ")}. connect the dots before that meeting.`, u.userId, u.chatId, u.phone);
          return;
        }
      }
    }
  } catch (e) { console.warn("[proactive] cross-source failed:", e); }
}
