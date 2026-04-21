import { generateAiFormSpecFromBrief } from '../services/aiFormGenerationService';
import { createForm } from '../services/formsService';
import { getSessionFromRequest } from '../services/sessionService';
import { isWorkspaceMember } from '../services/workspaceService';

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

  if (request.method === 'POST' && path === '/api/ai/forms/spec') {
    const payload = await readJson<{ brief?: string; model?: string }>(request);
    const brief = payload?.brief?.trim() ?? '';

    if (!brief) {
      return jsonResponse({ error: 'Brief is required.' }, { status: 400 });
    }

    try {
      const generated = await generateAiFormSpecFromBrief({
        brief,
        model: payload?.model,
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
      const generated = await generateAiFormSpecFromBrief({
        brief,
        model: payload?.model,
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
