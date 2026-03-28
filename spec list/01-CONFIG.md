# Configuration Module Specification

## Overview
The config module manages all environment variables and application settings with type-safe validation and sensible defaults.

## Dependencies
- `dotenv` - Environment variable loading

## Required Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `MINIMAX_API_KEY` | string | Yes | - | MiniMax API authentication key |
| `MINIMAX_API_HOST` | string | Yes | - | MiniMax API base URL |
| `COMPOSIO_API_KEY` | string | Yes | - | Composio API authentication key |
| `AGENT_CHAT_IDENTIFIER` | string | Yes | - | iMessage chat ID for agent communication |
| `QUIET_HOURS_START` | number | No | 23 | Start hour for quiet hours |
| `QUIET_HOURS_END` | number | No | 7 | End hour for quiet hours |
| `MAX_PROACTIVE_PER_HOUR` | number | No | 3 | Maximum proactive messages per hour |
| `MORNING_BRIEFING_HOUR` | number | No | 8 | Hour to send morning briefing |
| `EOD_REVIEW_HOUR` | number | No | 18 | Hour to send end-of-day review |
| `PRE_MEETING_MINUTES` | number | No | 15 | Minutes before meeting for prep reminder |

## Derived Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CALENDAR_POLL_MS` | 5 minutes | Polling interval for calendar |
| `EMAIL_POLL_MS` | 10 minutes | Polling interval for email |
| `MESSAGE_BATCH_MS` | 30 seconds | Batching interval for messages |

## Validation Rules
1. All required keys must be present at startup
2. Missing required keys throw Error with clear message
3. Numeric values parsed with fallback defaults

## Usage
```typescript
import { config } from './config';

const apiKey = config.MINIMAX_API_KEY;
const agentChat = config.AGENT_CHAT_IDENTIFIER;
```
