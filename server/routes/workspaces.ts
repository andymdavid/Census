import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  getWorkspaceMemberRole,
  isWorkspaceMember,
  listWorkspaceMembers,
  listWorkspacesForOrgAndUser,
  normalizePubkey,
  addWorkspaceMember,
  removeWorkspaceMember,
  ensureDefaultWorkspace,
  renameWorkspace,
} from '../services/workspaceService';
import { isOrganizationMember } from '../services/organizationService';
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
    const orgId = url.searchParams.get('orgId');
    if (!orgId) {
      return jsonResponse({ error: 'orgId is required.' }, { status: 400 });
    }
    if (!isOrganizationMember(orgId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const workspaces = listWorkspacesForOrgAndUser(orgId, session.pubkey);
    if (workspaces.length === 0) {
      ensureDefaultWorkspace(session.pubkey, orgId);
      return jsonResponse({
        workspaces: listWorkspacesForOrgAndUser(orgId, session.pubkey),
      });
    }
    return jsonResponse({ workspaces });
  }

  if (request.method === 'POST' && path === '/api/workspaces') {
    const payload = await readJson<{ name?: string; orgId?: string }>(request);
    const name = payload?.name?.trim();
    if (!name) {
      return jsonResponse({ error: 'Name is required.' }, { status: 400 });
    }
    const orgId = payload?.orgId;
    if (!orgId) {
      return jsonResponse({ error: 'orgId is required.' }, { status: 400 });
    }
    if (!isOrganizationMember(orgId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const created = createWorkspace(name, session.pubkey, orgId);
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

  if (match && request.method === 'PUT') {
    const workspaceId = match[1];
    const role = getWorkspaceMemberRole(workspaceId, session.pubkey);
    if (!role) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    if (role !== 'owner') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = await readJson<{ name?: string }>(request);
    const name = payload?.name?.trim();
    if (!name) {
      return jsonResponse({ error: 'Name is required.' }, { status: 400 });
    }
    renameWorkspace(workspaceId, name);
    return jsonResponse({ ok: true });
  }

  if (match && request.method === 'DELETE') {
    const workspaceId = match[1];
    const role = getWorkspaceMemberRole(workspaceId, session.pubkey);
    if (!role) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    if (role !== 'owner') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }
    deleteWorkspace(workspaceId);
    return jsonResponse({ ok: true });
  }

  const leaveMatch = path.match(/^\/api\/workspaces\/([^/]+)\/leave$/);
  if (leaveMatch && request.method === 'POST') {
    const workspaceId = leaveMatch[1];
    if (!isWorkspaceMember(workspaceId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const remaining = removeWorkspaceMember(workspaceId, session.pubkey);
    if (remaining === 0) {
      deleteWorkspace(workspaceId);
    }
    return jsonResponse({ ok: true });
  }

  const membersMatch = path.match(/^\/api\/workspaces\/([^/]+)\/members$/);
  if (membersMatch && request.method === 'GET') {
    const workspaceId = membersMatch[1];
    if (!isWorkspaceMember(workspaceId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    return jsonResponse({ members: listWorkspaceMembers(workspaceId) });
  }

  const inviteMatch = path.match(/^\/api\/workspaces\/([^/]+)\/invite$/);
  if (inviteMatch && request.method === 'POST') {
    const workspaceId = inviteMatch[1];
    const role = getWorkspaceMemberRole(workspaceId, session.pubkey);
    if (!role) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    if (role !== 'owner') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = await readJson<{ pubkey?: string }>(request);
    const normalized = normalizePubkey(payload?.pubkey ?? '');
    if (!normalized) {
      return jsonResponse({ error: 'Invalid pubkey.' }, { status: 400 });
    }
    const members = addWorkspaceMember(workspaceId, normalized);
    return jsonResponse({ members });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
