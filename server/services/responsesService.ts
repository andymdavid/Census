import db from '../db';
import { getFormById } from './formsService';
import { getTerminalQuestionIds, type ResponsePathMeta } from '../../shared/formFlow';
import type { FormSchemaV0 } from '../../src/types/formSchema';

export interface ResponseRecord {
  id: string;
  form_id: string;
  created_at: number;
  score: number;
  meta_json: string | null;
  completed: number;
}

export interface AnswerRecord {
  id: string;
  response_id: string;
  question_id: string;
  answer: string;
  created_at: number;
}

const insertResponse = db.prepare(
  'INSERT INTO responses (id, form_id, created_at, score, meta_json, completed) VALUES (?, ?, ?, ?, ?, ?)'
);
const updateResponse = db.prepare(
  'UPDATE responses SET score = ?, meta_json = ?, completed = ? WHERE id = ? AND form_id = ?'
);
const selectResponseById = db.prepare(
  'SELECT id, form_id, created_at, score, meta_json, completed FROM responses WHERE id = ?'
);
const insertAnswer = db.prepare(
  'INSERT INTO answers (id, response_id, question_id, answer, created_at) VALUES (?, ?, ?, ?, ?)'
);
const deleteAnswersByResponse = db.prepare('DELETE FROM answers WHERE response_id = ?');
const selectResponses = db.prepare(
  'SELECT id, form_id, created_at, score, meta_json, completed FROM responses WHERE form_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT ?'
);
const countCompletedResponses = db.prepare(
  'SELECT COUNT(*) as count FROM responses WHERE form_id = ? AND completed = 1'
);
const countAllResponses = db.prepare(
  'SELECT COUNT(*) as count FROM responses WHERE form_id = ?'
);
const selectResponseMeta = db.prepare(
  'SELECT id, meta_json FROM responses WHERE form_id = ?'
);
const responseSummary = db.prepare(
  'SELECT COUNT(*) as count, AVG(score) as avg_score FROM responses WHERE form_id = ? AND completed = 1'
);
const questionStats = db.prepare(
  `
  SELECT a.question_id as question_id, a.answer as answer, COUNT(*) as count
  FROM answers a
  INNER JOIN responses r ON r.id = a.response_id
  WHERE r.form_id = ? AND r.completed = 1
  GROUP BY a.question_id, a.answer
  `
);
const lastAnsweredQuestion = db.prepare(
  `
  SELECT ranked.response_id as response_id, ranked.question_id as question_id
  FROM (
    SELECT a.response_id as response_id,
           a.question_id as question_id,
           ROW_NUMBER() OVER (PARTITION BY a.response_id ORDER BY a.rowid DESC) as row_number
    FROM answers a
    INNER JOIN responses r ON r.id = a.response_id
    WHERE r.form_id = ?
  ) ranked
  WHERE ranked.row_number = 1
  `
);
const exportRows = db.prepare(
  `
  SELECT r.id as response_id, r.created_at as response_created_at, r.score as score, r.meta_json as meta_json,
         a.question_id as question_id, a.answer as answer, a.created_at as answer_created_at,
         l.name as lead_name, l.email as lead_email, l.company as lead_company
  FROM responses r
  LEFT JOIN answers a ON a.response_id = r.id
  LEFT JOIN leads l ON l.response_id = r.id
  WHERE r.form_id = ? AND r.completed = 1
  ORDER BY r.created_at DESC
  `
);

export const createResponse = (input: {
  responseId?: string;
  formId: string;
  score: number;
  meta?: unknown;
  answers: Array<{ questionId: string; answer: string }>;
  completed?: boolean;
}) => {
  const now = Date.now();
  const requestedResponseId = input.responseId?.trim();
  const existing = requestedResponseId
    ? (selectResponseById.get(requestedResponseId) as ResponseRecord | undefined)
    : undefined;
  const responseId =
    existing && existing.form_id === input.formId
      ? existing.id
      : existing
        ? crypto.randomUUID()
        : requestedResponseId || crypto.randomUUID();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;
  const completed = input.completed ? 1 : 0;

  db.transaction(() => {
    if (existing && existing.form_id === input.formId) {
      updateResponse.run(input.score, metaJson, completed, responseId, input.formId);
      deleteAnswersByResponse.run(responseId);
    } else {
      insertResponse.run(responseId, input.formId, now, input.score, metaJson, completed);
    }

    for (const item of input.answers) {
      insertAnswer.run(
        crypto.randomUUID(),
        responseId,
        item.questionId,
        item.answer,
        now
      );
    }
  })();

  return { id: responseId, created_at: existing?.created_at ?? now };
};

export const listResponses = (formId: string, limit = 50) => {
  const responses = selectResponses.all(formId, limit) as ResponseRecord[];
  const countRow = countCompletedResponses.get(formId) as { count: number } | undefined;
  return { responses, count: countRow?.count ?? 0 };
};

export const getSummary = (formId: string) => {
  const summary = responseSummary.get(formId) as { count: number; avg_score: number | null } | undefined;
  const stats = questionStats.all(formId) as Array<{
    question_id: string;
    answer: string;
    count: number;
  }>;

  return {
    count: summary?.count ?? 0,
    avgScore: summary?.avg_score ?? 0,
    questionStats: stats,
  };
};

export const exportResponses = (formId: string) => {
  return exportRows.all(formId) as Array<{
    response_id: string;
    response_created_at: number;
    score: number;
    meta_json: string | null;
    question_id: string | null;
    answer: string | null;
    answer_created_at: number | null;
    lead_name: string | null;
    lead_email: string | null;
    lead_company: string | null;
  }>;
};

export const getFunnelStats = (formId: string) => {
  const countRow = countAllResponses.get(formId) as { count: number } | undefined;
  const totalStarts = countRow?.count ?? 0;

  const form = getFormById(formId);
  let terminalQuestionIds = new Set<number>();
  if (form) {
    try {
      const schema = JSON.parse(form.schema_json) as FormSchemaV0;
      terminalQuestionIds = new Set(getTerminalQuestionIds(schema));
    } catch {
      terminalQuestionIds = new Set<number>();
    }
  }

  const responseMetaRows = selectResponseMeta.all(formId) as Array<{
    id: string;
    meta_json: string | null;
  }>;
  const fallbackLastAnswers = lastAnsweredQuestion.all(formId) as Array<{
    response_id: string;
    question_id: string;
  }>;
  const fallbackLastQuestionByResponse = new Map(
    fallbackLastAnswers.map((row) => [row.response_id, Number(row.question_id)])
  );

  const dropOffByQuestionId: Record<string, number> = {};
  let completions = 0;

  for (const row of responseMetaRows) {
    let meta: ResponsePathMeta | null = null;
    if (row.meta_json) {
      try {
        meta = JSON.parse(row.meta_json) as ResponsePathMeta;
      } catch {
        meta = null;
      }
    }

    const lastQuestionId = meta?.lastQuestionId ?? fallbackLastQuestionByResponse.get(row.id) ?? null;
    if (lastQuestionId !== null) {
      const key = String(lastQuestionId);
      dropOffByQuestionId[key] = (dropOffByQuestionId[key] ?? 0) + 1;
    }

    if (meta?.completed || (lastQuestionId !== null && terminalQuestionIds.has(lastQuestionId))) {
      completions += 1;
    }
  }

  return { totalStarts, completions, dropOffByQuestionId };
};
