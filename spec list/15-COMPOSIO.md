# Composio Integration Specification

## Overview
The Composio module (`src/integrations/composio.ts`) provides the integration layer for third-party services via Composio's action framework.

## Dependencies
- `composio-core` - Composio SDK
- Internal: `config` from `../config`

## Architecture

### Singleton Pattern
- Composio client initialized once via `ensureInit()`
- `initDone` flag prevents repeated initialization
- Mock mode when API key unavailable

### Entity Management
```typescript
getEntity(userId?: string) → ComposioEntity
```

## Public API

### `ensureInit(): void`
Initializes Composio client. Idempotent.

**Behavior:**
1. If already initialized, return
2. Attempt to create Composio client with API key
3. On failure: set `composio = null` (mock mode)

### `isMockMode(): boolean`
Returns whether Composio is in mock mode.

**Returns:** `true` if API key missing or init failed

### `getEntity(userId?: string): ComposioEntity`
Gets entity for executing actions.

**Throws:** `Error` if in mock mode

### `findArrayInResponse(data: unknown, keys: string[], depth?: number): any[]`
Searches nested object for arrays by key names.

**Parameters:**
- `data: unknown` - Response data to search
- `keys: string[]` - Keys to look for (e.g., `["items", "events", "data"]`)
- `depth?: number` - Max recursion depth (default: 5)

**Returns:** First matching array found, or empty array

**Search Strategy:**
1. If data is array with items, return it
2. If data is object, search for keys
3. Recursively search all object values
4. Stop at depth limit

### `executeWithFallback(strategies, searchKeys, label): Promise<any[]>`
Executes action with fallback strategies.

**Parameters:**
- `strategies: { actionName: string; params: Record<string, unknown> }[]`
- `searchKeys: string[]` - Keys to extract result arrays
- `label: string` - For logging (e.g., `"calendar"`, `"gmail"`)

**Returns:** Array from first successful strategy

**Behavior:**
1. If mock mode, return empty array
2. For each strategy:
   a. Execute action via entity
   b. Search response for array by keys
   c. If found, return it
3. Return empty array if all fail

**Usage Pattern:**
```typescript
const raw = await executeWithFallback([
  { actionName: "GOOGLECALENDAR_FIND_EVENT", params: {...} },
  { actionName: "GOOGLECALENDAR_EVENTS_LIST", params: {...} }
], ["items", "events", "data"], "calendar");
```

## Mock Mode
When Composio is unavailable:
- `isMockMode()` returns `true`
- `getEntity()` throws
- `executeWithFallback()` returns empty array
- Allows app to function without third-party integrations
