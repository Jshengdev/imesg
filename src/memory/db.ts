import Database from 'better-sqlite3';

const db = new Database('imesg.db');

const createMessagesTable = `
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createTasksTable = `
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    due_date DATETIME,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);
`;

const createMessagesIndex = `CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);`;
const createTasksIndex = `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`;

db.exec(createMessagesTable);
db.exec(createTasksTable);
db.exec(createMessagesIndex);
db.exec(createTasksIndex);

console.log('Database initialized successfully');

export default db;
