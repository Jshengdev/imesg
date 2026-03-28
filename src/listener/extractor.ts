import { generateJSON } from "../minimax/llm";
import { getUnprocessedMessages, markProcessed, storeTasks, getDb } from "../memory/db";

const EXTRACTION_PROMPT = `Analyze these iMessage messages. Extract as JSON: {"tasks":[{"description":"","assigned_by":"","deadline":"","urgency":1}],"commitments":[{"description":"","to_whom":"","deadline":""}],"people":[{"name":"","context":""}]}. Be specific. Include names and exact asks. Return valid JSON only. If nothing to extract, return empty arrays.`;

const PERSON_PATTERNS = [
  /(?:with|w\/) ([A-Z][a-z]+ [A-Z][a-z]+)/g,
  /@([A-Za-z]\w+)/g,
  /([A-Z][a-z]+ [A-Z][a-z]+)(?:'s| sent| shared| replied| asked| said)/g,
];

interface ExtractedData {
  tasks: any[];
  commitments: any[];
  people: { name: string; context: string }[];
}

async function extractFromMessages(messages: any[]): Promise<ExtractedData> {
  const batch = messages.map(m => `[${m.sender}] ${m.content}`).join("\n");
  const result = await generateJSON(EXTRACTION_PROMPT, batch) as ExtractedData;
  
  const llmPeople = new Set(result.people.map((p: any) => p.name.toLowerCase()));
  const allPeople = [...result.people];
  
  for (const pattern of PERSON_PATTERNS) {
    let match;
    while ((match = pattern.exec(batch)) !== null) {
      const name = match[1];
      if (!llmPeople.has(name.toLowerCase())) {
        allPeople.push({ name, context: "" });
        llmPeople.add(name.toLowerCase());
      }
    }
  }
  
  return { ...result, people: allPeople };
}

export function startExtractionLoop() {
  setInterval(async () => {
    try {
      const messages = getUnprocessedMessages(20);
      if (!messages.length) return;
      
      const { tasks, people } = await extractFromMessages(messages);
      
      if (tasks.length) storeTasks(tasks);
      
      if (people.length) {
        const stmt = getDb().prepare("INSERT OR IGNORE INTO people (id, name, context_notes) VALUES (?, ?, ?)");
        for (const p of people) {
          stmt.run(crypto.randomUUID(), p.name, p.context);
        }
      }
      
      markProcessed(messages.map((m: any) => m.id));
      console.log(`Extracted: ${tasks.length} tasks, ${people.length} people`);
    } catch (error) {
      console.error("Extraction error:", error);
    }
  }, 30000);
}
