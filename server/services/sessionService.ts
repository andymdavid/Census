import db from '../db';

const insertSession = db.prepare(
  'INSERT INTO sessions (id, pubkey, created_at, expires_at) VALUES (?, ?, ?, ?)'
);
const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
const selectSession = db.prepare(
  'SELECT id, pubkey, created_at, expires_at FROM sessions WHERE id = ?'
);

export interface SessionRecord {
  id: string;
  pubkey: string | null;
  created_at: number;
  expires_at: number;
}

export const getSessionTtlSeconds = () => {
  const raw = process.env.SESSION_TTL_SECONDS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24;
};

export const createSession = (pubkey: string | null) => {
  const now = Date.now();
  const ttlSeconds = getSessionTtlSeconds();
  const expiresAt = now + ttlSeconds * 1000;
  const id = crypto.randomUUID();

  insertSession.run(id, pubkey, now, expiresAt);

  return { id, expiresAt, ttlSeconds };
};

export const clearSession = (id: string) => {
  deleteSession.run(id);
};

export const getSession = (id: string) => {
  const row = selectSession.get(id) as SessionRecord | undefined;
  if (!row) return null;
  return row;
};

export const buildSessionCookie = (sessionId: string, ttlSeconds: number) => {
  return `session_id=${sessionId}; Max-Age=${ttlSeconds}; Path=/; HttpOnly; SameSite=Lax`;
};

export const buildSessionClearCookie = () => {
  return 'session_id=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
};

export const getCookie = (request: Request, name: string) => {
  const header = request.headers.get('cookie');
  if (!header) return undefined;

  const cookies = header.split(';').map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }

  return undefined;
};
