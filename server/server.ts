import type { Server } from 'bun';
import { handleAuthRoutes } from './routes/auth';
import { handleFormsRoutes } from './routes/forms';
import { handleResponsesRoutes } from './routes/responses';

const publicDir = `${process.cwd()}/public`;

const jsonResponse = (data: unknown, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
};

const handler = async (request: Request, server: Server) => {
  const url = new URL(request.url);

  if (url.pathname === '/ws' && server.upgrade(request)) {
    return;
  }

  if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRoutes(request);
  }

  if (url.pathname.includes('/responses')) {
    return handleResponsesRoutes(request);
  }

  if (url.pathname.startsWith('/api/forms')) {
    return handleFormsRoutes(request);
  }

  if (url.pathname === '/api/health') {
    return jsonResponse({ ok: true });
  }

  if (url.pathname.startsWith('/api/')) {
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }

  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = Bun.file(`${publicDir}${path}`);
  if (await file.exists()) {
    return new Response(file);
  }

  const fallback = Bun.file(`${publicDir}/index.html`);
  if (await fallback.exists()) {
    return new Response(fallback);
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};

const port = Number(process.env.PORT ?? 3001);

let server: Server;

server = Bun.serve({
  port,
  fetch: (request) => handler(request, server),
  websocket: {
    open(ws) {
      console.log('WebSocket connection opened', ws.data);
    },
    message(ws, message) {
      console.log('WebSocket message', message);
    },
    close(ws) {
      console.log('WebSocket connection closed', ws.data);
    },
  },
});

console.log(`Bun server running on http://localhost:${port}`);
