import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const DATA_DIR =
  process.env.QUEUECTL_DATA_DIR || join(process.cwd(), ".queuectl");
const DB_FILE = process.env.QUEUECTL_DB || join(DATA_DIR, "queue.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
id TEXT PRIMARY KEY,
command TEXT NOT NULL,
state TEXT NOT NULL DEFAULT 'pending',
attempts INTEGER NOT NULL DEFAULT 0,
max_retries INTEGER NOT NULL DEFAULT 3,
run_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);


CREATE INDEX IF NOT EXISTS idx_jobs_state_runat ON jobs(state, run_at);


CREATE TABLE IF NOT EXISTS dlq (
id TEXT PRIMARY KEY,
command TEXT NOT NULL,
attempts INTEGER NOT NULL,
max_retries INTEGER NOT NULL,
failed_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
last_error TEXT
);


CREATE TABLE IF NOT EXISTS config (
key TEXT PRIMARY KEY,
value TEXT NOT NULL
);
`);

export { DATA_DIR, DB_FILE };



