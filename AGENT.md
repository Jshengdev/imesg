# Nudge — iMessage AI Assistant

## Architecture

Every incoming iMessage → agent responds with voice note + text.
Per-user OAuth onboarding (Gmail + Calendar via Composio). Max 6 users.

```
incoming message → sdk.ts (normalize + dedup + debug log)
  → router.ts (isFromMe? ignore : agent)
  → handler.ts (onboarding check → intent classify → context assemble → LLM → TTS → reply)

background:
  → extractor.ts (30s loop: batch messages → M2.7 extracts tasks/people → SQLite)
  → proactive/ (9 triggers: morning briefing, pre-meeting, task nudge, etc.)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Boot sequence — DB, iMessage watcher, extractor, proactive engine |
| `src/config.ts` | Env vars (SCREAMING_SNAKE keys) |
| `src/imessage/sdk.ts` | Photon iMessage Kit wrapper, send/receive, debug logging |
| `src/imessage/router.ts` | Route: isFromMe → ignore, else → agent |
| `src/agent/handler.ts` | Intent classification, onboarding flow, LLM response + TTS |
| `src/agent/context.ts` | Assembles calendar/gmail/tasks/conversation into context |
| `src/agent/personality.ts` | System prompt, banned phrases, validation, temporal voice |
| `src/integrations/composio.ts` | Per-user Composio entities, OAuth links, executeWithFallback |
| `src/integrations/calendar.ts` | Pull + LLM-analyze Google Calendar (per-user) |
| `src/integrations/gmail.ts` | Pull + LLM-analyze Gmail (per-user) |
| `src/minimax/llm.ts` | M2.7 with model fallback, JSON mode, think-tag stripping |
| `src/minimax/tts.ts` | Speech 2.8 TTS, 3-endpoint fallback, silent placeholder |
| `src/minimax/vision.ts` | Image analysis via M2.7 multimodal |
| `src/memory/db.ts` | SQLite — messages, tasks, people, agent_log, proactive_log |
| `src/listener/extractor.ts` | Batch message → M2.7 JSON extraction → store tasks/people |
| `src/agent/proactive/` | Engine + 9 triggers (scheduled + event-driven) |

## Runtime

- Use `npx tsx src/index.ts` to run (better-sqlite3 doesn't work with bun)
- Use `bun` for anything that doesn't touch the database
- Tests: `bun run test:1-config` through `test:8-personality`
- DB test: `npx tsx -e "..."` (not bun)

## Rules

- NEVER write git commits — only Trae.ai commits
- Config keys are SCREAMING_SNAKE: `config.MINIMAX_API_KEY` not `config.minimaxApiKey`
- All LLM responses go through `validateResponse()` (banned phrases, 120 word max)
- Integration pattern: Pull → Structural Analysis → LLM Analysis (see INTEGRATION_TEMPLATE.md)
