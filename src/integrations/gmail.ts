import { executeWithFallback } from "./composio.js";

export interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

const SEARCH_KEYS = ["messages", "emails", "threads", "data", "results", "items"];

function normalizeEmail(e: any): EmailSummary {
  let from = e.from || e.sender || "";
  let subject = "";

  if (e.subject) {
    subject = e.subject;
  } else if (e.headers) {
    if (Array.isArray(e.headers)) {
      const subjectHeader = e.headers.find((h: any) => h.name === "Subject");
      if (subjectHeader) {
        subject = subjectHeader.value;
      }
    } else if (typeof e.headers === "object" && e.headers.Subject) {
      subject = e.headers.Subject;
    }
  } else if (e.payload && e.payload.headers) {
    if (Array.isArray(e.payload.headers)) {
      const subjectHeader = e.payload.headers.find((h: any) => h.name === "Subject");
      if (subjectHeader) {
        subject = subjectHeader.value;
      }
    } else if (typeof e.payload.headers === "object" && e.payload.headers.Subject) {
      subject = e.payload.headers.Subject;
    }
  }

  const snippet = (e.snippet || e.body || "").slice(0, 100);
  const date = e.date || e.internalDate || "";

  return { from, subject, snippet, date };
}

export async function pullUnreadEmails(maxResults: number = 20): Promise<EmailSummary[]> {
  const strategies = [
    { actionName: "GMAIL_FETCH_EMAILS", params: { max_results: maxResults } },
    { actionName: "GMAIL_LIST_EMAILS", params: { max_results: maxResults } },
    { actionName: "GMAIL_FETCH_EMAILS", params: { maxResults, userId: "me" } },
    { actionName: "GMAIL_LIST_THREADS", params: { max_results: maxResults } }
  ];

  const results = await executeWithFallback(strategies, SEARCH_KEYS, "unread emails");
  return results.map(normalizeEmail);
}
