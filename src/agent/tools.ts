import type { ToolDef } from "../minimax/llm";
import { analyzeCalendar } from "../integrations/calendar";
import { analyzeGmail, pullUnreadEmails, saveEmailDraft } from "../integrations/gmail";
import { getTaskQueue, getRecentConversation, getPersonDossier } from "../memory/db";
import { getCachedInsights } from "./crossref";

// --- Tool definitions (OpenAI function-calling format) ---

export const TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_calendar",
      description: "get today's calendar events, free blocks, and schedule insights. use when the user asks about meetings, schedule, availability, or when you need to prep them for something coming up.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_emails",
      description: "get unread emails with triage — who's emailing, what needs reply, what's noise. use when user asks about email, inbox, or when you notice a connection to someone in their calendar.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "get the user's open task queue sorted by urgency. use when they ask what to focus on, what's pending, or when you want to suggest what to do in a free block.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_person",
      description: "look up everything about a specific person — recent messages, tasks they assigned, last contact. use when the user mentions someone by name or asks about a person.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "the person's name to look up" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_conversation",
      description: "get recent conversation history between you and the user. use for context on what you've already discussed.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "how many recent messages (default 8)" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_email_draft",
      description: "save a draft email in the user's gmail (does NOT send it). use when the user asks you to draft, write, or compose an email or reply. always pull emails first to understand context, then write the draft.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "recipient email address" },
          subject: { type: "string", description: "email subject line" },
          body: { type: "string", description: "the full email body text" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cross_insights",
      description: "get smart cross-source connections — people who appear in calendar + email + tasks, prep needed, patterns across sources. use to connect dots before giving advice.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// --- Formatting helpers ---

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtCalendar(cal: Awaited<ReturnType<typeof analyzeCalendar>>): string {
  const lines: string[] = [];
  if (cal.events.length) {
    const sorted = [...cal.events].sort((a, b) => a.start.getTime() - b.start.getTime());
    lines.push("schedule today:");
    for (const e of sorted) {
      lines.push(`- ${fmtTime(e.start)}-${fmtTime(e.end)}: ${e.title} (${e.durationMin}min)${e.attendees.length ? ` with ${e.attendees.slice(0, 3).join(", ")}` : ""}`);
    }
  }
  if (cal.freeBlocks.length) {
    lines.push("free blocks:");
    for (const b of cal.freeBlocks) lines.push(`- ${fmtTime(b.start)}-${fmtTime(b.end)} (${b.durationMin}min)`);
  }
  if (cal.insights) lines.push(`insights: ${cal.insights}`);
  return lines.length ? lines.join("\n") : "clear schedule today";
}

function fmtEmails(gmail: Awaited<ReturnType<typeof analyzeGmail>>): string {
  const lines: string[] = [];
  if (gmail.emails.length) {
    lines.push(`${gmail.emails.length} unread emails:`);
    for (const e of gmail.emails.slice(0, 8)) {
      lines.push(`- from ${e.from}: ${e.subject}${e.snippet ? ` — ${e.snippet.slice(0, 100)}` : ""}`);
    }
  }
  if (gmail.actionItems.length) {
    lines.push("action items:");
    for (const a of gmail.actionItems) lines.push(`- ${a}`);
  }
  if (gmail.insights) lines.push(`insights: ${gmail.insights}`);
  return lines.length ? lines.join("\n") : "inbox clear";
}

function fmtTasks(tasks: any[]): string {
  if (!tasks.length) return "no open tasks";
  return tasks.slice(0, 10).map((t, i) =>
    `${i + 1}. ${t.description}${t.urgency > 3 ? ` [urgency: ${t.urgency}]` : ""}${t.deadline ? ` [due: ${t.deadline}]` : ""}${t.assigned_by ? ` (from ${t.assigned_by})` : ""}`
  ).join("\n");
}

function fmtPerson(name: string): string {
  const { person, messages, tasks } = getPersonDossier(name);
  if (!person && !messages.length && !tasks.length) return `no info on "${name}"`;
  const lines: string[] = [`about ${name}:`];
  if (person?.context_notes) lines.push(`context: ${person.context_notes}`);
  if (person?.last_contact) lines.push(`last contact: ${person.last_contact}`);
  for (const m of messages.slice(0, 5)) lines.push(`- [${m.sender}] ${(m.content ?? "").slice(0, 80)}`);
  for (const t of tasks) lines.push(`- task: ${t.description}${t.deadline ? ` [due: ${t.deadline}]` : ""} (${t.status})`);
  return lines.join("\n");
}

function fmtConversation(limit: number): string {
  const entries = getRecentConversation(limit);
  if (!entries.length) return "no conversation history yet";
  return [...entries].reverse().map(e => {
    const who = e.direction === "in" ? "user" : "nudge";
    return `${who}: ${e.content.slice(0, 100)}`;
  }).join("\n");
}

// --- Tool executor ---

export function createToolExecutor(phone?: string) {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case "get_calendar":
        return fmtCalendar(await analyzeCalendar(phone));

      case "get_emails":
        return fmtEmails(await analyzeGmail(phone));

      case "get_tasks":
        return fmtTasks(getTaskQueue());

      case "get_person":
        return fmtPerson(args.name as string);

      case "get_conversation":
        return fmtConversation((args.limit as number) || 8);

      case "save_email_draft": {
        const result = await saveEmailDraft(
          args.to as string,
          args.subject as string,
          args.body as string,
          phone,
        );
        return result.message;
      }

      case "get_cross_insights":
        return getCachedInsights();

      default:
        return `unknown tool: ${name}`;
    }
  };
}
