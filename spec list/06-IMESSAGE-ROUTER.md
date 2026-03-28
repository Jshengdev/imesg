# iMessage Router Module Specification

## Overview
The iMessage router (`src/imessage/router.ts`) determines the routing destination for incoming messages based on chat context.

## Dependencies
- Internal: `config` from `../config`
- Internal: `NormalizedMessage` from `./sdk`

## Routing Logic

### `routeMessage(msg: NormalizedMessage): 'agent' | 'listener' | 'ignore'`

**Decision Tree:**

```
Is chatId === AGENT_CHAT_IDENTIFIER?
├── YES → Is message from me?
│       ├── YES → return 'ignore'
│       └── NO  → return 'agent'
└── NO  → return 'listener'
```

## Routing Destinations

| Destination | Condition | Description |
|-------------|-----------|-------------|
| `agent` | Agent chat AND not from me | User message to agent - process as agent request |
| `ignore` | Agent chat AND from me | My own agent message - don't reprocess |
| `listener` | Any other chat | Regular conversation - extract tasks/intents |

## Configuration Dependency
- `config.AGENT_CHAT_IDENTIFIER` - The chat ID designated for agent communication

## Usage Example
```typescript
import { routeMessage } from './imessage/router';
import { handleAgentMessage } from '../agent/handler';
import { listenerProcess } from '../listener/watcher';

const destination = routeMessage(normalizedMessage);

switch (destination) {
  case 'agent':
    await handleAgentMessage(normalizedMessage);
    break;
  case 'listener':
    await listenerProcess(normalizedMessage);
    break;
  case 'ignore':
    // Do nothing - our own message
    break;
}
```

## Design Rationale
1. **Dedicated Agent Thread**: Agent communicates in a separate chat to avoid cluttering personal conversations
2. **Ignore Own Messages**: Prevents infinite loops when agent sends to same chat
3. **Simple Routing**: Fast O(1) decision based on chat ID comparison
