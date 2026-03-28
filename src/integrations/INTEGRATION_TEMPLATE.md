# Integration Template

Use this pattern to add any new data source (Slack, Notion, Todoist, etc.) with LLM-powered analysis.

## Architecture: 3-Layer Analysis

```
Layer 1: Pull + Normalize     → raw API data → typed objects
Layer 2: Structural Analysis   → patterns, counts, tags (no LLM, instant)
Layer 3: LLM Analysis          → actionable insights via M2.7 JSON mode
```

Every integration exports:
- `pullXxx()` — raw typed data (Layer 1) — used by proactive triggers
- `analyzeXxx()` — full analysis (Layer 1+2+3) — used by context assembly

## Template File

```typescript
import { executeWithFallback } from "./composio.js";
import { generateJSON } from "../minimax/llm";

// --- Types ---

export interface MyItem {
  // typed fields from the API
}

export interface MyAnalysis {
  items: MyItem[];
  insights: string;        // LLM-generated, human-readable
  tags: string[];           // machine-readable signals
  // any extra structured data
}

const SEARCH_KEYS = ["items", "data", "results"]; // keys to search in Composio response

// --- Layer 1: Pull + Normalize ---

export async function pullMyItems(limit = 20): Promise<MyItem[]> {
  const raw = await executeWithFallback([
    { actionName: "SERVICE_ACTION_1", params: { limit } },
    { actionName: "SERVICE_ACTION_2", params: { limit } },
  ], SEARCH_KEYS, "my-service");
  return raw.map(normalize);
}

function normalize(e: any): MyItem {
  return {
    // map messy API fields to clean typed fields
    // handle multiple field name variations
  };
}

// --- Layer 2: Structural Analysis (no LLM, instant) ---

function analyzeStructure(items: MyItem[]): { tags: string[]; /* computed metrics */ } {
  const tags: string[] = [];
  // Count patterns, detect anomalies, compute frequencies
  // Tag interesting signals: "high_volume", "escalation", "pattern_break"
  return { tags };
}

// --- Layer 3: LLM Analysis ---

const ANALYSIS_PROMPT = `you are analyzing [data source] for actionable insights.

given the data below, return JSON:
{
  "insights": ["one sentence each — what matters, what to act on"],
  "action_items": ["specific things the user should do"],
  // any other structured fields
}

be specific. reference actual names, times, subjects. skip obvious stuff.
if nothing interesting, return empty arrays.`;

export async function analyzeMyService(): Promise<MyAnalysis> {
  const items = await pullMyItems();
  const structure = analyzeStructure(items);

  if (items.length === 0) {
    return { items, insights: "nothing here", tags: ["empty"] };
  }

  // Format items as text for LLM
  const itemText = items.map((item, i) => `${i + 1}. ...format fields...`).join("\n");

  try {
    const analysis = await generateJSON(ANALYSIS_PROMPT, itemText);
    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    return {
      items,
      insights: insights.join("\n") || "nothing notable",
      tags: structure.tags,
    };
  } catch (err) {
    console.warn("[my-service] LLM analysis failed, using structural:", err);
    return {
      items,
      insights: `${items.length} items found`,
      tags: structure.tags,
    };
  }
}
```

## Wiring Into Context Assembly

In `src/agent/context.ts`:

1. Import the analyze function:
```typescript
import { analyzeMyService, type MyAnalysis } from "../integrations/my-service";
```

2. Add to `Promise.allSettled` in `assembleContext()`:
```typescript
const [calResult, tasksResult, gmailResult, myResult] = await Promise.allSettled([
  analyzeCalendar(),
  Promise.resolve(getTaskQueue()),
  analyzeGmail(),
  analyzeMyService(),  // add here
]);
```

3. Add formatter:
```typescript
function fmtMyInsights(analysis: MyAnalysis): string {
  if (!analysis.insights) return "";
  return `## my-service insights\n${analysis.insights}`;
}
```

4. Add to the `all` sections map:
```typescript
myInsights: fmtMyInsights(myService),
```

5. Add to `SECTION_ORDER` and `DEFAULT_ORDER` where it makes sense:
```typescript
const DEFAULT_ORDER = ["situation", "conversation", "calInsights", "events", "blocks", "emailInsights", "myInsights", "crossref", "tasks", "emails"];
```

## Key Principles

- **Layer 2 always works** — if the LLM fails, structural analysis provides a fallback
- **LLM prompts ask for JSON** — structured output, not free-form text
- **Prompts say "be specific"** — forces the LLM to reference actual data, not generic advice
- **Tags are machine-readable** — used by proactive triggers and cross-referencing
- **Insights are human-readable** — injected into context for the agent's system prompt
- **Cross-referencing** in context.ts matches people/entities across all sources automatically
