# Proactive Engine Specification

## Overview
The proactive engine manages sending proactive messages while respecting rate limits and engagement metrics.

## Dependencies
- Internal: `config` from `../../config`
- Internal: `countRecentProactive`, `wasRecentlySent`, `logProactive`, `getTriggerEngagement` from `../../memory/db`
- Internal: `generate` from `../../minimax/llm`
- Internal: `textToSpeech` from `../../minimax/tts`
- Internal: `sendWithVoice` from `../../imessage/sdk`
- Internal: `SYSTEM_PROMPT`, `validateResponse`, `getTemporalVoice` from `../personality`
- Internal: `assembleContext` from `../context`

## Configuration

| Setting | Default |
|---------|---------|
| `MAX_PROACTIVE_PER_HOUR` | 3 |
| `QUIET_HOURS_START` | 23 |
| `QUIET_HOURS_END` | 7 |

## Derived Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CACHE_TTL` | 30 min | Engagement cache TTL |
| `DEDUP_TTL` | 48 hours | Content dedup window |

## Public API

### `isQuietHours(): boolean`
Checks if current time is within quiet hours.

### `shouldDampen(triggerType: string): boolean`
Determines if trigger should be suppressed based on engagement.

**Logic:**
- If engagement rate < 15% with 5+ samples: 80% dampen chance

### `checkGates(content: string): string | null`
Validates all gate conditions.

**Gates:**
1. Not in quiet hours
2. Under rate limit
3. Content not recently sent

### `sendProactive(triggerType: string, prompt: string): Promise<void>`
Sends proactive message.

**Behavior:**
1. Check dampening
2. Assemble context
3. Generate response
4. Validate response
5. Check gates
6. Send via voice
7. Log to database
