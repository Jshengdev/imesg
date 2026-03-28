# Composio Integration Specification

## Overview
The Composio module provides integration layer for third-party services.

## Dependencies
- `composio-core` - Composio SDK
- Internal: `config` from `../config`

## Architecture
- Singleton pattern for Composio client
- Mock mode when API key unavailable

## Public API

### `ensureInit(): void`
Initializes Composio client. Idempotent.

### `isMockMode(): boolean`
Returns whether in mock mode.

### `getEntity(userId?): ComposioEntity`
Gets entity for executing actions.

### `findArrayInResponse(data, keys, depth?): any[]`
Searches nested object for arrays.

### `executeWithFallback(strategies, searchKeys, label): Promise<any[]>`
Executes action with fallback strategies.

**Behavior:**
1. If mock mode, return empty array
2. For each strategy:
   a. Execute action
   b. Search response for array
   c. Return if found
3. Return empty array if all fail

## Mock Mode
- `isMockMode()` returns true
- `getEntity()` throws
- `executeWithFallback()` returns empty array
