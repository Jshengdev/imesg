import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { v4 as uuidv4 } from "uuid";

describe("Database Tests", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT,
        timestamp TEXT NOT NULL,
        direction TEXT NOT NULL,
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
        assigned_to TEXT,
        deadline TEXT,
        urgency INTEGER DEFAULT 3,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        last_contact TEXT,
        relationship_context TEXT,
        open_tasks INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS agent_log (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT,
        audio_path TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS proactive_log (
        id TEXT PRIMARY KEY,
        trigger_type TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        sent_at TEXT NOT NULL
      );
    `);
  });

  test("should create messages table", () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    expect(result).toBeDefined();
  });

  test("should insert and retrieve a message", () => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, chat_id, sender, content, timestamp, direction, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, "chat-123", "sender-456", "Hello world", now, "inbound", 0);

    const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as any;
    expect(msg).toBeDefined();
    expect(msg.content).toBe("Hello world");
    expect(msg.direction).toBe("inbound");
    expect(msg.processed).toBe(0);
  });

  test("should insert and retrieve a task", () => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, source, description, assigned_by, urgency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, "imessage", "Review PR", "Sarah", 4, "pending", now, now);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    expect(task).toBeDefined();
    expect(task.description).toBe("Review PR");
    expect(task.assigned_by).toBe("Sarah");
    expect(task.urgency).toBe(4);
    expect(task.status).toBe("pending");
  });

  test("should insert and retrieve a person", () => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO people (id, name, email, open_tasks, last_contact)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, "Sarah", "sarah@example.com", 3, now);

    const person = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as any;
    expect(person).toBeDefined();
    expect(person.name).toBe("Sarah");
    expect(person.email).toBe("sarah@example.com");
    expect(person.open_tasks).toBe(3);
  });

  test("should update task status", () => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, source, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, "imessage", "Test task", "pending", now, now);

    db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?")
      .run("done", new Date().toISOString(), id);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    expect(task.status).toBe("done");
  });

  test("should increment person open tasks", () => {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO people (id, name, open_tasks)
      VALUES (?, ?, ?)
    `).run(id, "Test Person", 2);

    db.prepare("UPDATE people SET open_tasks = open_tasks + 1 WHERE id = ?").run(id);

    const person = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as any;
    expect(person.open_tasks).toBe(3);
  });

  test("should log proactive message", () => {
    const id = uuidv4();
    const hash = "abc123def456";
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO proactive_log (id, trigger_type, content_hash, sent_at)
      VALUES (?, ?, ?, ?)
    `).run(id, "morning_briefing", hash, now);

    const log = db.prepare("SELECT * FROM proactive_log WHERE id = ?").get(id) as any;
    expect(log).toBeDefined();
    expect(log.trigger_type).toBe("morning_briefing");
    expect(log.content_hash).toBe(hash);
  });

  test("should filter unprocessed messages", () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, chat_id, sender, content, timestamp, direction, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), "chat-1", "sender-1", "Processed", now, "inbound", 1);

    db.prepare(`
      INSERT INTO messages (id, chat_id, sender, content, timestamp, direction, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), "chat-2", "sender-2", "Unprocessed", now, "inbound", 0);

    const unprocessed = db.prepare("SELECT COUNT(*) as count FROM messages WHERE processed = 0").get() as any;
    expect(unprocessed.count).toBe(1);
  });

  test("should get pending tasks ordered by urgency", () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, source, description, urgency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), "imessage", "Low priority", 1, "pending", now, now);

    db.prepare(`
      INSERT INTO tasks (id, source, description, urgency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), "imessage", "High priority", 5, "pending", now, now);

    db.prepare(`
      INSERT INTO tasks (id, source, description, urgency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), "imessage", "Medium priority", 3, "pending", now, now);

    const tasks = db.prepare(
      "SELECT * FROM tasks WHERE status = 'pending' ORDER BY urgency DESC"
    ).all() as any[];

    expect(tasks.length).toBe(3);
    expect(tasks[0].urgency).toBe(5);
    expect(tasks[1].urgency).toBe(3);
    expect(tasks[2].urgency).toBe(1);
  });
});
