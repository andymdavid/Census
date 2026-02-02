import db from '../db';

export interface ResponseRecord {
  id: string;
  form_id: string;
  created_at: number;
  score: number;
  meta_json: string | null;
}

export interface AnswerRecord {
  id: string;
  response_id: string;
  question_id: string;
  answer: string;
  created_at: number;
}

const insertResponse = db.prepare(
  'INSERT INTO responses (id, form_id, created_at, score, meta_json) VALUES (?, ?, ?, ?, ?)'
);
const insertAnswer = db.prepare(
  'INSERT INTO answers (id, response_id, question_id, answer, created_at) VALUES (?, ?, ?, ?, ?)'
);
const selectResponses = db.prepare(
  'SELECT id, form_id, created_at, score, meta_json FROM responses WHERE form_id = ? ORDER BY created_at DESC LIMIT ?'
);
const countResponses = db.prepare(
  'SELECT COUNT(*) as count FROM responses WHERE form_id = ?'
);
const responseSummary = db.prepare(
  'SELECT COUNT(*) as count, AVG(score) as avg_score FROM responses WHERE form_id = ?'
);
const questionStats = db.prepare(
  `
  SELECT a.question_id as question_id, a.answer as answer, COUNT(*) as count
  FROM answers a
  INNER JOIN responses r ON r.id = a.response_id
  WHERE r.form_id = ?
  GROUP BY a.question_id, a.answer
  `
);
const exportRows = db.prepare(
  `
  SELECT r.id as response_id, r.created_at as response_created_at, r.score as score, r.meta_json as meta_json,
         a.question_id as question_id, a.answer as answer, a.created_at as answer_created_at
  FROM responses r
  LEFT JOIN answers a ON a.response_id = r.id
  WHERE r.form_id = ?
  ORDER BY r.created_at DESC
  `
);

export const createResponse = (input: {
  formId: string;
  score: number;
  meta?: unknown;
  answers: Array<{ questionId: string; answer: string }>;
}) => {
  const now = Date.now();
  const responseId = crypto.randomUUID();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;

  insertResponse.run(responseId, input.formId, now, input.score, metaJson);

  for (const item of input.answers) {
    insertAnswer.run(
      crypto.randomUUID(),
      responseId,
      item.questionId,
      item.answer,
      now
    );
  }

  return { id: responseId, created_at: now };
};

export const listResponses = (formId: string, limit = 50) => {
  const responses = selectResponses.all(formId, limit) as ResponseRecord[];
  const countRow = countResponses.get(formId) as { count: number } | undefined;
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
  }>;
};
