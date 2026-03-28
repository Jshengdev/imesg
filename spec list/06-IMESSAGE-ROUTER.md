# iMessage Router Module Specification

## Overview
The iMessage router determines routing destination for incoming messages based on chat context.

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

| Destination | Condition |
|-------------|-----------|
| `agent` | Agent chat AND not from me |
| `ignore` | Agent chat AND from me |
| `listener` | Any other chat |

## Design Rationale
1. **Dedicated Agent Thread**: Separate chat avoids cluttering conversations
2. **Ignore Own Messages**: Prevents infinite loops
3. **Simple Routing**: Fast O(1) decision
