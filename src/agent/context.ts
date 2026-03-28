import { getTaskQueue, getRecentConversation, getPersonDossier } from "../memory/db";
import { analyzeCalendar, type CalendarEvent, type FreeBlock, type CalendarAnalysis } from "../integrations/calendar";
import { analyzeGmail, type EmailSummary, type GmailAnalysis } from "../integrations/gmail";

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// --- Cross-referencing: connect people across sources ---

function crossReference(events: CalendarEvent[], emails: EmailSummary[], tasks: any[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(w => w.length > 2);

  const personSources = new Map<string, { events: string[]; emails: string[]; tasks: string[] }>();
  const touch = (name: string) => {
    if (!personSources.has(name)) personSources.set(name, { events: [], emails: [], tasks: [] });
    return personSources.get(name)!;
  };

  for (const ev of events) {
    for (const att of ev.attendees) { for (const w of norm(att)) touch(w).events.push(ev.title); }
  }
  for (const em of emails) {
    for (const w of norm(em.from)) touch(w).emails.push(em.subject);
  }
  for (const t of tasks) {
    if (t.assigned_by) { for (const w of norm(t.assigned_by)) touch(w).tasks.push(t.description); }
  }

  const crossings: string[] = [];
  for (const [person, src] of personSources) {
    const count = (src.events.length > 0 ? 1 : 0) + (src.emails.length > 0 ? 1 : 0) + (src.tasks.length > 0 ? 1 : 0);
    if (count < 2) continue;
    const parts: string[] = [];
    if (src.events.length) parts.push(`meeting "${src.events[0]}"`);
    if (src.emails.length) parts.push(`email re: "${src.emails[0]}"`);
    if (src.tasks.length) parts.push(`task: "${src.tasks[0]}"`);
    crossings.push(`- "${person}" appears in ${parts.join(" + ")}`);
  }

  return crossings.length ? `## cross-source connections\n${crossings.join("\n")}` : "";
}

// --- Situational awareness ---

function fmtSituation(events: CalendarEvent[], freeBlocks: FreeBlock[], tasks: any[], emails: EmailSummary[]): string {
  const now = new Date();
  const lines: string[] = [];

  const currentMeeting = events.find(e => e.start <= now && e.end > now);
  const nextMeeting = events.find(e => e.start > now);
  if (currentMeeting) {
    const minsLeft = Math.round((currentMeeting.end.getTime() - now.getTime()) / 60000);
    lines.push(`you're in "${currentMeeting.title}" right now (${minsLeft} min left)`);
  } else if (nextMeeting) {
    const minsUntil = Math.round((nextMeeting.start.getTime() - now.getTime()) / 60000);
    if (minsUntil <= 60) {
      lines.push(`next up: "${nextMeeting.title}" in ${minsUntil} min${nextMeeting.attendees.length ? ` with ${nextMeeting.attendees.slice(0, 2).join(", ")}` : ""}`);
    }
  }

  const urgent = tasks.filter((t: any) => t.urgency >= 4);
  if (urgent.length) lines.push(`${urgent.length} urgent task${urgent.length > 1 ? "s" : ""} pending`);
  if (emails.length >= 5) lines.push(`${emails.length} unread emails`);

  const nextBlock = freeBlocks.find(b => b.start > now && b.durationMin >= 30);
  if (nextBlock && urgent.length) {
    lines.push(`next ${nextBlock.durationMin}-min gap at ${fmtTime(nextBlock.start)} — good for "${urgent[0].description}"`);
  }

  return lines.length ? `## right now\n${lines.join("\n")}` : "";
}

// --- Standard formatters ---

function fmtEvents(events: CalendarEvent[]): string {
  if (!events.length) return "";
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const lines = sorted.map(e => `- ${fmtTime(e.start)}: ${e.title} (${e.durationMin}min)${e.attendees.length ? ` with ${e.attendees.slice(0, 3).join(", ")}` : ""}`);
  return `## schedule today\n${lines.join("\n")}`;
}

function fmtFreeBlocks(blocks: FreeBlock[]): string {
  if (!blocks.length) return "";
  const lines = blocks.map(b => `- ${fmtTime(b.start)}-${fmtTime(b.end)} (${b.durationMin} min)`);
  return `## free blocks\n${lines.join("\n")}`;
}

function fmtTasks(tasks: any[]): string {
  if (!tasks.length) return "";
  const lines = tasks.slice(0, 10).map((t, i) =>
    `${i + 1}. ${t.description}${t.urgency > 3 ? ` [urgency: ${t.urgency}]` : ""}${t.deadline ? ` [due: ${t.deadline}]` : ""}${t.assigned_by ? ` (from ${t.assigned_by})` : ""}`
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
  const lines = [...entries].reverse().map(e => {
    const who = e.direction === "in" ? "user" : "nudge";
    return `${who}: ${e.content.slice(0, 100)}`;
  });
  return `## recent conversation\n${lines.join("\n")}`;
}

// --- LLM-generated insight sections ---

function fmtCalendarInsights(analysis: CalendarAnalysis): string {
  if (!analysis.insights) return "";
  return `## calendar insights\n${analysis.insights}`;
}

function fmtEmailInsights(analysis: GmailAnalysis): string {
  const parts: string[] = [];
  if (analysis.insights) parts.push(analysis.insights);
  if (analysis.actionItems.length) {
    parts.push("action items:\n" + analysis.actionItems.map(a => `- ${a}`).join("\n"));
  }
  return parts.length ? `## email insights\n${parts.join("\n")}` : "";
}

// --- Intent-aware section ordering ---

const SECTION_ORDER: Record<string, string[]> = {
  task: ["situation", "conversation", "tasks", "calInsights", "emailInsights", "crossref", "blocks", "events", "emails"],
  email: ["situation", "conversation", "emailInsights", "emails", "crossref", "calInsights", "tasks", "events", "blocks"],
  schedule: ["situation", "conversation", "events", "calInsights", "blocks", "crossref", "tasks", "emailInsights", "emails"],
  draft: ["situation", "conversation", "emailInsights", "emails", "crossref", "tasks", "calInsights", "events", "blocks"],
  person: ["situation", "conversation", "crossref", "tasks", "emailInsights", "emails", "calInsights", "events", "blocks"],
};

const DEFAULT_ORDER = ["situation", "conversation", "calInsights", "events", "blocks", "emailInsights", "crossref", "tasks", "emails"];

// --- Person extraction ---

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

function fmtPersonDossier(name: string, userId?: string): string {
  const { person, messages, tasks } = getPersonDossier(name, userId);
  if (!person && !messages.length && !tasks.length) return "";
  const lines: string[] = [`## about ${name}`];
  if (person?.context_notes) lines.push(`context: ${person.context_notes}`);
  if (person?.last_contact) lines.push(`last contact: ${person.last_contact}`);
  for (const m of messages.slice(0, 5)) lines.push(`- [${m.sender}] ${(m.content ?? "").slice(0, 80)}`);
  for (const t of tasks) lines.push(`- task: ${t.description}${t.deadline ? ` [due: ${t.deadline}]` : ""} (${t.status})`);
  return lines.join("\n");
}

// --- Main context assembly ---

export async function assembleContext(intent?: string, userText?: string, phone?: string, userId?: string): Promise<string> {
  const [calResult, tasksResult, gmailResult] = await Promise.allSettled([
    analyzeCalendar(phone),
    Promise.resolve(getTaskQueue(userId)),
    analyzeGmail(phone),
  ]);

  const cal = calResult.status === "fulfilled" ? calResult.value : { events: [], freeBlocks: [], insights: "", tags: [] };
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const gmail = gmailResult.status === "fulfilled" ? gmailResult.value : { emails: [], insights: "", tags: [], topSenders: [], actionItems: [] };
  const conversation = getRecentConversation(8, userId);

  const all: Record<string, string> = {
    situation: fmtSituation(cal.events, cal.freeBlocks, tasks, gmail.emails),
    conversation: fmtConversation(conversation),
    events: fmtEvents(cal.events),
    blocks: fmtFreeBlocks(cal.freeBlocks),
    tasks: fmtTasks(tasks),
    emails: fmtEmails(gmail.emails),
    crossref: crossReference(cal.events, gmail.emails, tasks),
    calInsights: fmtCalendarInsights(cal),
    emailInsights: fmtEmailInsights(gmail),
  };

  const order = (intent && SECTION_ORDER[intent]) || DEFAULT_ORDER;
  const sections = order.map(k => all[k]).filter(Boolean);

  if ((intent === "person" || intent === "draft") && userText) {
    const name = intent === "draft" ? extractDraftRecipient(userText) : extractPersonName(userText);
    if (name) {
      const dossier = fmtPersonDossier(name, userId);
      if (dossier) sections.unshift(dossier);
    }
  }

  return sections.length ? sections.join("\n\n") : "no context available right now";
}
