import { analyzeCalendar } from "../integrations/calendar";
import { analyzeGmail } from "../integrations/gmail";
import { getTaskQueue } from "../memory/db";
import { generate } from "../minimax/llm";
import { fmtTime } from "../utils";

let cachedInsights = "no cross-source insights yet";
let running = false;

const CROSSREF_PROMPT = `you are analyzing a user's calendar, email, and task data to find MEANINGFUL connections across sources.

look for:
- same person appearing in calendar + email + tasks (e.g. meeting with sarah at 2pm AND she emailed about the budget)
- prep needed before meetings based on email threads (e.g. unread email from someone you're meeting soon)
- task deadlines that conflict with a busy calendar day
- unanswered emails from people the user has tasks from
- follow-ups needed after recent meetings
- patterns: someone emailing a lot + meeting them soon = needs attention

return 3-5 short bullet points. be specific — use real names, times, subjects.
if nothing connects, say "no cross-source connections right now".
do NOT make things up. only report connections you actually see in the data.`;

async function runCrossRef(phone?: string): Promise<void> {
  if (running) return;
  running = true;

  try {
    const [calResult, tasksResult, gmailResult] = await Promise.allSettled([
      analyzeCalendar(phone),
      Promise.resolve(getTaskQueue()),
      analyzeGmail(phone),
    ]);

    const cal = calResult.status === "fulfilled" ? calResult.value : { events: [], freeBlocks: [], insights: "", tags: [] };
    const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
    const gmail = gmailResult.status === "fulfilled" ? gmailResult.value : { emails: [], insights: "", tags: [], topSenders: [], actionItems: [] };

    if (!cal.events.length && !gmail.emails.length && !tasks.length) {
      cachedInsights = "no data to cross-reference yet";
      return;
    }

    const dataBlock = [
      cal.events.length ? `calendar:\n${cal.events.map(e => `- ${fmtTime(e.start)}: ${e.title}${e.attendees.length ? ` (with ${e.attendees.slice(0, 3).join(", ")})` : ""}`).join("\n")}` : "",
      gmail.emails.length ? `emails:\n${gmail.emails.slice(0, 10).map(e => `- from ${e.from}: ${e.subject}`).join("\n")}` : "",
      tasks.length ? `tasks:\n${tasks.slice(0, 10).map(t => `- ${t.description}${t.assigned_by ? ` (from ${t.assigned_by})` : ""}${t.deadline ? ` [due: ${t.deadline}]` : ""}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    const result = await generate(CROSSREF_PROMPT, dataBlock);
    if (result.length > 10) cachedInsights = result;
  } catch (err) {
    console.warn("[crossref] background loop failed:", err);
  } finally {
    running = false;
  }
}

export function getCachedInsights(): string {
  return cachedInsights;
}

const CROSSREF_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startCrossRefLoop(phone?: string): void {
  console.log("[crossref] starting background loop (every 5 min)");
  // Run once immediately, then on interval
  runCrossRef(phone).catch(err => console.warn("[crossref] initial run failed:", err));
  setInterval(() => runCrossRef(phone), CROSSREF_INTERVAL_MS);
}
