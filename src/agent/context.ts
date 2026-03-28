import { getTaskQueue, getRecentConversation, getPersonDossier } from "../memory/db";
import { pullTodayEvents, findFreeBlocks, type CalendarEvent, type FreeBlock } from "../integrations/calendar";
import { pullUnreadEmails, type EmailSummary } from "../integrations/gmail";

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtEvents(events: CalendarEvent[]): string {
  if (!events.length) return "";
  const lines = events.map(e => `- ${fmtTime(e.start)}: ${e.title}${e.attendees.length ? ` (${e.attendees.slice(0, 3).join(", ")})` : ""}`);
  return `## your schedule today\n${lines.join("\n")}`;
}

function fmtFreeBlocks(blocks: FreeBlock[]): string {
  if (!blocks.length) return "";
  const lines = blocks.map(b => `- ${fmtTime(b.start)}-${fmtTime(b.end)} (${b.durationMin} min)`);
  return `## free blocks\n${lines.join("\n")}`;
}

function fmtTasks(tasks: any[]): string {
  if (!tasks.length) return "";
  const lines = tasks.slice(0, 10).map((t, i) =>
    `${i + 1}. ${t.description}${t.urgency > 3 ? ` [urgency: ${t.urgency}]` : ""}${t.deadline ? ` [due: ${t.deadline}]` : ""}`
  );
  return `## task queue\n${lines.join("\n")}`;
}

function fmtEmails(emails: EmailSummary[]): string {
  if (!emails.length) return "";
  const lines = emails.slice(0, 5).map(e => `- from ${e.from}: ${e.subject}${e.snippet ? ` — ${e.snippet}` : ""}`);
  return `## unread emails\n${lines.join("\n")}`;
}

function fmtConversation(entries: { direction: string; content: string; timestamp: string }[]): string {
  if (!entries.length) return "";
  const lines = entries.reverse().map(e => {
    const who = e.direction === "in" ? "user" : "nudge";
    return `${who}: ${e.content.slice(0, 100)}`;
  });
  return `## recent conversation\n${lines.join("\n")}`;
}

const SECTION_ORDER: Record<string, string[]> = {
  task: ["conversation", "tasks", "blocks", "events", "emails"],
  email: ["conversation", "emails", "tasks", "events", "blocks"],
  schedule: ["conversation", "events", "blocks", "tasks", "emails"],
  draft: ["conversation", "emails", "tasks", "events", "blocks"],
  person: ["conversation", "tasks", "emails", "events", "blocks"],
};

const PERSON_RE = /\b(?:what did|about|from|tell me about|anything from|update on)\s+([a-z][a-z]+(?:\s+[a-z]+)?)(?:\s+(?:ask|say|send|want|need|think|do|mention))?/i;
const STOP_VERBS = new Set(["ask", "say", "send", "want", "need", "think", "do", "mention", "reply", "email", "text"]);
const DRAFT_RE = /\b(?:reply|write|draft|respond|email|text)\b.*?\bto\s+(\w+(?:\s+\w+)?)/i;
const DRAFT_STOPS = new Set([...STOP_VERBS, "about", "regarding", "the", "for", "with", "from", "that", "this"]);

export function extractDraftRecipient(text: string): string | null {
  const m = DRAFT_RE.exec(text);
  if (!m?.[1]) return null;
  const words = m[1].split(/\s+/).filter(w => w.length > 2 && !DRAFT_STOPS.has(w.toLowerCase()));
  return words.length ? words.join(" ") : null;
}

export function extractPersonName(text: string): string | null {
  const m = PERSON_RE.exec(text);
  if (!m?.[1]) return null;
  const words = m[1].trim().split(/\s+/).filter(w => !STOP_VERBS.has(w.toLowerCase()));
  return words.length ? words.join(" ") : null;
}

function fmtPersonDossier(name: string): string {
  const { person, messages, tasks } = getPersonDossier(name);
  if (!person && !messages.length && !tasks.length) return "";
  const lines: string[] = [`## about ${name}`];
  if (person?.context_notes) lines.push(`context: ${person.context_notes}`);
  if (person?.last_contact) lines.push(`last contact: ${person.last_contact}`);
  for (const m of messages.slice(0, 5)) lines.push(`- [${m.sender}] ${(m.content ?? "").slice(0, 80)}`);
  for (const t of tasks) lines.push(`- task: ${t.description}${t.deadline ? ` [due: ${t.deadline}]` : ""} (${t.status})`);
  return lines.join("\n");
}

const DEFAULT_ORDER = ["conversation", "events", "blocks", "tasks", "emails"];

export async function assembleContext(intent?: string, userText?: string): Promise<string> {
  const [eventsResult, tasksResult, emailsResult] = await Promise.allSettled([
    pullTodayEvents(),
    Promise.resolve(getTaskQueue()),
    pullUnreadEmails(5),
  ]);

  const events = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const emails = emailsResult.status === "fulfilled" ? emailsResult.value : [];
  const freeBlocks = findFreeBlocks(events);
  const conversation = getRecentConversation(8);

  const all: Record<string, string> = {
    conversation: fmtConversation(conversation), events: fmtEvents(events),
    blocks: fmtFreeBlocks(freeBlocks), tasks: fmtTasks(tasks), emails: fmtEmails(emails),
  };
  const order = (intent && SECTION_ORDER[intent]) || DEFAULT_ORDER;
  const sections = order.map(k => all[k]).filter(Boolean);

  if ((intent === "person" || intent === "draft") && userText) {
    const name = intent === "draft" ? extractDraftRecipient(userText) : extractPersonName(userText);
    if (name) {
      const dossier = fmtPersonDossier(name);
      if (dossier) sections.unshift(dossier);
    }
  }

  return sections.length ? sections.join("\n\n") : "no context available right now";
}
