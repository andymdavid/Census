import db from '../db';
import { getEventHash, verifyEvent } from 'nostr-tools';

const insertNonce = db.prepare(
  'INSERT INTO auth_nonces (challenge, created_at, expires_at) VALUES (?, ?, ?)'
);
const selectNonce = db.prepare(
  'SELECT challenge, created_at, expires_at FROM auth_nonces WHERE challenge = ?'
);
const deleteNonce = db.prepare('DELETE FROM auth_nonces WHERE challenge = ?');

const NONCE_TTL_SECONDS = 60 * 5;

export const createNonce = () => {
  const now = Date.now();
  const challenge = crypto.randomUUID();
  const expiresAt = now + NONCE_TTL_SECONDS * 1000;
  insertNonce.run(challenge, now, expiresAt);
  return { challenge, expiresAt };
};

export const consumeNonce = (challenge: string) => {
  const row = selectNonce.get(challenge) as
    | { challenge: string; created_at: number; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteNonce.run(challenge);
    return null;
  }
  deleteNonce.run(challenge);
  return row;
};

export interface NostrAuthEvent {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: Array<string[]>;
  content?: string;
  sig?: string;
}

export const extractChallenge = (event: NostrAuthEvent) => {
  const tags = event.tags ?? [];
  const challengeTag = tags.find((tag) => tag[0] === 'challenge');
  return challengeTag?.[1] ?? null;
};

export const isValidAuthEvent = (event: NostrAuthEvent, challenge: string) => {
  if (!event.pubkey || event.pubkey.length !== 64) return false;
  if (!event.sig || event.sig.length !== 128) return false;
  if (typeof event.created_at !== 'number') return false;
  if (event.kind !== 22242) return false;
  const tagChallenge = extractChallenge(event);
  if (tagChallenge !== challenge) return false;

  if (!event.id) return false;
  const expectedId = getEventHash({
    kind: event.kind,
    created_at: event.created_at,
    tags: event.tags ?? [],
    content: event.content ?? '',
    pubkey: event.pubkey,
  });

  if (event.id !== expectedId) return false;

  return verifyEvent(event as Parameters<typeof verifyEvent>[0]);
};
