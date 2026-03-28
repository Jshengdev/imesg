# Component: Task Ranking Engine (`src/agent/ranking.ts`)

## Purpose
Score and rank tasks by urgency, deadline proximity, calendar fit, dependency status, and cross-source mentions.

## Implementation

### New file: `src/agent/ranking.ts`

```typescript
interface RankedTask {
  id: string;
  description: string;
  score: number;
  estimated_minutes: number;
  effort_level: string;
  environment: string;
  deadline: string | null;
  deadline_confidence: string;
  assigned_by: string | null;
  depends_on: string | null;
  blocked: boolean;          // true if depends_on has uncompleted tasks
  fits_next_block: boolean;  // true if estimated_minutes <= next free block
  urgency: number;
}

export function rankTasks(tasks: any[], freeBlocks: FreeBlock[], currentTime: Date): RankedTask[]
```

### Scoring
```
score = (urgency * 3)
      + (deadlineScore(deadline, deadline_confidence, currentTime) * 2)
      + (calendarFitScore(estimated_minutes, freeBlocks, currentTime) * 1.5)
      + (dependencyClearScore(depends_on, allTasks) * 1)
      + (crossSourceScore(description, assigned_by) * 0.5)
```

**deadlineScore(deadline, confidence, now):**
- No deadline → 2 (baseline)
- Hard deadline > 48hr away → 3
- Hard deadline 24-48hr → 6
- Hard deadline < 24hr → 10
- Soft deadline: same scale but * 0.6
- Inferred: same scale but * 0.3

**calendarFitScore(minutes, blocks, now):**
- Next free block fits this task → 5
- Any block today fits → 3
- No block fits → 0

**dependencyClearScore(depends_on, allTasks):**
- No dependencies → 3
- All dependencies complete → 3
- Has uncomplete dependencies → -100 (effectively blocked)

**crossSourceScore(desc, assigned_by):**
- Mentioned by 2+ sources (email + text) → 3
- Single source → 1

### formatRankedPlan(ranked: RankedTask[], blocks: FreeBlock[]): string
LLM-free formatting. Maps tasks into time slots:
```
"1. data analysis (45min) — sarah's waiting, fits ur 4-5:30 block
 2. review sarah's section (15min) — quick, do right after
 3. writeup (30min) — due tmrw 11:59
 presentation can wait — not due til next week"
```

## Verification
- Task with hard deadline tomorrow scores higher than soft deadline next week
- Blocked task (depends_on unfinished) gets score -100, sorts to bottom
- Task fitting next free block gets calendar boost
- After completing a dependency, blocked task unblocks and re-ranks
