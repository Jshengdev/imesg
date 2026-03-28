# Agent Handler Module Specification

## Overview
The agent handler processes messages in agent chat, classifies intent, generates responses.

## Dependencies
- Internal: `generate` from `../minimax/llm`
- Internal: `textToSpeech` from `../minimax/tts`
- Internal: `analyzeImage` from `../minimax/vision`
- Internal: `sendText`, `sendWithVoice` from `../imessage/sdk`
- Internal: `logAgent` from `../memory/db`
- Internal: `SYSTEM_PROMPT`, `validateResponse`, `validateDraft`, `getTemporalVoice` from `./personality`
- Internal: `assembleContext` from `./context`

## Intent Types
```typescript
type Intent = "task" | "email" | "schedule" | "person" | "photo" | "draft" | "general";
```

## Intent Patterns

| Intent | Patterns | Hint |
|--------|----------|------|
| `task` | tasks?, todos?, urgent, what should | Prioritize actionable items |
| `email` | emails?, inbox, unread, gmail | Triage, highlight action-needed |
| `schedule` | calendar, schedule, meetings?, free | Reference specific times |
| `person` | who, what did X say/ask | Surface person context |
| `draft` | draft, write, reply, compose | Write actual content |
| `photo` | Image attachment | Describe photo, extract info |
| `general` | Default | (no hint) |

## Public API

### `classifyIntent(text: string): Intent`
Classifies user message intent based on patterns.

### `generateValidated(system, user): Promise<string>`
Generates response with validation retry.

### `handleAgentMessage(msg: NormalizedMessage): Promise<void>`
Main message handler for agent chat.
