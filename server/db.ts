import { Database } from 'bun:sqlite';

const db = new Database('server/do-the-other-stuff.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    pubkey TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL DEFAULT ''
  );
`);

try {
  db.exec(\"ALTER TABLE forms ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';\");
} catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    score INTEGER NOT NULL,
    meta_json TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_nonces (
    challenge TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    response_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    created_at INTEGER NOT NULL
  );
`);

export default db;
