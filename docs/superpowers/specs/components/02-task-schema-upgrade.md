# Component: Task Schema Upgrade (`src/memory/db.ts`)

## Purpose
Add new columns to tasks table for ranking: estimated_minutes, effort_level, environment, depends_on, deadline_source, deadline_confidence, completed_at.

## Implementation

### Schema migration
Add columns with ALTER TABLE (safe for SQLite — won't fail if column exists):

```typescript
// After CREATE TABLE IF NOT EXISTS tasks ...
const taskMigrations = [
  "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER",
  "ALTER TABLE tasks ADD COLUMN effort_level TEXT DEFAULT 'focused'",
  "ALTER TABLE tasks ADD COLUMN environment TEXT DEFAULT 'anywhere'",
  "ALTER TABLE tasks ADD COLUMN depends_on TEXT",
  "ALTER TABLE tasks ADD COLUMN deadline_source TEXT",
  "ALTER TABLE tasks ADD COLUMN deadline_confidence TEXT DEFAULT 'inferred'",
  "ALTER TABLE tasks ADD COLUMN completed_at TEXT",
];
for (const sql of taskMigrations) {
  try { db.exec(sql); } catch {} // Ignore "column already exists"
}
```

### New queries

```typescript
export function completeTask(taskId: string): boolean
// UPDATE tasks SET status='done', completed_at=datetime('now') WHERE id=@taskId

export function completeTaskByDescription(description: string, userId?: string): { found: boolean; taskId?: string }
// Fuzzy match: WHERE description LIKE '%{keyword}%' AND status='open'
// Used when user says "done with the analysis"

export function getTasksWithDetails(userId?: string): TaskWithDetails[]
// SELECT * with new columns, WHERE status='open', ORDER BY urgency DESC

export function getDependentTasks(taskId: string): any[]
// SELECT * FROM tasks WHERE depends_on LIKE '%{taskId}%' AND status='open'

export function storeTasks(tasks[], userId?)
// Update existing function to accept new fields
```

### storeTasks update
The existing `storeTasks` INSERT statement needs new columns in the INSERT:
```sql
INSERT OR IGNORE INTO tasks (id, user_id, source, source_ref, description, assigned_by, deadline, urgency, estimated_minutes, effort_level, environment, depends_on, deadline_source, deadline_confidence)
VALUES (...)
```

## Verification
- Create task with all new fields → query returns them
- `completeTaskByDescription("analysis")` matches "data analysis part" → marks done
- `getDependentTasks(id)` returns tasks blocked by completed task
- Schema migration runs cleanly on existing DB with data
