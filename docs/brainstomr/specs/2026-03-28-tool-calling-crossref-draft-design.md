# Design: LLM Tool Calling + Smart Cross-Reference + Email Drafts

**Date:** 2026-03-28
**Status:** Approved

## Summary

Replace the regex-based intent classifier with M2.7 native tool calling. The LLM decides which integrations to invoke per message, sees the results, and generates a response. Add a `save_email_draft` tool via Composio. Replace word-matching cross-referencing with an LLM-powered background loop that caches semantic insights.

## Changes

### 1. `src/minimax/llm.ts` — Add `generateWithTools()`

New function alongside existing `generate()` and `generateJSON()`:

```typescript
generateWithTools(
  system: string,
  user: string,
  tools: ToolDef[],
  executor: (name: string, args: Record<string, unknown>) => Promise<string>
): Promise<string>
```

- Sends request to M2.7 with OpenAI-compatible `tools` array
- If response contains `tool_calls`, executes each via `executor`, appends results as `tool` role messages, re-sends
- Caps at 5 tool-call rounds to prevent runaway
- Strips think tags from final text response
- Falls back to `generate()` if tool calling fails entirely

### 2. `src/agent/tools.ts` — New File: Tool Definitions + Executors

Defines 7 tools available to M2.7:

| Tool | Params | Executor |
|------|--------|----------|
| `get_calendar` | `phone?` | Calls `analyzeCalendar(phone)`, returns formatted events + free blocks + insights |
| `get_emails` | `phone?` | Calls `analyzeGmail(phone)`, returns formatted emails + action items + insights |
| `get_tasks` | none | Calls `getTaskQueue()`, returns formatted task list |
| `get_person` | `name` | Calls `getPersonDossier(name)`, returns formatted dossier |
| `get_conversation` | `limit?` | Calls `getRecentConversation(limit)`, returns formatted history |
| `save_email_draft` | `to, subject, body, phone?` | Calls new `saveEmailDraft()` in gmail.ts, returns confirmation |
| `get_cross_insights` | `phone?` | Returns cached LLM cross-source insights string |

Each tool exports:
- `TOOL_DEFS`: Array of OpenAI function-calling tool specs
- `executeTool(name, args, phone)`: Dispatcher that calls the right executor

### 3. `src/agent/handler.ts` — Rewrite Message Pipeline

Remove:
- `classifyIntent()`, `INTENT_RULES`, `INTENT_HINTS`
- Static `assembleContext()` call

New pipeline:
1. Skip reactions/acknowledgments (unchanged)
2. Build system prompt: personality + temporal voice + tool usage guidance + post-history enforcement
3. If image attachment: run vision analysis, prepend to user message
4. Call `generateWithTools(system, userMessage, TOOL_DEFS, executeTool)`
5. Validate response with `validateResponse()` (or `validateDraft()` if draft tool was called)
6. Send text reply
7. Log to DB

The system prompt adds a tool guidance section telling M2.7 when to use each tool and that `save_email_draft` saves but never sends.

### 4. `src/integrations/gmail.ts` — Add `saveEmailDraft()`

```typescript
saveEmailDraft(to: string, subject: string, body: string, phone?: string): Promise<{success: boolean, message: string}>
```

- Uses `executeWithFallback` with strategies: `GMAIL_CREATE_DRAFT`, `GMAIL_DRAFTS_CREATE`
- Returns `{success: true, message: "draft saved"}` or `{success: false, message: "...error..."}`
- Never sends email. Only creates draft.

### 5. `src/agent/crossref.ts` — New File: LLM Cross-Reference Loop

Background loop (runs every 5 minutes):
1. Pulls calendar events, emails, task queue in parallel
2. Formats all three into a single prompt
3. Sends to M2.7: "find meaningful connections — same people across sources, prep needed before meetings, unanswered emails from meeting attendees, deadline + calendar conflicts"
4. Caches result string in module-level variable
5. `getCachedInsights()` export returns the cached string (used by `get_cross_insights` tool)

Replaces the `crossReference()` function in `context.ts`.

### 6. What Stays the Same

- `personality.ts` — unchanged
- `sdk.ts`, `router.ts` — unchanged
- `proactive/` — unchanged (still uses `assembleContext()` for proactive messages)
- `extractor.ts` — unchanged
- `db.ts` — unchanged
- `calendar.ts` — unchanged (called by tool executors)
- `composio.ts` — unchanged (`saveEmailDraft` uses `executeWithFallback`)
- `validateResponse()` still runs on final LLM output
- `assembleContext()` stays for proactive engine use, just no longer called by handler

### 7. `src/index.ts` — Start Cross-Reference Loop

Add `startCrossRefLoop()` call alongside existing extractor and proactive engine startup.

## File Impact

| File | Change |
|------|--------|
| `src/minimax/llm.ts` | Add `generateWithTools()` |
| `src/agent/tools.ts` | **New** — tool definitions + executors |
| `src/agent/crossref.ts` | **New** — LLM cross-reference background loop |
| `src/agent/handler.ts` | Rewrite pipeline to use tool calling |
| `src/integrations/gmail.ts` | Add `saveEmailDraft()` |
| `src/index.ts` | Start cross-ref loop |
| `src/agent/context.ts` | Remove `crossReference()` (dead code after handler rewrite) |

## Risks

- M2.7 tool calling quality — if it calls wrong tools or hallucinates params, responses degrade. Mitigation: clear tool descriptions, cap at 5 rounds, fallback to plain `generate()`.
- Latency — tool calling adds round trips. Mitigation: tools execute fast (calendar/email already cached by background loops), most messages need 1-2 tool calls.
- Draft saves failing — Composio action names may vary. Mitigation: `executeWithFallback` with multiple strategy names.
