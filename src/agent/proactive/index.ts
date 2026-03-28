import { config } from "../../config";
import { getActiveUsers } from "../../memory/db";
import { scheduleMorningBriefing, scheduleEodReview, taskNudge, emailAlert, emailEscalation, scheduleOptimizer } from "./triggers-scheduled";
import { preMeetingPrep, followUpReminder, crossSourcePairing } from "./triggers-event";

function forEachUser(fn: (u: { userId: string; chatId: string; phone: string }) => Promise<void>) {
  const users = getActiveUsers();
  for (const u of users) {
    fn({ userId: u.id, chatId: u.chat_id, phone: u.phone }).catch(e => console.warn("[proactive] trigger error:", e));
  }
}

export function startProactiveEngine(): void {
  // Schedule per-user daily triggers on boot (re-checks users each fire)
  const users = getActiveUsers();
  for (const u of users) {
    scheduleMorningBriefing({ userId: u.id, chatId: u.chat_id, phone: u.phone });
    scheduleEodReview({ userId: u.id, chatId: u.chat_id, phone: u.phone });
  }

  // Interval triggers loop all active users each tick
  setInterval(() => forEachUser(preMeetingPrep), config.CALENDAR_POLL_MS);
  setInterval(() => forEachUser(taskNudge), 30 * 60 * 1000);
  setInterval(() => forEachUser(emailAlert), config.EMAIL_POLL_MS);
  setInterval(() => forEachUser(emailEscalation), config.EMAIL_POLL_MS);
  setInterval(() => forEachUser(scheduleOptimizer), 15 * 60 * 1000);
  setInterval(() => forEachUser(followUpReminder), config.CALENDAR_POLL_MS);
  setInterval(() => forEachUser(crossSourcePairing), config.CALENDAR_POLL_MS);

  console.log(`[proactive] engine started — 9 triggers, ${users.length} user(s)`);
}
