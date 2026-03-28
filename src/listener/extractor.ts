import { generateJSON } from "../minimax/llm";
import { getUnprocessedMessages, markProcessed, storeTasks, getDb } from "../memory/db";

const PROMPT = `Analyze these iMessage messages. Extract as JSON:
{
  "tasks": [{
    "description": "specific task",
    "assigned_by": "person name or null",
    "deadline": "date string or null",
    "urgency": 1-5,
    "estimated_minutes": 15,
    "effort_level": "quick",
    "environment": "anywhere",
    "deadline_source": "explicit",
    "deadline_confidence": "hard"
  }],
  "commitments": [{"description": "", "to_whom": "", "deadline": ""}],
  "people": [{"name": "", "context": ""}]
}

Inference guidelines:
- estimated_minutes: 15, 30, 45, 60, 90, or 120
- effort_level: "quick" (<15min), "focused" (15-60min), "deep" (60min+)
- environment: "anywhere", "computer", "in-person"
- deadline_source: "explicit" (they said a date), "inferred" (implied urgency), "professor", "teammate"
- deadline_confidence: "hard" (specific date given), "soft" (implied soon), "inferred" (guessed)
- "review my section" → 15-30min, quick, computer
- "write the analysis" → 60-90min, focused, computer
- "meet with professor" → 30min, focused, in-person

Be specific. Include names and exact asks. Return valid JSON only. If nothing to extract, return empty arrays.`;

const PERSON_RE = [/(?:with|w\/)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g, /(?:@)([A-Za-z]\w+)/g,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:'s|(?:\s+(?:sent|shared|replied|asked|said)))/g];

interface ExtractionResult {
  tasks: {
    description: string;
    assigned_by?: string;
    deadline?: string;
    urgency?: number;
    estimated_minutes?: number;
    effort_level?: string;
    environment?: string;
    deadline_source?: string;
    deadline_confidence?: string;
    depends_on_description?: string;
  }[];
  commitments: { description: string; to_whom?: string; deadline?: string }[];
  people: { name: string; context?: string }[];
}

function formatTasksForStorage(tasks: ExtractionResult["tasks"]) {
  return tasks.map((t) => ({
    source: "imessage",
    description: t.description,
    assigned_by: t.assigned_by,
    deadline: t.deadline,
    urgency: t.urgency,
    estimated_minutes: t.estimated_minutes,
    effort_level: t.effort_level,
    environment: t.environment,
    deadline_source: t.deadline_source,
    deadline_confidence: t.deadline_confidence,
  }));
}

function storePeopleFromResult(people: ExtractionResult["people"]): void {
  if (!people.length) return;
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO people (id, name, context_notes) VALUES (@id, @name, @context)`);
  db.transaction((rows: typeof people) => {
    for (const p of rows) stmt.run({ id: p.name.toLowerCase().replace(/\s+/g, "-"), name: p.name, context: p.context ?? null });
  })(people);
}

function regexPeople(text: string): { name: string; context: string }[] {
  const seen = new Set<string>(), out: { name: string; context: string }[] = [];
  for (const re of PERSON_RE) {
    re.lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = m[1]?.trim() ?? "";
      if (n.length >= 2 && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ name: n, context: "mentioned in conversation" }); }
    }
  }
  return out;
}

async function extractFromMessages(messages: { id?: string; sender: string; content?: string }[]): Promise<ExtractionResult> {
  const empty: ExtractionResult = { tasks: [], commitments: [], people: [] };
  if (!messages.length) return empty;
  try {
    const batch = messages.map((m) => `[${m.sender}] ${m.content ?? ""}`).join("\n");
    const r = await generateJSON(PROMPT, batch);
    const tasks = Array.isArray(r.tasks) ? r.tasks : [], commitments = Array.isArray(r.commitments) ? r.commitments : [];
    const llm = Array.isArray(r.people) ? r.people : [], regex = regexPeople(batch);
    const seen = new Set(llm.map((p: any) => p.name?.toLowerCase()));
    return { tasks, commitments, people: [...llm, ...regex.filter((p) => !seen.has(p.name.toLowerCase()))] };
  } catch (err) {
    console.error("[extractor] failed:", err instanceof Error ? err.message : err);
    return empty;
  }
}

export function startExtractionLoop(): void {
  console.log("[extractor] starting extraction loop (30s interval)");
  setInterval(async () => {
    try {
      const msgs = getUnprocessedMessages(20);
      if (!msgs.length) return;
      const result = await extractFromMessages(msgs);
      if (result.tasks.length) storeTasks(formatTasksForStorage(result.tasks));
      storePeopleFromResult(result.people);
      markProcessed(msgs.map((m: any) => m.id));
      console.log(`[extractor] processed ${msgs.length} msgs → ${result.tasks.length} tasks, ${result.people.length} people`);
    } catch (err) { console.error("[extractor] loop error:", err instanceof Error ? err.message : err); }
  }, 30_000);
}

export async function runExtractionOnce(userId?: string): Promise<number> {
  const msgs = getUnprocessedMessages(20, userId);
  if (!msgs.length) return 0;
  const result = await extractFromMessages(msgs);
  if (result.tasks.length) storeTasks(formatTasksForStorage(result.tasks), userId);
  storePeopleFromResult(result.people);
  markProcessed(msgs.map((m: any) => m.id));
  console.log(`[extractor] on-demand: ${msgs.length} msgs → ${result.tasks.length} tasks, ${result.people.length} people`);
  return result.tasks.length;
}
