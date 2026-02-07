import {
  createOrganization,
  getOrganizationById,
  isOrganizationMember,
  listOrganizationsForUser,
} from '../services/organizationService';
import {
  attachLegacyFormsToWorkspace,
  ensureDefaultWorkspace,
  listWorkspacesForOrgAndUser,
  updateWorkspacesOrganization,
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

export const handleOrganizationsRoutes = async (request: Request) => {
  const session = getSessionFromRequest(request);
  if (!session?.pubkey) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/api/organizations') {
    const list = listOrganizationsForUser(session.pubkey);
    if (list.length > 0) {
      const primaryOrgId = list[0].id;
      updateWorkspacesOrganization(primaryOrgId);
      const workspaces = listWorkspacesForOrgAndUser(primaryOrgId, session.pubkey);
      if (workspaces[0]?.id) {
        attachLegacyFormsToWorkspace(workspaces[0].id);
      }
    }
    return jsonResponse({ organizations: list });
  }

  if (request.method === 'POST' && path === '/api/organizations') {
    const payload = await readJson<{ name?: string }>(request);
    const name = payload?.name?.trim();
    if (!name) {
      return jsonResponse({ error: 'Name is required.' }, { status: 400 });
    }
    const created = createOrganization(name, session.pubkey);
    updateWorkspacesOrganization(created.id);
    const defaultWorkspace = ensureDefaultWorkspace(session.pubkey, created.id);
    if (defaultWorkspace?.id) {
      attachLegacyFormsToWorkspace(defaultWorkspace.id);
    }
    return jsonResponse({ id: created.id });
  }

  const match = path.match(/^\/api\/organizations\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const organizationId = match[1];
    if (!isOrganizationMember(organizationId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const organization = getOrganizationById(organizationId);
    if (!organization) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    return jsonResponse({ organization });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
