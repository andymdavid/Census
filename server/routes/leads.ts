import { formExists } from '../services/formsService';
import { getAccessibleFormForUser } from '../services/formAccessService';
import { createLead, listLeads } from '../services/leadsService';
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

const isValidEmail = (value: string) => {
  return /\S+@\S+\.\S+/.test(value);
};

export const handleLeadsRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const leadMatch = path.match(/^\/api\/forms\/([^/]+)\/leads$/);
  if (!leadMatch) {
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }

  const formId = leadMatch[1];
  if (!formExists(formId)) {
    return jsonResponse({ error: 'Form not found.' }, { status: 404 });
  }

  if (request.method === 'POST') {
    const payload = await readJson<{
      name?: string;
      email?: string;
      company?: string;
      responseId?: string | null;
    }>(request);

    const name = payload?.name?.trim() ?? '';
    const email = payload?.email?.trim() ?? '';
    const company = payload?.company?.trim() ?? '';

    if (!name || !email) {
      return jsonResponse({ error: 'Name and email are required.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email format.' }, { status: 400 });
    }

    const created = createLead({
      formId,
      responseId: payload?.responseId ?? null,
      name,
      email,
      company,
    });

    return jsonResponse({ id: created.id });
  }

  if (request.method === 'GET') {
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    return jsonResponse({ leads: listLeads(formId) });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
