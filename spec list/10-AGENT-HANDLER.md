# Agent Handler Module Specification

## Overview
The agent handler (`src/agent/handler.ts`) processes messages in the agent chat, classifies intent, generates responses, and sends voice notes.

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

### `task`
Patterns: `/tasks?|todos?|focus|prioriti|urgent|what.*should|what.*next/`
Hint: "user is asking about tasks — prioritize actionable items with urgency and timing"

### `email`
Patterns: `/emails?|inbox|unread|mails?|gmail|summar\w* emails?/`
Hint: "user is asking about email — triage, highlight action-needed, skip noise"

### `schedule`
Patterns: `/calendar|schedule|meetings?|free at|busy|what time|standup|when.*is/`
Hint: "user is asking about their schedule — reference specific times, spot opportunities"

### `person`
Patterns: `/who|what did \w+ (?:say|ask|send|want|need)/`
Hint: "user is asking about a specific person — surface what they asked, owe, or need"

### `draft`
Patterns: `/draft|write.*(?:to|reply)|reply to|respond to|compose|response to/`
Hint: "user wants you to draft something — write the actual content, keep their voice"

### `photo`
Detected by: Image attachment present
Hint: "user sent a photo — describe what you see, extract actionable info"

### `general`
Default when no patterns match.
Hint: (empty)

## Image Detection
Supported extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

## Public API

### `classifyIntent(text: string): Intent`
Classifies user message intent based on keyword patterns.

**Parameters:**
- `text: string` - User message text

**Returns:** Detected intent type

**Behavior:**
1. Lowercases text
2. Tests against each intent's patterns
3. Returns first match or "general"

### `generateValidated(system: string, user: string): Promise<string>`
Generates response with validation retry.

**Parameters:**
- `system: string` - System prompt
- `user: string` - User message

**Returns:** Validated response text

**Behavior:**
1. Calls LLM with system/user
2. Validates response via `validateResponse`
3. Retries up to 2 times if too short
4. Returns "hmm, let me think on that" as fallback

### `handleAgentMessage(msg: NormalizedMessage): Promise<void>`
Main message handler for agent chat.

**Parameters:**
- `msg: NormalizedMessage` - Incoming normalized message

**Behavior:**
1. Logs incoming message to agent_log
2. Detects image attachment → sets intent to "photo"
3. Otherwise classifies intent from text
4. Assembles context based on intent
5. Builds system prompt with temporal voice
6. If photo intent: analyzes image, prepends to user content
7. If draft intent: uses `validateDraft` on response
8. Otherwise uses `validateResponse`
9. Sends response as voice note via `sendWithVoice`
10. Logs outgoing message to agent_log

**Error Handling:**
- Catches all errors
- Logs to console with `[agent/handler]` prefix
- Sends fallback text: "something went wrong — try again in a sec"

## Response Flow
```
Message → Classify Intent → Assemble Context → Build Prompt
    ↓
Generate Response (LLM)
    ↓
Validate Response (personality)
    ↓
Send Voice (TTS + SDK)
    ↓
Log Interaction
```

## Usage Example
```typescript
import { handleAgentMessage } from './agent/handler';
import { NormalizedMessage } from '../imessage/sdk';

const msg: NormalizedMessage = {
  id: '123',
  text: 'what tasks do I have?',
  sender: 'user',
  chatId: 'agent-chat',
  isFromMe: false,
  isGroupChat: false,
  timestamp: Date.now(),
  attachments: []
};

await handleAgentMessage(msg);
// Response sent as voice note to agent chat
```
