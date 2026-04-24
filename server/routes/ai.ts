import { generateAiFormSpecFromBrief } from '../services/aiFormGenerationService';
import { createForm } from '../services/formsService';
import { getOrganizationSettings } from '../services/organizationService';
import { getSessionFromRequest } from '../services/sessionService';
import { getWorkspaceById, isWorkspaceMember } from '../services/workspaceService';

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

export const handleAiRoutes = async (request: Request) => {
  const session = getSessionFromRequest(request);
  if (!session?.pubkey) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  const resolveOrganizationAiModel = (workspaceId?: string | null) => {
    const resolvedWorkspaceId = workspaceId?.trim();
    if (!resolvedWorkspaceId) return null;
    if (!isWorkspaceMember(resolvedWorkspaceId, session.pubkey)) {
      return { error: jsonResponse({ error: 'Not found.' }, { status: 404 }) };
    }
    const workspace = getWorkspaceById(resolvedWorkspaceId);
    if (!workspace?.organization_id) {
      return null;
    }
    const settings = getOrganizationSettings(workspace.organization_id);
    if (settings.ai_enabled !== 1) {
      return { error: jsonResponse({ error: 'AI generation is disabled for this organisation.' }, { status: 403 }) };
    }
    return { model: settings.ai_default_model };
  };

  if (request.method === 'POST' && path === '/api/ai/forms/spec') {
    const payload = await readJson<{ brief?: string; model?: string; workspaceId?: string }>(request);
    const brief = payload?.brief?.trim() ?? '';

    if (!brief) {
      return jsonResponse({ error: 'Brief is required.' }, { status: 400 });
    }

    try {
      const organizationModel = resolveOrganizationAiModel(payload?.workspaceId);
      if (organizationModel?.error) {
        return organizationModel.error;
      }
      const generated = await generateAiFormSpecFromBrief({
        brief,
        model: payload?.model?.trim() || organizationModel?.model || undefined,
      });

      return jsonResponse(generated);
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : 'AI form generation failed.',
        },
        { status: 400 }
      );
    }
  }

  if (request.method === 'POST' && path === '/api/ai/forms/draft') {
    const payload = await readJson<{ brief?: string; model?: string; workspaceId?: string }>(request);
    const brief = payload?.brief?.trim() ?? '';
    const workspaceId = payload?.workspaceId?.trim() ?? '';

    if (!brief) {
      return jsonResponse({ error: 'Brief is required.' }, { status: 400 });
    }
    if (!workspaceId) {
      return jsonResponse({ error: 'workspaceId is required.' }, { status: 400 });
    }
    if (!isWorkspaceMember(workspaceId, session.pubkey)) {
      return jsonResponse({ error: 'Not found.' }, { status: 404 });
    }

    try {
      const organizationModel = resolveOrganizationAiModel(workspaceId);
      if (organizationModel?.error) {
        return organizationModel.error;
      }
      const generated = await generateAiFormSpecFromBrief({
        brief,
        model: payload?.model?.trim() || organizationModel?.model || undefined,
      });
      const created = createForm({
        title: generated.schema.title,
        schema: generated.schema,
        workspaceId,
      });

      return jsonResponse({
        id: created.id,
        model: generated.model,
        spec: generated.spec,
        schema: generated.schema,
      });
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : 'AI draft generation failed.',
        },
        { status: 400 }
      );
    }
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
