import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';

let _db: Database.Database | null = null;

export function getDb() {
  if (!_db) {
    mkdirSync("data", { recursive: true });
    _db = new Database('data/db.sqlite');
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 5000');
    createTables(_db);
  }
  return _db;
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      direction TEXT CHECK(direction IN ('in', 'out')),
      has_attachment INTEGER DEFAULT 0,
      attachment_type TEXT,
      attachment_path TEXT,
      processed INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_ref TEXT,
      description TEXT NOT NULL,
      assigned_by TEXT,
      deadline TEXT,
      urgency INTEGER DEFAULT 3 CHECK(urgency BETWEEN 1 AND 5),
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'done', 'dismissed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      last_contact TEXT,
      context_notes TEXT,
      open_tasks INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS agent_log (
      id TEXT PRIMARY KEY,
      direction TEXT CHECK(direction IN ('in', 'out')),
      content TEXT,
      message_type TEXT DEFAULT 'text',
      audio_path TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proactive_log (
      id TEXT PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export const storeMessage = (msg: any) => {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO messages (id, chat_id, sender, content, direction, has_attachment, attachment_type, attachment_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    randomUUID(),
    msg.chat_id,
    msg.sender,
    msg.content,
    msg.direction,
    msg.has_attachment ? 1 : 0,
    msg.attachment_type,
    msg.attachment_path
  );
};

export const getUnprocessedMessages = (limit = 50) => getDb().prepare('SELECT * FROM messages WHERE processed = 0 ORDER BY timestamp ASC LIMIT ?').all(limit);

export const markProcessed = (ids: string[]) => {
  const db = getDb();
  const stmt = db.prepare('UPDATE messages SET processed = 1 WHERE id = ?');
  db.transaction(() => ids.forEach(id => stmt.run(id)))();
};

export const storeTasks = (tasks: any[]) => {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO tasks (id, source, source_ref, description, assigned_by, deadline, urgency) VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => tasks.forEach(t => stmt.run(randomUUID(), t.source, t.source_ref, t.description, t.assigned_by, t.deadline, t.urgency)))();
};

export const getTaskQueue = () => getDb().prepare("SELECT * FROM tasks WHERE status = 'open' ORDER BY urgency DESC, created_at ASC").all();

export const logAgent = (entry: any) => {
  getDb().prepare('INSERT INTO agent_log (id, direction, content, message_type, audio_path) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), entry.direction, entry.content, entry.message_type, entry.audio_path);
};

export const logProactive = (trigger_type: string, content_hash: string) => {
  getDb().prepare('INSERT INTO proactive_log (id, trigger_type, content_hash) VALUES (?, ?, ?)').run(randomUUID(), trigger_type, content_hash);
};

export const countRecentProactive = (minutes: number) => {
  return getDb().prepare(`SELECT COUNT(*) as count FROM proactive_log WHERE sent_at > datetime('now', '-${minutes} minutes')`).get() as { count: number };
};

export const wasRecentlySent = (hash: string, minutes: number) => {
  const result = getDb().prepare(`SELECT 1 FROM proactive_log WHERE content_hash = ? AND sent_at > datetime('now', '-${minutes} minutes')`).get(hash);
  return !!result;
};

export const getRecentConversation = (limit = 8) => getDb().prepare('SELECT * FROM agent_log WHERE content IS NOT NULL ORDER BY timestamp DESC LIMIT ?').all(limit);

export const getPersonDossier = (name: string) => {
  const db = getDb();
  const person = db.prepare('SELECT * FROM people WHERE name LIKE ?').get(`%${name}%`);
  if (!person) return null;

  const messages = db.prepare('SELECT * FROM messages WHERE sender = ? ORDER BY timestamp DESC LIMIT 10').all(person.name);
  const tasks = db.prepare("SELECT * FROM tasks WHERE description LIKE ? AND status = 'open'").all(`%${person.name}%`);
  return { ...person, messages, tasks };
};

export const getTriggerEngagement = (days = 7) => {
    const db = getDb();
    const query = `
        WITH SentTriggers AS (
            SELECT
                p.trigger_type,
                p.sent_at
            FROM proactive_log p
            WHERE p.sent_at >= datetime('now', ?)
        ),
        EngagedTriggers AS (
            SELECT
                st.trigger_type,
                MIN(m.timestamp) as engagement_time
            FROM SentTriggers st
            JOIN messages m ON m.direction = 'in' AND m.timestamp > st.sent_at
            WHERE julianday(m.timestamp) - julianday(st.sent_at) < (30.0 / (24 * 60)) -- 30 minutes
            GROUP BY st.trigger_type, st.sent_at
        )
        SELECT
            st.trigger_type,
            COUNT(st.sent_at) as total_sends,
            COUNT(et.engagement_time) as engaged,
            CAST(COUNT(et.engagement_time) AS REAL) / COUNT(st.sent_at) as engagement_rate
        FROM SentTriggers st
        LEFT JOIN EngagedTriggers et ON st.trigger_type = et.trigger_type AND st.sent_at = et.sent_at
        GROUP BY st.trigger_type;
    `;
    return db.prepare(query).all(`-${days} days`);
};
