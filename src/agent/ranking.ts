import type { FreeBlock } from "../integrations/calendar";
import { nowDate } from "../demo";
import { fmtTime } from "../utils";

export interface RankedTask {
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
  blocked: boolean;
  fits_next_block: boolean;
  urgency: number;
}

function deadlineScore(deadline: string | null, confidence: string | null, now: Date): number {
  if (!deadline) return 2;
  const dl = new Date(deadline);
  const hoursAway = (dl.getTime() - now.getTime()) / (1000 * 60 * 60);

  let raw: number;
  if (hoursAway < 0) raw = 10;        // overdue
  else if (hoursAway < 24) raw = 10;   // due within 24hr
  else if (hoursAway < 48) raw = 6;    // due within 48hr
  else raw = 3;                         // further out

  const multiplier = confidence === "hard" ? 1.0
    : confidence === "soft" ? 0.6
    : 0.3;

  return raw * multiplier;
}

function calendarFitScore(estimatedMinutes: number | null, freeBlocks: FreeBlock[], now: Date): number {
  if (!estimatedMinutes || !freeBlocks.length) return 0;

  const futureBlocks = freeBlocks.filter(b => b.start.getTime() > now.getTime());
  if (!futureBlocks.length) return 0;

  // Fits in next free block
  if (futureBlocks[0].durationMin >= estimatedMinutes) return 5;

  // Fits in any block today
  if (futureBlocks.some(b => b.durationMin >= estimatedMinutes)) return 3;

  return 0;
}

function dependencyClearScore(dependsOn: string | null, allTasks: any[]): number {
  if (!dependsOn) return 3;

  const depIds = dependsOn.split(",").map(s => s.trim()).filter(Boolean);
  
  const unmetDeps = depIds.filter(id => {
    const depTask = allTasks.find(t => t.id === id);
    return !depTask || depTask.status !== "completed";
  });

  return unmetDeps.length > 0 ? -100 : 3;
}

export function rankTasks(tasks: any[], freeBlocks: FreeBlock[], currentTime?: Date): RankedTask[] {
  const now = currentTime || nowDate();

  const ranked: RankedTask[] = tasks.map(t => {
    const estMin = t.estimated_minutes || 30;
    const depScore = dependencyClearScore(t.depends_on, tasks);
    const calScore = calendarFitScore(estMin, freeBlocks, now);

    const score = (t.urgency || 3) * 3
      + deadlineScore(t.deadline, t.deadline_confidence, now) * 2
      + calScore * 1.5
      + depScore * 1;

    return {
      id: t.id,
      description: t.description,
      score,
      estimated_minutes: estMin,
      effort_level: t.effort_level || "focused",
      environment: t.environment || "anywhere",
      deadline: t.deadline || null,
      deadline_confidence: t.deadline_confidence || "inferred",
      assigned_by: t.assigned_by || null,
      depends_on: t.depends_on || null,
      blocked: depScore < 0,
      fits_next_block: calScore >= 5,
      urgency: t.urgency || 3,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

export function formatRankedPlan(ranked: RankedTask[], freeBlocks: FreeBlock[]): string {
  if (!ranked.length) return "no open tasks";

  const now = nowDate();
  const futureBlocks = freeBlocks.filter(b => b.start.getTime() > now.getTime());

  const doable = ranked.filter(t => !t.blocked);
  const blocked = ranked.filter(t => t.blocked);

  const lines: string[] = [];

  // Map doable tasks to time slots
  let blockIdx = 0;
  let blockRemaining = futureBlocks[0]?.durationMin || 0;

  for (let i = 0; i < doable.length && i < 5; i++) {
    const t = doable[i];
    let timeNote = "";

    if (blockIdx < futureBlocks.length && blockRemaining >= t.estimated_minutes) {
      const block = futureBlocks[blockIdx];
      timeNote = ` — fits in ${fmtTime(block.start)}-${fmtTime(block.end)} block`;
      blockRemaining -= t.estimated_minutes;
      if (blockRemaining < 15) {
        blockIdx++;
        blockRemaining = futureBlocks[blockIdx]?.durationMin || 0;
      }
    }

    const deadlineNote = t.deadline ? ` [due: ${t.deadline}]` : "";
    const fromNote = t.assigned_by ? ` (from ${t.assigned_by})` : "";

    lines.push(`${i + 1}. ${t.description} (${t.estimated_minutes}min, ${t.effort_level})${fromNote}${deadlineNote}${timeNote}`);
  }

  if (blocked.length) {
    lines.push(`\nblocked (waiting on dependencies): ${blocked.map(t => t.description).join(", ")}`);
  }

  return lines.join("\n");
}
