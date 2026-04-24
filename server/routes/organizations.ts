import {
  addOrganizationMember,
  createOrganization,
  getOrganizationMemberRole,
  getOrganizationSettings,
  getOrganizationById,
  isOrganizationMember,
  listOrganizationMembers,
  listOrganizationsForUser,
  renameOrganization,
  updateOrganizationSettings,
} from '../services/organizationService';
import { normalizePubkey } from '../services/workspaceService';
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

  const membersMatch = path.match(/^\/api\/organizations\/([^/]+)\/members$/);
  if (membersMatch && request.method === 'GET') {
    const organizationId = membersMatch[1];
    if (!isOrganizationMember(organizationId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    return jsonResponse({ members: listOrganizationMembers(organizationId) });
  }

  const settingsMatch = path.match(/^\/api\/organizations\/([^/]+)\/settings$/);
  if (settingsMatch && request.method === 'GET') {
    const organizationId = settingsMatch[1];
    if (!isOrganizationMember(organizationId, session.pubkey)) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const organization = getOrganizationById(organizationId);
    if (!organization) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const settings = getOrganizationSettings(organizationId);
    return jsonResponse({
      organization: {
        id: organization.id,
        name: organization.name,
      },
      settings: {
        aiEnabled: settings.ai_enabled === 1,
        aiDefaultModel: settings.ai_default_model,
        brandLogoUrl: settings.brand_logo_url,
        brandPrimaryColor: settings.brand_primary_color,
        brandBackgroundColor: settings.brand_background_color,
        brandTextColor: settings.brand_text_color,
        updatedAt: settings.updated_at,
        updatedBy: settings.updated_by,
      },
      integrations: {
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      },
    });
  }

  if (settingsMatch && request.method === 'PUT') {
    const organizationId = settingsMatch[1];
    const role = getOrganizationMemberRole(organizationId, session.pubkey);
    if (!role) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    if (role !== 'owner') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = await readJson<{
      name?: string;
      aiEnabled?: boolean;
      aiDefaultModel?: string | null;
      brandLogoUrl?: string | null;
      brandPrimaryColor?: string | null;
      brandBackgroundColor?: string | null;
      brandTextColor?: string | null;
    }>(request);
    const organization = getOrganizationById(organizationId);
    if (!organization) {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    const nextName = payload?.name?.trim();
    if (!nextName) {
      return jsonResponse({ error: 'Organisation name is required.' }, { status: 400 });
    }
    renameOrganization(organizationId, nextName);
    const settings = updateOrganizationSettings(
      organizationId,
      {
        aiEnabled: payload?.aiEnabled ?? true,
        aiDefaultModel: payload?.aiDefaultModel ?? null,
        brandLogoUrl: payload?.brandLogoUrl ?? null,
        brandPrimaryColor: payload?.brandPrimaryColor ?? null,
        brandBackgroundColor: payload?.brandBackgroundColor ?? null,
        brandTextColor: payload?.brandTextColor ?? null,
      },
      session.pubkey
    );
    return jsonResponse({
      organization: {
        id: organizationId,
        name: nextName,
      },
      settings: {
        aiEnabled: settings.ai_enabled === 1,
        aiDefaultModel: settings.ai_default_model,
        brandLogoUrl: settings.brand_logo_url,
        brandPrimaryColor: settings.brand_primary_color,
        brandBackgroundColor: settings.brand_background_color,
        brandTextColor: settings.brand_text_color,
        updatedAt: settings.updated_at,
        updatedBy: settings.updated_by,
      },
      integrations: {
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      },
    });
  }

  const inviteMatch = path.match(/^\/api\/organizations\/([^/]+)\/invite$/);
  if (inviteMatch && request.method === 'POST') {
    const organizationId = inviteMatch[1];
    const role = getOrganizationMemberRole(organizationId, session.pubkey);
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
    const members = addOrganizationMember(organizationId, normalized);
    return jsonResponse({ members: members ?? [] });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
