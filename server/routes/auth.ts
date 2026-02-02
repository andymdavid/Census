import {
  buildSessionClearCookie,
  buildSessionCookie,
  createSession,
  clearSession,
  getCookie,
} from '../services/sessionService';

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
  const challenge = crypto.randomUUID();
  return jsonResponse({ challenge });
};

export const handleVerify = async (request: Request) => {
  const payload = await readJson<{ pubkey?: string; signedEvent?: unknown }>(request);
  const pubkey = payload?.pubkey ?? null;
  const session = createSession(pubkey);

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
