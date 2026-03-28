import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync("data", { recursive: true });
  _db = new Database("data/nudge.db");
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, chat_id TEXT,
  name TEXT, active INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, user_id TEXT, chat_id TEXT NOT NULL, sender TEXT NOT NULL, content TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  has_attachment INTEGER DEFAULT 0, attachment_type TEXT, attachment_path TEXT,
  processed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, user_id TEXT, source TEXT NOT NULL, source_ref TEXT, description TEXT NOT NULL,
  assigned_by TEXT, deadline TEXT,
  urgency INTEGER DEFAULT 3 CHECK(urgency BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, phone TEXT, last_contact TEXT,
  context_notes TEXT, open_tasks INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS agent_log (
  id TEXT PRIMARY KEY, user_id TEXT, direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  content TEXT, message_type TEXT DEFAULT 'text', audio_path TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS proactive_log (
  id TEXT PRIMARY KEY, user_id TEXT, trigger_type TEXT NOT NULL, content_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  return _db;
}

const uid = () => randomUUID();

// --- User management ---

export function getActiveUsers(): { id: string; phone: string; chat_id: string; name: string }[] {
  return getDb().prepare(`SELECT * FROM users WHERE active=1`).all() as any[];
}

export function getUserByPhone(phone: string): any | null {
  return getDb().prepare(`SELECT * FROM users WHERE phone=@phone`).get({ phone }) ?? null;
}

export function getUserByChatId(chatId: string): any | null {
  // Match by exact chat_id, or phone contained in chatId (handles iMessage;-;+1xxx)
  const db = getDb();
  let user = db.prepare(`SELECT * FROM users WHERE chat_id=@chatId`).get({ chatId });
  if (!user) {
    const users = db.prepare(`SELECT * FROM users WHERE active=1`).all() as any[];
    user = users.find((u: any) => chatId.includes(u.phone)) ?? null;
  }
  return user ?? null;
}

export function registerUser(phone: string, chatId: string, name?: string): string {
  const id = uid();
  getDb().prepare(`INSERT OR IGNORE INTO users (id,phone,chat_id,name) VALUES (@id,@phone,@chat_id,@name)`)
    .run({ id, phone, chat_id: chatId, name: name ?? phone });
  const user = getUserByPhone(phone);
  console.log(`[db] registered user: ${phone} → ${user?.id}`);
  return user?.id ?? id;
}

// --- Scoped queries (all take userId) ---

export function storeMessage(msg: {
  id?: string; user_id?: string; chat_id: string; sender: string; content?: string;
  direction: "in" | "out"; has_attachment?: boolean;
  attachment_type?: string; attachment_path?: string;
}): void {
  getDb().prepare(`INSERT OR IGNORE INTO messages (id,user_id,chat_id,sender,content,direction,has_attachment,attachment_type,attachment_path)
    VALUES (@id,@user_id,@chat_id,@sender,@content,@direction,@has_attachment,@attachment_type,@attachment_path)`
  ).run({ id: msg.id ?? uid(), user_id: msg.user_id ?? null, chat_id: msg.chat_id, sender: msg.sender, content: msg.content ?? null,
    direction: msg.direction, has_attachment: msg.has_attachment ? 1 : 0,
    attachment_type: msg.attachment_type ?? null, attachment_path: msg.attachment_path ?? null });
}

export function getUnprocessedMessages(limit = 50, userId?: string): any[] {
  if (userId) {
    return getDb().prepare(`SELECT * FROM messages WHERE processed=0 AND user_id=@userId ORDER BY timestamp ASC LIMIT @limit`).all({ userId, limit });
  }
  return getDb().prepare(`SELECT * FROM messages WHERE processed=0 ORDER BY timestamp ASC LIMIT @limit`).all({ limit });
}

export function markProcessed(ids: string[]): void {
  if (!ids.length) return;
  const db = getDb();
  const stmt = db.prepare(`UPDATE messages SET processed=1 WHERE id=@id`);
  db.transaction((ids: string[]) => { for (const id of ids) stmt.run({ id }); })(ids);
}

export function storeTasks(tasks: {
  source: string; description: string; source_ref?: string;
  assigned_by?: string; deadline?: string; urgency?: number;
}[], userId?: string): void {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO tasks (id,user_id,source,source_ref,description,assigned_by,deadline,urgency)
    VALUES (@id,@user_id,@source,@source_ref,@description,@assigned_by,@deadline,@urgency)`);
  db.transaction((tasks: any[]) => {
    for (const t of tasks) stmt.run({ id: uid(), user_id: userId ?? null, source: t.source, source_ref: t.source_ref ?? null,
      description: t.description, assigned_by: t.assigned_by ?? null, deadline: t.deadline ?? null, urgency: t.urgency ?? 3 });
  })(tasks);
}

export function getTaskQueue(userId?: string): any[] {
  if (userId) {
    return getDb().prepare(`SELECT * FROM tasks WHERE status='open' AND user_id=@userId ORDER BY urgency DESC, created_at ASC`).all({ userId });
  }
  return getDb().prepare(`SELECT * FROM tasks WHERE status='open' ORDER BY urgency DESC, created_at ASC`).all();
}

export function logAgent(entry: { direction: "in"|"out"; content?: string; message_type?: string; audio_path?: string }, userId?: string): void {
  getDb().prepare(`INSERT INTO agent_log (id,user_id,direction,content,message_type,audio_path) VALUES (@id,@user_id,@direction,@content,@message_type,@audio_path)`)
    .run({ id: uid(), user_id: userId ?? null, direction: entry.direction, content: entry.content ?? null, message_type: entry.message_type ?? "text", audio_path: entry.audio_path ?? null });
}

export function logProactive(trigger_type: string, content_hash: string, userId?: string): void {
  getDb().prepare(`INSERT INTO proactive_log (id,user_id,trigger_type,content_hash) VALUES (@id,@user_id,@trigger_type,@content_hash)`)
    .run({ id: uid(), user_id: userId ?? null, trigger_type, content_hash });
}

export function countRecentProactive(minutes: number, userId?: string): number {
  const q = userId
    ? `SELECT COUNT(*) as cnt FROM proactive_log WHERE user_id=@userId AND sent_at > datetime('now', @offset)`
    : `SELECT COUNT(*) as cnt FROM proactive_log WHERE sent_at > datetime('now', @offset)`;
  const row = getDb().prepare(q).get({ userId, offset: `-${minutes} minutes` }) as any;
  return row?.cnt ?? 0;
}

export function wasRecentlySent(hash: string, minutes: number, userId?: string): boolean {
  const q = userId
    ? `SELECT 1 FROM proactive_log WHERE content_hash=@hash AND user_id=@userId AND sent_at > datetime('now', @offset) LIMIT 1`
    : `SELECT 1 FROM proactive_log WHERE content_hash=@hash AND sent_at > datetime('now', @offset) LIMIT 1`;
  return !!getDb().prepare(q).get({ hash, userId, offset: `-${minutes} minutes` });
}

export function getRecentConversation(limit = 8, userId?: string): { direction: string; content: string; timestamp: string }[] {
  const q = userId
    ? `SELECT direction, content, timestamp FROM agent_log WHERE user_id=@userId AND content IS NOT NULL AND content != '' ORDER BY timestamp DESC LIMIT @limit`
    : `SELECT direction, content, timestamp FROM agent_log WHERE content IS NOT NULL AND content != '' ORDER BY timestamp DESC LIMIT @limit`;
  return getDb().prepare(q).all({ userId, limit }) as any[];
}

export function getPersonDossier(name: string, userId?: string): { person: any | null; messages: any[]; tasks: any[] } {
  const db = getDb();
  const namePattern = `%${name}%`;
  const person = userId
    ? db.prepare(`SELECT * FROM people WHERE user_id=@userId AND name LIKE @p LIMIT 1`).get({ userId, p: namePattern }) ?? null
    : db.prepare(`SELECT * FROM people WHERE name LIKE @p LIMIT 1`).get({ p: namePattern }) ?? null;
  const messages = userId
    ? db.prepare(`SELECT sender, content, timestamp FROM messages WHERE user_id=@userId AND sender LIKE @p ORDER BY timestamp DESC LIMIT 10`).all({ userId, p: namePattern })
    : db.prepare(`SELECT sender, content, timestamp FROM messages WHERE sender LIKE @p ORDER BY timestamp DESC LIMIT 10`).all({ p: namePattern });
  const tasks = userId
    ? db.prepare(`SELECT description, urgency, deadline, status FROM tasks WHERE user_id=@userId AND assigned_by LIKE @p ORDER BY urgency DESC LIMIT 5`).all({ userId, p: namePattern })
    : db.prepare(`SELECT description, urgency, deadline, status FROM tasks WHERE assigned_by LIKE @p ORDER BY urgency DESC LIMIT 5`).all({ p: namePattern });
  return { person, messages, tasks };
}

export function getTriggerEngagement(days = 7, userId?: string): { trigger_type: string; total: number; engaged: number; rate: number }[] {
  const where = userId ? `AND p.user_id = '${userId}'` : "";
  const rows = getDb().prepare(`
    SELECT p.trigger_type, COUNT(*) as total,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM agent_log a WHERE a.direction='in'
        ${userId ? `AND a.user_id = '${userId}'` : ""}
        AND a.timestamp > p.sent_at AND a.timestamp <= datetime(p.sent_at, '+30 minutes')
      ) THEN 1 ELSE 0 END) as engaged
    FROM proactive_log p WHERE p.sent_at > datetime('now', @offset) ${where}
    GROUP BY p.trigger_type
  `).all({ offset: `-${days} days` }) as any[];
  return rows.map(r => ({ ...r, rate: r.total > 0 ? r.engaged / r.total : 0 }));
}

export function resetDatabase(): void {
  const db = getDb();
  db.exec(`DELETE FROM messages`);
  db.exec(`DELETE FROM tasks`);
  db.exec(`DELETE FROM people`);
  db.exec(`DELETE FROM agent_log`);
  db.exec(`DELETE FROM proactive_log`);
  db.exec(`DELETE FROM users`);
  console.log("[db] all tables cleared");
}
