import {
  createWorkspace,
  getWorkspaceById,
  isWorkspaceMember,
  listWorkspacesForUser,
} from '../services/workspaceService';
import { getSessionFromRequest } from '../services/sessionService';

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

export const handleWorkspacesRoutes = async (request: Request) => {
  const session = getSessionFromRequest(request);
  if (!session?.pubkey) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/api/workspaces') {
    return jsonResponse({ workspaces: listWorkspacesForUser(session.pubkey) });
  }

  if (request.method === 'POST' && path === '/api/workspaces') {
    const payload = await readJson<{ name?: string }>(request);
    const name = payload?.name?.trim();
    if (!name) {
      return jsonResponse({ error: 'Name is required.' }, { status: 400 });
    }
    const created = createWorkspace(name, session.pubkey);
    return jsonResponse({ id: created.id });
  }

  const match = path.match(/^\/api\/workspaces\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const workspaceId = match[1];
    if (!isWorkspaceMember(workspaceId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    return jsonResponse({ workspace });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
