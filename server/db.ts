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

export default db;
