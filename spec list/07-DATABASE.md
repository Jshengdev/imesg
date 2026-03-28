# Database Module Specification

## Overview
The database module provides SQLite persistence using `better-sqlite3` with WAL mode.

## Dependencies
- `better-sqlite3` - Synchronous SQLite driver
- `crypto` - For UUID generation

## Database Location
- Path: `data/nudge.db`

## Schema

### Table: `messages`
Stores incoming/outgoing iMessages.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `chat_id` | TEXT | NOT NULL |
| `sender` | TEXT | NOT NULL |
| `content` | TEXT | |
| `direction` | TEXT | CHECK(in,out) |
| `processed` | INTEGER | DEFAULT 0 |

### Table: `tasks`
Stores extracted tasks and commitments.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `source` | TEXT | NOT NULL |
| `description` | TEXT | NOT NULL |
| `urgency` | INTEGER | DEFAULT 3 |
| `status` | TEXT | DEFAULT open |

### Table: `people`
Stores contacts and context.

### Table: `agent_log`
Audit log of agent interactions.

### Table: `proactive_log`
Tracks proactive message sends.

## Public API

### `getDb(): Database`
Returns singleton database instance.

### `storeMessage(msg): void`
Inserts message (INSERT OR IGNORE).

### `getUnprocessedMessages(limit?): Message[]`
Returns unprocessed messages.

### `storeTasks(tasks): void`
Inserts multiple tasks.

### `getTaskQueue(): Task[]`
Returns open tasks ordered by urgency.

### `logAgent(entry): void`
Records agent interaction.

### `logProactive(triggerType, contentHash): void`
Logs proactive message.

### `wasRecentlySent(hash, minutes): boolean`
Checks content dedup.
