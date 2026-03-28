import { generateJSON } from "../minimax/llm";
import { getUnprocessedMessages, markProcessed, storeTasks, getDb } from "../memory/db";

const PROMPT = `Analyze these iMessage messages. Extract as JSON:
{"tasks":[{"description":"","assigned_by":"","deadline":"","urgency":1}],"commitments":[{"description":"","to_whom":"","deadline":""}],"people":[{"name":"","context":""}]}
Be specific. Include names and exact asks. Return valid JSON only. If nothing to extract, return empty arrays.`;

const PERSON_RE = [/(?:with|w\/)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g, /(?:@)([A-Za-z]\w+)/g,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:'s|(?:\s+(?:sent|shared|replied|asked|said)))/g];

interface ExtractionResult {
  tasks: { description: string; assigned_by?: string; deadline?: string; urgency?: number }[];
  commitments: { description: string; to_whom?: string; deadline?: string }[];
  people: { name: string; context?: string }[];
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
      if (result.tasks.length) storeTasks(result.tasks.map((t) => ({ source: "imessage", description: t.description, assigned_by: t.assigned_by, deadline: t.deadline, urgency: t.urgency })));
      if (result.people.length) {
        const db = getDb();
        const stmt = db.prepare(`INSERT OR IGNORE INTO people (id, name, context_notes) VALUES (@id, @name, @context)`);
        db.transaction((people: typeof result.people) => {
          for (const p of people) stmt.run({ id: p.name.toLowerCase().replace(/\s+/g, "-"), name: p.name, context: p.context ?? null });
        })(result.people);
      }
      markProcessed(msgs.map((m: any) => m.id));
      console.log(`[extractor] processed ${msgs.length} msgs → ${result.tasks.length} tasks, ${result.people.length} people`);
    } catch (err) { console.error("[extractor] loop error:", err instanceof Error ? err.message : err); }
  }, 30_000);
}
