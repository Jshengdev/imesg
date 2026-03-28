import { executeWithFallback } from "./composio.js";

export interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

const SEARCH_KEYS = ["messages", "emails", "threads", "data", "results", "items"];

export async function pullUnreadEmails(maxResults = 20): Promise<EmailSummary[]> {
  const raw = await executeWithFallback([
    { actionName: "GMAIL_FETCH_EMAILS", params: { max_results: maxResults } },
    { actionName: "GMAIL_FETCH_EMAILS", params: { maxResults, userId: "me" } },
    { actionName: "GMAIL_LIST_THREADS", params: { max_results: maxResults } },
  ], SEARCH_KEYS, "gmail");
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
    snippet: (e.snippet || e.body || "").slice(0, 100),
    date: e.date || e.internalDate || "",
  };
}
