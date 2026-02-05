import {
  buildSessionClearCookie,
  buildSessionCookie,
  clearSession,
  createSession,
  getCookie,
  getSessionFromRequest,
} from '../services/sessionService';
import {
  consumeNonce,
  createNonce,
  extractChallenge,
  isValidAuthEvent,
  NostrAuthEvent,
} from '../services/authService';
import { ensureDefaultWorkspace } from '../services/workspaceService';
import { nip19 } from 'nostr-tools';

const jsonResponse = (data: unknown, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
};

const readJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

export const handleNonce = async () => {
  const nonce = createNonce();
  return jsonResponse({ challenge: nonce.challenge, expiresAt: nonce.expiresAt });
};

export const handleVerify = async (request: Request) => {
  const payload = await readJson<{ event?: NostrAuthEvent }>(request);
  const event = payload?.event;
  if (!event) {
    return jsonResponse({ error: 'Missing event.' }, { status: 400 });
  }

  const challenge = extractChallenge(event);
  if (!challenge) {
    return jsonResponse({ error: 'Invalid challenge.' }, { status: 400 });
  }

  const nonce = consumeNonce(challenge);
  if (!nonce) {
    return jsonResponse({ error: 'Invalid or expired challenge.' }, { status: 400 });
  }

  if (!isValidAuthEvent(event, challenge)) {
    return jsonResponse({ error: 'Invalid event.' }, { status: 400 });
  }

  const session = createSession(event.pubkey ?? null);
  if (event.pubkey) {
    ensureDefaultWorkspace(event.pubkey);
  }

  return jsonResponse(
    {
      ok: true,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    },
    {
      headers: {
        'Set-Cookie': buildSessionCookie(session.id, session.ttlSeconds),
      },
    }
  );
};

export const handleLogout = async (request: Request) => {
  const sessionId = getCookie(request, 'session_id');
  if (sessionId) {
    clearSession(sessionId);
  }

  return jsonResponse(
    { ok: true },
    {
      headers: {
        'Set-Cookie': buildSessionClearCookie(),
      },
    }
  );
};

export const handleAuthRoutes = async (request: Request) => {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    const npub = session.pubkey ? nip19.npubEncode(session.pubkey) : null;
    return jsonResponse({ pubkey: session.pubkey, npub });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/nonce') {
    return handleNonce();
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/verify') {
    return handleVerify(request);
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    return handleLogout(request);
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
