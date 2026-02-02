import { formExists } from '../services/formsService';
import { createResponse, exportResponses, getSummary, listResponses } from '../services/responsesService';

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

const toCsvValue = (value: string | number | null) => {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

export const handleResponsesRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const summaryMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/summary$/);
  if (summaryMatch && request.method === 'GET') {
    const formId = summaryMatch[1];
    if (!formExists(formId)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }
    return jsonResponse(getSummary(formId));
  }

  const exportMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/export$/);
  if (exportMatch && request.method === 'GET') {
    const formId = exportMatch[1];
    if (!formExists(formId)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }
    const rows = exportResponses(formId);

    const header = [
      'response_id',
      'response_created_at',
      'score',
      'meta_json',
      'question_id',
      'answer',
      'answer_created_at',
    ];

    const body = rows.map((row) =>
      [
        row.response_id,
        row.response_created_at,
        row.score,
        row.meta_json,
        row.question_id,
        row.answer,
        row.answer_created_at,
      ]
        .map(toCsvValue)
        .join(',')
    );

    const csv = [header.join(','), ...body].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="responses-${formId}.csv"`,
      },
    });
  }

  const responsesMatch = path.match(/^\/api\/forms\/([^/]+)\/responses$/);
  if (responsesMatch) {
    const formId = responsesMatch[1];
    if (!formExists(formId)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    if (request.method === 'POST') {
      const payload = await readJson<{
        answers?: Array<{ questionId: string; answer: string }>;
        score?: number;
        meta?: unknown;
      }>(request);

      if (!payload?.answers || typeof payload.score !== 'number') {
        return jsonResponse({ error: 'Invalid payload.' }, { status: 400 });
      }

      const created = createResponse({
        formId,
        score: payload.score,
        meta: payload.meta,
        answers: payload.answers,
      });

      return jsonResponse({ id: created.id });
    }

    if (request.method === 'GET') {
      const data = listResponses(formId);
      return jsonResponse(data);
    }
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
