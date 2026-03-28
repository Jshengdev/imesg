import { config } from "../../config";
import { scheduleMorningBriefing, scheduleEodReview, taskNudge, emailAlert, emailEscalation, scheduleOptimizer } from "./triggers-scheduled";
import { preMeetingPrep, followUpReminder, crossSourcePairing } from "./triggers-event";

export function startProactiveEngine(): void {
  scheduleMorningBriefing();
  scheduleEodReview();
  setInterval(preMeetingPrep, config.CALENDAR_POLL_MS);
  setInterval(taskNudge, 30 * 60 * 1000);
  setInterval(emailAlert, config.EMAIL_POLL_MS);
  setInterval(emailEscalation, config.EMAIL_POLL_MS);
  setInterval(scheduleOptimizer, 15 * 60 * 1000);
  setInterval(followUpReminder, config.CALENDAR_POLL_MS);
  setInterval(crossSourcePairing, config.CALENDAR_POLL_MS);
  console.log("[proactive] engine started — 9 triggers active");
}
