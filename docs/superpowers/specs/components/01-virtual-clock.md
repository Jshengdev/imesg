# Component: Virtual Clock (`src/demo.ts`)

## Purpose
Enable `/time HH:MM` command to simulate time for demo. All time-dependent code uses `now()` instead of `Date.now()`.

## Implementation

### New file: `src/demo.ts`
```typescript
let virtualTime: number | null = null;
let demoMode = false;

export function now(): number {
  return virtualTime ?? Date.now();
}

export function nowDate(): Date {
  return new Date(now());
}

export function isDemoMode(): boolean {
  return demoMode;
}

export function setDemoMode(enabled: boolean): void {
  demoMode = enabled;
}

export function setVirtualTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  virtualTime = d.getTime();
  return d;
}

export function clearVirtualTime(): void {
  virtualTime = null;
}
```

### Modifications needed
Replace `new Date()` and `Date.now()` with `nowDate()` and `now()` in:
- `src/agent/personality.ts` — `getTemporalVoice()` uses `new Date().getHours()`
- `src/agent/context.ts` — `fmtSituation()` uses `new Date()`
- `src/agent/proactive/engine.ts` — no direct time usage, but context assembly does
- `src/agent/proactive/triggers-scheduled.ts` — `scheduleMorningBriefing/scheduleEodReview` use `new Date()`
- `src/agent/proactive/triggers-event.ts` — `preMeetingPrep/followUpReminder/crossSourcePairing` use `Date.now()`
- `src/integrations/calendar.ts` — `pullTodayEvents` uses `new Date()` for timeMin/timeMax

### Handler routing
In `handler.ts`, add to `processMessage()`:
- Match `/time HH:MM` → parse hours/minutes → `setVirtualTime()` → run proactive engine → reply "time set to X"
- Match `/demo` → `setDemoMode(true)` → pre-cache calendar+email → reply "demo mode on"

## Verification
- `/time 08:00` → `getTemporalVoice()` returns morning voice
- `/time 16:00` → context shows "4pm" as current time
- `/time 18:00` → triggers EOD-style evaluation
- `clearVirtualTime()` returns to real time
