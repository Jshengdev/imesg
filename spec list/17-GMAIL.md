# Gmail Integration Specification

## Overview
The Gmail module provides Gmail integration via Composio.

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

### `pullUnreadEmails(maxResults?): Promise<EmailSummary[]>`
Retrieves unread emails.

**Parameters:**
- `maxResults?: number` - Max emails (default: 20)

**Strategies:**
1. `GMAIL_FETCH_EMAILS` with max_results
2. `GMAIL_FETCH_EMAILS` with maxResults
3. `GMAIL_LIST_THREADS`

### `normalize(email): EmailSummary`
Normalizes raw API response.

**Field Extraction:**
```typescript
{
  from: e.from || e.sender || "",
  subject: e.subject || headerSubject || "",
  snippet: (e.snippet || e.body || "").slice(0, 100),
  date: e.date || e.internalDate || ""
}
```
