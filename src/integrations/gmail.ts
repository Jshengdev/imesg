import { executeWithFallback, getUserEntity, isMockMode } from "./composio.js";
import { generateJSON } from "../minimax/llm";

export interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface GmailAnalysis {
  emails: EmailSummary[];
  insights: string;
  tags: string[];
  topSenders: { name: string; count: number }[];
  actionItems: string[];
}

const SEARCH_KEYS = ["messages", "emails", "threads", "data", "results", "items"];

// --- Pull + Normalize ---

export async function pullUnreadEmails(maxResults = 20, phone?: string): Promise<EmailSummary[]> {
  const raw = await executeWithFallback([
    { actionName: "GMAIL_FETCH_EMAILS", params: { max_results: maxResults } },
    { actionName: "GMAIL_FETCH_EMAILS", params: { maxResults, userId: "me" } },
    { actionName: "GMAIL_LIST_THREADS", params: { max_results: maxResults } },
  ], SEARCH_KEYS, "gmail", phone);
  return raw.map(normalize);
}

function normalize(e: any): EmailSummary {
  const headers = e.headers || e.payload?.headers || [];
  const headerSubject = Array.isArray(headers)
    ? headers.find((h: any) => h.name === "Subject")?.value
    : headers.Subject;
  return {
    from: e.from || e.sender || "",
    subject: e.subject || headerSubject || "",
    snippet: (e.snippet || e.body || "").slice(0, 200),
    date: e.date || e.internalDate || "",
  };
}

// --- Structural Analysis (no LLM) ---

function analyzeStructure(emails: EmailSummary[]): { topSenders: { name: string; count: number }[]; tags: string[] } {
  // Sender frequency
  const senderCounts = new Map<string, number>();
  for (const e of emails) {
    const sender = e.from.toLowerCase();
    senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
  }
  const topSenders = [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Tags
  const tags: string[] = [];
  if (emails.length >= 10) tags.push("email_heavy");
  if (emails.length <= 2) tags.push("email_light");

  const escalated = topSenders.filter(s => s.count >= 3);
  if (escalated.length) tags.push("sender_escalation");

  return { topSenders, tags };
}

// --- LLM Analysis ---

const EMAIL_ANALYSIS_PROMPT = `you are triaging a user's unread emails. extract what ACTUALLY needs attention.

given these emails, return JSON:
{
  "action_items": [
    "one sentence — what needs doing, from whom, how urgent"
  ],
  "can_ignore": ["subjects of emails that are clearly newsletters/marketing/noise"],
  "insights": [
    "pattern or connection you notice — e.g. same person emailing + has a meeting today"
  ],
  "urgent_count": 0
}

be specific. use sender names and subjects. distinguish between "needs reply" vs "FYI" vs "marketing noise".
if nothing needs attention, say so.`;

// --- Save Email Draft via Composio ---

export async function saveEmailDraft(
  to: string,
  subject: string,
  body: string,
  phone?: string,
): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) return { success: false, message: "composio offline — can't save draft" };

  const strategies = [
    { actionName: "GMAIL_CREATE_DRAFT", params: { to, subject, body, userId: "me" } },
    { actionName: "GMAIL_DRAFTS_CREATE", params: { to, subject, body } },
    { actionName: "GMAIL_CREATE_DRAFT", params: { message: { to, subject, body } } },
  ];

  try {
    const entity = phone ? await getUserEntity(phone) : null;
    for (const s of strategies) {
      try {
        const result = entity
          ? await entity.execute(s)
          : await executeWithFallback([s], ["id", "draft", "message"], "gmail-draft", phone);
        if (result) return { success: true, message: `draft saved — "${subject}" to ${to}` };
      } catch (err) {
        console.warn(`[gmail] ${s.actionName} failed:`, (err as Error).message);
      }
    }
    return { success: false, message: "couldn't save draft — all strategies failed" };
  } catch (err) {
    return { success: false, message: `draft failed: ${(err as Error).message}` };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  phone?: string,
): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) return { success: false, message: "composio offline — can't send email" };

  const strategies = [
    { actionName: "GMAIL_SEND_EMAIL", params: { to, subject, body, userId: "me" } },
    { actionName: "GMAIL_SEND_EMAIL", params: { to, subject, message: { raw: Buffer.from(`to: ${to}\nsubject: ${subject}\n\n${body}`).toString("base64") } } },
    { actionName: "GMAIL_EMAILS_SEND", params: { to, subject, body } },
    { actionName: "GMAIL_SEND", params: { to, subject, body } },
  ];

  try {
    const entity = phone ? await getUserEntity(phone) : null;
    for (const s of strategies) {
      try {
        const result = entity
          ? await entity.execute(s)
          : await executeWithFallback([s], ["id", "messageId", "sent", "success"], "gmail-send", phone);
        if (result) {
          console.log(`[gmail] sent email to ${to}: ${subject}`);
          return { success: true, message: `sent — "${subject}" to ${to}` };
        }
      } catch (err) {
        console.warn(`[gmail] ${s.actionName} failed:`, (err as Error).message);
      }
    }
    return { success: false, message: "couldn't send — all strategies failed" };
  } catch (err) {
    return { success: false, message: `send failed: ${(err as Error).message}` };
  }
}

export async function analyzeGmail(phone?: string): Promise<GmailAnalysis> {
  const emails = await pullUnreadEmails(20, phone);
  const structure = analyzeStructure(emails);

  if (emails.length === 0) {
    return { emails, insights: "inbox clear — no unread emails", tags: ["inbox_zero"], topSenders: [], actionItems: [] };
  }

  // Build email text for LLM
  const emailText = emails
    .map((e, i) => `${i + 1}. from: ${e.from}\n   subject: ${e.subject}\n   preview: ${e.snippet}`)
    .join("\n\n");

  const senderNote = structure.topSenders.length
    ? `\nsender frequency: ${structure.topSenders.map(s => `${s.name} (${s.count}x)`).join(", ")}`
    : "";

  try {
    const analysis = await generateJSON(EMAIL_ANALYSIS_PROMPT, emailText + senderNote);
    const actionItems = Array.isArray(analysis.action_items) ? analysis.action_items : [];
    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    const urgentCount = typeof analysis.urgent_count === "number" ? analysis.urgent_count : 0;

    const allInsights = [
      ...insights,
      urgentCount > 0 ? `${urgentCount} urgent email${urgentCount > 1 ? "s" : ""} need${urgentCount === 1 ? "s" : ""} attention` : "",
    ].filter(Boolean);

    return {
      emails,
      insights: allInsights.length ? allInsights.join("\n") : `${emails.length} unread emails, nothing urgent`,
      tags: structure.tags,
      topSenders: structure.topSenders,
      actionItems,
    };
  } catch (err) {
    console.warn("[gmail] LLM analysis failed, using structural:", err);
    return {
      emails,
      insights: `${emails.length} unread emails${structure.topSenders.length ? `, top sender: ${structure.topSenders[0].name} (${structure.topSenders[0].count}x)` : ""}`,
      tags: structure.tags,
      topSenders: structure.topSenders,
      actionItems: [],
    };
  }
}
