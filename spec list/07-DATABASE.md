# Database Module Specification

## Overview
The database module (`src/memory/db.ts`) provides SQLite persistence using `better-sqlite3` with WAL mode for concurrent access.

## Dependencies
- `better-sqlite3` - Synchronous SQLite driver
- `crypto` - For UUID generation
- Node.js built-in: `fs`

## Database Location
- Path: `data/nudge.db`
- Created with `recursive: true` in `data/` directory

## Configuration
```typescript
_db.pragma("journal_mode = WAL");  // Write-Ahead Logging
_db.pragma("busy_timeout = 5000"); // Wait up to 5s for locks
```

## Schema

### Table: `messages`
Stores incoming and outgoing iMessages.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `chat_id` | TEXT | NOT NULL |
| `sender` | TEXT | NOT NULL |
| `content` | TEXT | |
| `timestamp` | TEXT | DEFAULT `datetime('now')` |
| `direction` | TEXT | NOT NULL, CHECK(`in`,`out`) |
| `has_attachment` | INTEGER | DEFAULT 0 |
| `attachment_type` | TEXT | |
| `attachment_path` | TEXT | |
| `processed` | INTEGER | DEFAULT 0 |

### Table: `tasks`
Stores extracted tasks and commitments.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `source` | TEXT | NOT NULL |
| `source_ref` | TEXT | |
| `description` | TEXT | NOT NULL |
| `assigned_by` | TEXT | |
| `deadline` | TEXT | |
| `urgency` | INTEGER | DEFAULT 3, CHECK(1-5) |
| `status` | TEXT | DEFAULT `open`, CHECK(`open`,`done`,`dismissed`) |
| `created_at` | TEXT | DEFAULT `datetime('now')` |
| `updated_at` | TEXT | DEFAULT `datetime('now')` |

### Table: `people`
Stores contacts and relationship context.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `phone` | TEXT | |
| `last_contact` | TEXT | |
| `context_notes` | TEXT | |
| `open_tasks` | INTEGER | DEFAULT 0 |

### Table: `agent_log`
Audit log of agent interactions.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `direction` | TEXT | NOT NULL, CHECK(`in`,`out`) |
| `content` | TEXT | |
| `message_type` | TEXT | DEFAULT `text` |
| `audio_path` | TEXT | |
| `timestamp` | TEXT | DEFAULT `datetime('now')` |

### Table: `proactive_log`
Tracks proactive message sends for deduplication.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `trigger_type` | TEXT | NOT NULL |
| `content_hash` | TEXT | NOT NULL |
| `sent_at` | TEXT | DEFAULT `datetime('now')` |

## Public API

### `getDb(): Database.Database`
Returns the singleton database instance. Initializes on first call.

### `storeMessage(msg: MessageInput): void`
Inserts a message if not already present (INSERT OR IGNORE).

**MessageInput:**
```typescript
{
  id?: string;                    // Auto-generated if not provided
  chat_id: string;
  sender: string;
  content?: string;
  direction: "in" | "out";
  has_attachment?: boolean;
  attachment_type?: string;
  attachment_path?: string;
}
```

### `getUnprocessedMessages(limit?: number): Message[]`
Returns unprocessed messages ordered by timestamp.

### `markProcessed(ids: string[]): void`
Marks messages as processed using batch transaction.

### `storeTasks(tasks: TaskInput[]): void`
Inserts multiple tasks (INSERT OR IGNORE).

**TaskInput:**
```typescript
{
  source: string;
  description: string;
  source_ref?: string;
  assigned_by?: string;
  deadline?: string;
  urgency?: number;  // 1-5, default 3
}
```

### `getTaskQueue(): Task[]`
Returns open tasks ordered by urgency DESC, then created_at ASC.

### `logAgent(entry: AgentLogEntry): void`
Records agent interaction.

**AgentLogEntry:**
```typescript
{
  direction: "in" | "out";
  content?: string;
  message_type?: string;
  audio_path?: string;
}
```

### `logProactive(triggerType: string, contentHash: string): void`
Logs proactive message for deduplication.

### `countRecentProactive(minutes: number): number`
Counts proactive messages in the last N minutes.

### `wasRecentlySent(hash: string, minutes: number): boolean`
Checks if content hash was sent within time window.

### `getRecentConversation(limit?: number): ConversationEntry[]`
Returns recent agent conversation entries.

### `getPersonDossier(name: string): PersonDossier`
Returns person info, messages, and tasks matching name.

### `getTriggerEngagement(days?: number): EngagementStats[]`
Returns engagement rates by trigger type over N days.

## Performance Considerations
- Uses WAL mode for concurrent reads during writes
- Transactions for batch operations
- Prepared statements cached by driver
- LRU-style cleanup for deduplication sets (max 200)
