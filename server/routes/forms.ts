import {
  createForm,
  getFormById,
  listForms,
  publishFormById,
  updateFormById,
} from '../services/formsService';

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

export const handleFormsRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/api/forms') {
    return jsonResponse({ forms: listForms() });
  }

  if (request.method === 'POST' && path === '/api/forms') {
    const payload = await readJson<{ title?: string; schema?: unknown }>(request);
    const title = payload?.title?.trim();
    if (!title) {
      return jsonResponse({ error: 'Title is required.' }, { status: 400 });
    }

    const created = createForm({ title, schema: payload?.schema ?? {} });
    return jsonResponse({ id: created.id });
  }

  const formIdMatch = path.match(/^\/api\/forms\/([^/]+)$/);
  if (formIdMatch) {
    const formId = formIdMatch[1];

    if (request.method === 'GET') {
      const form = getFormById(formId);
      if (!form) {
        return jsonResponse({ error: 'Form not found.' }, { status: 404 });
      }

      let schema: unknown = {};
      try {
        schema = JSON.parse(form.schema_json);
      } catch {
        schema = {};
      }

      return jsonResponse({
        id: form.id,
        title: form.title,
        schema,
        created_at: form.created_at,
        updated_at: form.updated_at,
        published: form.published,
      });
    }

    if (request.method === 'PUT') {
      const payload = await readJson<{ title?: string; schema?: unknown }>(request);
      const title = payload?.title?.trim();
      if (!title) {
        return jsonResponse({ error: 'Title is required.' }, { status: 400 });
      }

      updateFormById(formId, { title, schema: payload?.schema ?? {} });
      return jsonResponse({ ok: true });
    }
  }

  const publishMatch = path.match(/^\/api\/forms\/([^/]+)\/publish$/);
  if (publishMatch && request.method === 'POST') {
    const formId = publishMatch[1];
    publishFormById(formId);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
