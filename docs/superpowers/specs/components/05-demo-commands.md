# Component: Demo Commands in Handler (`src/agent/handler.ts`)

## Purpose
Wire up `/demo`, `/time`, `/important`, `/priority`, `/poll` commands into the message handler. Also handle task completion ("done with X").

## Implementation

### Command routing in processMessage()
Add before the onboarding check, after the `/reset` handler:

```typescript
// /demo
if (/^\/?demo$/i.test(text)) {
  setDemoMode(true);
  // Pre-cache data in background
  analyzeCalendar(phone).catch(() => {});
  analyzeGmail(phone).catch(() => {});
  await sendText(replyTo, "demo mode on. ur data is loading");
  return;
}

// /time HH:MM
const timeMatch = text.match(/^\/?time\s+(\d{1,2}):(\d{2})$/i);
if (timeMatch) {
  const h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
  const t = setVirtualTime(h, m);
  const label = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  await sendText(replyTo, `time set to ${label.toLowerCase()}`);
  // Run proactive engine at this new time
  await evaluate("time_change", userId, replyTo, phone, `time jumped to ${label}`);
  return;
}

// /important
if (/^\/?important$/i.test(text)) {
  // Housekeeping scan
  const [cal, gmail, tasks] = await Promise.all([
    analyzeCalendar(phone), analyzeGmail(phone), getTaskQueue(userId)
  ]);
  const crossInsights = getCachedInsights();
  const prompt = `housekeeping check. compare current tasks against new email and calendar data. flag anything that contradicts the current plan, any new deadlines, or anything pressing.\n\ntasks: ${JSON.stringify(tasks.slice(0,10))}\nemail insights: ${gmail.insights}\ncalendar: ${cal.insights}\ncross-ref: ${crossInsights}`;
  const system = SYSTEM_PROMPT.replace("{context}", "") + "\n" + POST_HISTORY_ENFORCEMENT;
  const raw = await generate(system, prompt);
  const response = validateResponse(raw);
  await sendBubbles(replyTo, splitIntoBubbles(response));
  return;
}

// /priority
if (/^\/?priority$/i.test(text)) {
  const tasks = getTasksWithDetails(userId);
  const cal = await analyzeCalendar(phone);
  const ranked = rankTasks(tasks, cal.freeBlocks, nowDate());
  const plan = formatRankedPlan(ranked, cal.freeBlocks);
  // LLM makes it conversational
  const system = SYSTEM_PROMPT.replace("{context}", plan) + "\n" + POST_HISTORY_ENFORCEMENT;
  const raw = await generate(system, "give me the priority plan based on this data. be specific about times and order");
  const response = validateResponse(raw);
  await sendBubbles(replyTo, splitIntoBubbles(response));
  return;
}

// /poll
if (/^\/?poll$/i.test(text)) {
  // Force all channels to check
  await startExtractionLoop_once();  // process unprocessed messages
  const evalResult = await evaluate("manual", userId, replyTo, phone, "manual poll");
  if (evalResult.action === "silent") {
    await sendText(replyTo, "checked everything. nothing new rn");
  }
  // Engine handles sending if there's something
  return;
}
```

### Task completion detection
In `processMessage()`, before the main LLM call, check if user is marking something done:

```typescript
const doneMatch = text.match(/(?:done|finished|completed|knocked out)\s+(?:with\s+)?(?:the\s+)?(.+)/i);
if (doneMatch) {
  const desc = doneMatch[1].trim();
  const result = completeTaskByDescription(desc, userId);
  if (result.found) {
    // Check if this unblocks anything
    const unblocked = getDependentTasks(result.taskId);
    // Re-rank
    const tasks = getTasksWithDetails(userId);
    const cal = await analyzeCalendar(phone);
    const ranked = rankTasks(tasks, cal.freeBlocks, nowDate());
    const next = ranked[0];
    // Let LLM respond naturally about what's next
    // (falls through to normal LLM flow with updated context)
  }
}
```

### Imports needed
```typescript
import { setDemoMode, isDemoMode, setVirtualTime, nowDate } from "../demo";
import { evaluate } from "./proactive/decision-engine";
import { rankTasks, formatRankedPlan } from "./ranking";
import { getTasksWithDetails, completeTaskByDescription, getDependentTasks } from "../memory/db";
```

## Verification
- `/demo` → sets demo mode, pre-caches data, bouncer still works normally
- `/time 08:00` → temporal voice changes, proactive engine runs
- `/important` → reads emails+calendar+tasks, flags contradictions
- `/priority` → returns ranked task plan with time estimates
- `/poll` → checks all sources, triggers decision engine
- "done with the analysis" → task marked complete, next task suggested
