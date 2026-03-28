import { config } from "../../config";
import { getTaskQueue } from "../../memory/db";
import { pullTodayEvents } from "../../integrations/calendar";
import { pullUnreadEmails } from "../../integrations/gmail";
import { sendProactive } from "./engine";

const sentEventIds = new Set<string>();

export async function preMeetingPrep(): Promise<void> {
  try {
    const events = await pullTodayEvents();
    const now = Date.now();
    const threshold = config.PRE_MEETING_MINUTES * 60 * 1000;
    for (const ev of events) {
      const ms = ev.start.getTime() - now;
      const evKey = ev.title + ev.start.toISOString();
      if (ms > 0 && ms <= threshold && !sentEventIds.has(evKey)) {
        if (sentEventIds.size >= 500) sentEventIds.clear();
        sentEventIds.add(evKey);
        await sendProactive("pre_meeting", `prep me for my upcoming meeting: "${ev.title}" starting in ${Math.round(ms / 60000)} min. attendees: ${ev.attendees.join(", ") || "none listed"}. what should i know?`);
      }
    }
  } catch (e) { console.warn("[proactive] pre-meeting failed:", e); }
}

const sentFollowUpKeys = new Set<string>();

export async function followUpReminder(): Promise<void> {
  try {
    const events = await pullTodayEvents();
    const now = Date.now();
    const MIN_ELAPSED = 30 * 60 * 1000;
    const MAX_ELAPSED = 3 * 60 * 60 * 1000;

    for (const ev of events) {
      const elapsed = now - ev.end.getTime();
      if (elapsed < MIN_ELAPSED || elapsed > MAX_ELAPSED) continue;
      if (!ev.attendees.length) continue;

      const key = ev.title + ev.end.toISOString();
      if (sentFollowUpKeys.has(key)) continue;
      if (sentFollowUpKeys.size >= 200) sentFollowUpKeys.clear();
      sentFollowUpKeys.add(key);

      const ago = Math.round(elapsed / 60000);
      await sendProactive("follow_up",
        `meeting "${ev.title}" ended ${ago} min ago (with ${ev.attendees.slice(0, 3).join(", ")}). any follow-ups needed? action items, thank-yous, shared docs? be specific about what to do next.`
      );
    }
  } catch (e) { console.warn("[proactive] follow-up reminder failed:", e); }
}

const sentPairingKeys = new Set<string>();

export async function crossSourcePairing(): Promise<void> {
  try {
    const now = Date.now();
    const horizon = 2 * 60 * 60 * 1000;
    const [events, emails, tasks] = await Promise.all([
      pullTodayEvents(), pullUnreadEmails(10), Promise.resolve(getTaskQueue()),
    ]);
    const upcoming = events.filter(e => e.start.getTime() > now && e.start.getTime() - now <= horizon);
    if (!upcoming.length) return;

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
    const emailNames = new Map<string, string>();
    for (const e of emails) {
      for (const w of normalize(e.from)) if (w.length > 2) emailNames.set(w, e.subject);
    }
    const taskNames = new Map<string, string>();
    for (const t of tasks) {
      if (t.assigned_by) for (const w of normalize(t.assigned_by)) if (w.length > 2) taskNames.set(w, t.description);
    }

    for (const ev of upcoming) {
      for (const att of ev.attendees) {
        for (const w of normalize(att)) {
          const emailSubj = emailNames.get(w);
          const taskDesc = taskNames.get(w);
          if (!emailSubj && !taskDesc) continue;
          const key = `pairing::${w}::${ev.title}`;
          if (sentPairingKeys.has(key)) continue;
          if (sentPairingKeys.size >= 200) sentPairingKeys.clear();
          sentPairingKeys.add(key);
          const sources = [`meeting "${ev.title}" at ${ev.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`];
          if (emailSubj) sources.push(`unread email re: "${emailSubj}"`);
          if (taskDesc) sources.push(`open task: "${taskDesc}"`);
          await sendProactive("cross_source", `heads up — "${w}" appears in ${sources.length} places: ${sources.join(", ")}. connect the dots before that meeting.`);
          return;
        }
      }
    }
  } catch (e) { console.warn("[proactive] cross-source pairing failed:", e); }
}
