import { formExists, getFormById } from '../services/formsService';
import { getAccessibleFormForUser } from '../services/formAccessService';
import {
  createResponse,
  deleteResponse,
  exportResponses,
  getDraftResumeState,
  getDraftRestoreStatus,
  getFunnelStats,
  getResponseReviewDetail,
  getSummary,
  listResponseReviewItems,
  listResponses,
} from '../services/responsesService';
import { getSessionFromRequest } from '../services/sessionService';
import { parseAndValidateFormSchema, validateResponseSubmission } from '../../shared/formValidation';

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

const getValidatedFormSchema = (formId: string) => {
  const form = getFormById(formId);
  if (!form) {
    return { schema: null, errors: ['Form not found.'] };
  }

  let storedSchema: unknown;
  try {
    storedSchema = JSON.parse(form.schema_json);
  } catch {
    return { schema: null, errors: ['Form schema is invalid.'] };
  }

  return parseAndValidateFormSchema(storedSchema);
};

export const handleResponsesRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const summaryMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/summary$/);
  if (summaryMatch && request.method === 'GET') {
    const formId = summaryMatch[1];
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }
    return jsonResponse(getSummary(formId));
  }

  const funnelMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/funnel$/);
  if (funnelMatch && request.method === 'GET') {
    const formId = funnelMatch[1];
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }
    return jsonResponse(getFunnelStats(formId));
  }

  const exportMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/export$/);
  if (exportMatch && request.method === 'GET') {
    const formId = exportMatch[1];
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
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
      'lead_name',
      'lead_email',
      'lead_company',
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
        row.lead_name,
        row.lead_email,
        row.lead_company,
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

  const draftStatusMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/draft-status$/);
  if (draftStatusMatch && request.method === 'GET') {
    const formId = draftStatusMatch[1];
    const responseId = url.searchParams.get('responseId')?.trim();
    const draftToken = url.searchParams.get('draftToken')?.trim();
    if (!responseId || !draftToken) {
      return jsonResponse({ error: 'responseId and draftToken are required.' }, { status: 400 });
    }
    return jsonResponse(getDraftRestoreStatus(formId, responseId, draftToken));
  }

  const draftResumeMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/draft-resume$/);
  if (draftResumeMatch && request.method === 'GET') {
    const formId = draftResumeMatch[1];
    const draftToken = url.searchParams.get('draftToken')?.trim();
    if (!draftToken) {
      return jsonResponse({ error: 'draftToken is required.' }, { status: 400 });
    }
    const { schema, errors } = getValidatedFormSchema(formId);
    if (!schema || errors.length > 0) {
      return jsonResponse({ error: 'Form schema is invalid.', details: errors }, { status: 400 });
    }
    return jsonResponse({ draft: getDraftResumeState(formId, schema, draftToken) });
  }

  const reviewMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/review$/);
  if (reviewMatch && request.method === 'GET') {
    const formId = reviewMatch[1];
    const statusParam = url.searchParams.get('status');
    const status =
      statusParam === 'in_progress' || statusParam === 'all' ? statusParam : 'completed';
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    const { schema, errors } = getValidatedFormSchema(formId);
    if (!schema || errors.length > 0) {
      return jsonResponse({ error: 'Form schema is invalid.', details: errors }, { status: 400 });
    }

    return jsonResponse({ responses: listResponseReviewItems(formId, schema, 100, status) });
  }

  const reviewDetailMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/review\/([^/]+)$/);
  if (reviewDetailMatch && request.method === 'GET') {
    const formId = reviewDetailMatch[1];
    const responseId = reviewDetailMatch[2];
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    const { schema, errors } = getValidatedFormSchema(formId);
    if (!schema || errors.length > 0) {
      return jsonResponse({ error: 'Form schema is invalid.', details: errors }, { status: 400 });
    }

    const response = getResponseReviewDetail(formId, responseId, schema);
    if (!response) {
      return jsonResponse({ error: 'Response not found.' }, { status: 404 });
    }

    return jsonResponse({ response });
  }

  const deleteResponseMatch = path.match(/^\/api\/forms\/([^/]+)\/responses\/([^/]+)$/);
  if (deleteResponseMatch && request.method === 'DELETE') {
    const formId = deleteResponseMatch[1];
    const responseId = deleteResponseMatch[2];
    const session = getSessionFromRequest(request);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.pubkey || !getAccessibleFormForUser(formId, session.pubkey)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    const deleted = deleteResponse(formId, responseId);
    if (!deleted) {
      return jsonResponse({ error: 'Response not found.' }, { status: 404 });
    }

    return jsonResponse({ ok: true });
  }

  const responsesMatch = path.match(/^\/api\/forms\/([^/]+)\/responses$/);
  if (responsesMatch) {
    const formId = responsesMatch[1];
    if (!formExists(formId)) {
      return jsonResponse({ error: 'Form not found.' }, { status: 404 });
    }

    if (request.method === 'POST') {
      const payload = await readJson<{
        responseId?: string;
        answers?: Array<{ questionId: string; answer: string }>;
        score?: number;
        meta?: unknown;
        completed?: boolean;
      }>(request);

      if (!payload || !Array.isArray(payload.answers) || typeof payload.score !== 'number') {
        return jsonResponse({ error: 'Invalid payload.' }, { status: 400 });
      }
      const { schema, errors: schemaErrors } = getValidatedFormSchema(formId);
      if (!schema || schemaErrors.length > 0) {
        return jsonResponse({ error: 'Form schema is invalid.' }, { status: 400 });
      }
      const submissionPayload = {
        answers: payload.answers,
        score: payload.score,
        meta: payload.meta,
        completed: payload.completed,
      };
      const validationErrors = validateResponseSubmission(schema, submissionPayload);
      if (validationErrors.length > 0) {
        return jsonResponse(
          { error: 'Invalid response submission.', details: validationErrors },
          { status: 400 }
        );
      }

      const created = createResponse({
        responseId: payload.responseId,
        formId,
        score: payload.score,
        meta: payload.meta,
        answers: payload.answers,
        completed: payload.completed,
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
      const data = listResponses(formId);
      return jsonResponse(data);
    }
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
};
