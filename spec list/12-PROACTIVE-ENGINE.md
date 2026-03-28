# Proactive Engine Specification

## Overview
The proactive engine (`src/agent/proactive/engine.ts`) manages sending proactive messages to the user based on triggers while respecting rate limits and engagement metrics.

## Dependencies
- Internal: `config` from `../../config`
- Internal: `countRecentProactive`, `wasRecentlySent`, `logProactive`, `getTriggerEngagement` from `../../memory/db`
- Internal: `generate` from `../../minimax/llm`
- Internal: `textToSpeech` from `../../minimax/tts`
- Internal: `sendWithVoice` from `../../imessage/sdk`
- Internal: `SYSTEM_PROMPT`, `validateResponse`, `getTemporalVoice` from `../personality`
- Internal: `assembleContext` from `../context`
- Node.js: `crypto` (MD5 hashing)

## Configuration

| Setting | Source | Default |
|---------|--------|---------|
| `MAX_PROACTIVE_PER_HOUR` | `config` | 3 |
| `QUIET_HOURS_START` | `config` | 23 |
| `QUIET_HOURS_END` | `config` | 7 |

## Derived Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CACHE_TTL` | 30 minutes | Engagement cache time-to-live |
| `DEDUP_TTL` | 48 hours | Content deduplication window |

## Engagement Cache
In-memory Map storing trigger engagement rates:
```typescript
Map<triggerType, { rate: number; samples: number; ts: number }>
```

## Public API

### `isQuietHours(): boolean`
Checks if current time is within quiet hours.

**Returns:** `true` if between `QUIET_HOURS_START` and `QUIET_HOURS_END`

**Note:** Handles overnight quiet hours (e.g., 23:00 to 07:00)

### `shouldDampen(triggerType: string): boolean`
Determines if trigger should be suppressed based on engagement.

**Parameters:**
- `triggerType: string` - Type of trigger

**Returns:** `true` if should suppress (low engagement + random factor)

**Logic:**
1. Check cache for recent engagement data
2. If cache hit with 5+ samples and rate < 15%: 80% chance dampen
3. Query `getTriggerEngagement(7)` for historical data
4. If 5+ sends with rate < 15%: 80% chance dampen
5. Otherwise don't dampen

### `checkGates(content: string): string | null`
Validates all gate conditions for sending.

**Parameters:**
- `content: string` - Message content

**Returns:** MD5 hash if passes all gates, `null` if should not send

**Gates (all must pass):**
1. Not in quiet hours
2. Less than `MAX_PROACTIVE_PER_HOUR` sent in last hour
3. Content not sent within last 48 hours

### `sendProactive(triggerType: string, prompt: string): Promise<void>`
Sends a proactive message.

**Parameters:**
- `triggerType: string` - Type of trigger for logging
- `prompt: string` - User-facing prompt/question

**Behavior:**
1. If `shouldDampen(triggerType)`: log and return early
2. Assemble context via `assembleContext()`
3. Build system prompt with context and temporal voice
4. Generate response via LLM
5. Validate response via `validateResponse`
6. Check gates via `checkGates(response)`
7. If hash is null: don't send (dedup)
8. Send via `sendWithVoice(config.agentChatIdentifier, response, textToSpeech)`
9. Log proactive via `logProactive(triggerType, hash)`

## Dampening Algorithm
```
if cached_rate < 0.15 AND samples >= 5:
    return random() > 0.2  // 80% dampen chance
if historical_rate < 0.15 AND total_sends >= 5:
    return random() > 0.2  // 80% dampen chance
return false  // don't dampen
```

## Usage Example
```typescript
import { sendProactive, checkGates } from './engine';

// Triggered by scheduler
await sendProactive("morning_briefing", 
  "give a brief morning briefing with today's top priorities"
);
```
