# Component: Proactive Decision Engine (`src/agent/proactive/decision-engine.ts`)

## Purpose
Unified decision gate that evaluates whether to send a proactive message, update tasks, suggest calendar blocks, or stay silent — based on urgency vs disruption.

## Implementation

### New file: `src/agent/proactive/decision-engine.ts`

```typescript
interface EvalResult {
  action: "send" | "queue" | "update_tasks" | "suggest_block" | "silent";
  message?: string;           // text to send if action=send
  taskUpdates?: any[];        // tasks to update if action=update_tasks
  blockSuggestion?: { title: string; start: Date; duration: number }; // if action=suggest_block
  reason: string;             // for logging
}

export async function evaluate(
  trigger: string,             // what caused this: "message", "email_poll", "calendar_poll", "time_change", "manual"
  userId: string,
  chatId: string,
  phone: string,
  newData?: string,            // description of what changed
): Promise<EvalResult>
```

### Logic flow

1. **Assemble snapshot:**
   - `getTaskQueue(userId)` → current tasks
   - `analyzeCalendar(phone)` → events + free blocks (use cached if < 2min old)
   - `analyzeGmail(phone)` → emails (use cached if < 5min old)
   - `getRecentConversation(5, userId)` → what we just talked about
   - `nowDate()` → virtual or real time

2. **Score urgency** (what's the new data worth?):
   - Hard deadline < 24hr mentioned → 9
   - Same person in 2+ sources → 7
   - New email from someone with upcoming meeting → 6
   - Regular task extraction → 3
   - Nothing actionable → 1

3. **Score disruption** (how busy are they?):
   - Currently in a meeting → 8
   - Meeting in < 15min → 7
   - Has been typing recently (< 5min) → 5
   - Free block right now → 2
   - Quiet hours → 10

4. **Decide:**
   - urgency >= disruption + 2 → "send" (important enough to interrupt)
   - urgency >= disruption → "suggest_block" or "update_tasks" (worth noting)
   - urgency < disruption → "queue" (save for later)
   - nothing new → "silent"

5. **Gate checks** (existing):
   - `wasRecentlySent(hash, 48*60)` → dedup
   - `countRecentProactive(60)` < MAX_PROACTIVE_PER_HOUR → rate limit

### Caching layer
```typescript
let cachedCalendar: { data: CalendarAnalysis; at: number } | null = null;
let cachedEmail: { data: GmailAnalysis; at: number } | null = null;

function getCachedCalendar(phone, maxAgeMs = 120_000)
function getCachedEmail(phone, maxAgeMs = 300_000)
```

### Integration with existing triggers
The existing `sendProactive()` in `engine.ts` is still used for actual sending. The decision engine wraps it:
```typescript
if (result.action === "send" && result.message) {
  await sendProactive(trigger, result.message, userId, chatId, phone);
}
```

## Verification
- User in meeting + low-urgency email → engine returns "queue"
- User free + hard deadline email → engine returns "send"
- Same content sent twice → dedup gate blocks second
- `/poll` triggers evaluate() → decision made → appropriate action taken
