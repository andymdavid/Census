import { handleAuthRoutes } from './routes/auth';

const jsonResponse = (data: unknown, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
};

const handler = async (request: Request) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRoutes(request);
  }

  if (url.pathname === '/api/health') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};

const port = Number(process.env.PORT ?? 3001);

Bun.serve({
  port,
  fetch: handler,
});

console.log(`Bun server running on http://localhost:${port}`);
