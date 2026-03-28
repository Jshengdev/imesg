# Gmail Integration Specification

## Overview
The Gmail module (`src/integrations/gmail.ts`) provides Gmail integration via Composio.

## Dependencies
- Internal: `executeWithFallback` from `./composio`

## Data Types

### EmailSummary
```typescript
interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
}
```

## Public API

### `pullUnreadEmails(maxResults?: number): Promise<EmailSummary[]>`
Retrieves unread emails.

**Parameters:**
- `maxResults?: number` - Maximum emails to fetch (default: 20)

**Returns:** Array of EmailSummary objects

**Execution Strategies (in order):**
1. `GMAIL_FETCH_EMAILS` with `max_results`
2. `GMAIL_FETCH_EMAILS` with `maxResults`
3. `GMAIL_LIST_THREADS` with `max_results`

**Search Keys:** `["messages", "emails", "threads", "data", "results", "items"]`

### `normalize(email: any): EmailSummary`
Normalizes raw API response to EmailSummary format.

**Parameters:**
- `email: any` - Raw email from API

**Returns:** Normalized EmailSummary

**Field Extraction:**
```typescript
{
  from: e.from || e.sender || "",
  subject: e.subject || headerSubject || "",
  snippet: (e.snippet || e.body || "").slice(0, 100),
  date: e.date || e.internalDate || ""
}
```

**Header Extraction for Subject:**
```typescript
const headers = e.headers || e.payload?.headers || [];
const headerSubject = Array.isArray(headers)
  ? headers.find((h: any) => h.name === "Subject")?.value
  : headers.Subject;
```

## Usage Example
```typescript
import { pullUnreadEmails } from './integrations/gmail';

// Get unread emails
const emails = await pullUnreadEmails(10);
console.log(`You have ${emails.length} unread emails`);

// Show top 3
emails.slice(0, 3).forEach(email => {
  console.log(`From: ${email.from}`);
  console.log(`Subject: ${email.subject}`);
  console.log(`Preview: ${email.snippet}`);
});
```

## Error Handling
- Returns empty array if Composio is in mock mode
- Falls back through strategies if first fails
- Returns empty emails array if all strategies fail
- Snippet truncated to 100 characters
