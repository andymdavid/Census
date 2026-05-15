import db from '../db';
import { getFormById } from './formsService';
import {
  getTerminalQuestionIds,
  parseStoredAnswerForQuestion,
  type ResponsePathMeta,
} from '../../shared/formFlow';
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

export interface ResponseReviewListItem {
  id: string;
  submittedAt: number;
  score: number;
  completed: boolean;
  answerCount: number;
  submitterName: string;
  submitterEmail: string | null;
}

export interface ResponseReviewDetail {
  id: string;
  submittedAt: number;
  score: number;
  completed: boolean;
  submitterName: string;
  submitterEmail: string | null;
  sections: Array<{
    title: string;
    answers: Array<{
      questionId: number;
      question: string;
      answer: string;
    }>;
  }>;
}

export interface DraftResumeState {
  responseId: string;
  draftToken: string;
  currentQuestionId: number;
  answers: Record<number, boolean | string | string[]>;
  history: number[];
  showWelcome: boolean;
  repeatInstances: Record<string, Record<number, boolean | string | string[]>[]>;
  loopSummaryId: string | null;
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
const deleteLeadsByResponse = db.prepare('DELETE FROM leads WHERE response_id = ?');
const deleteResponseById = db.prepare('DELETE FROM responses WHERE id = ? AND form_id = ?');
const insertDraftResetToken = db.prepare(
  'INSERT INTO draft_reset_tokens (form_id, response_id, draft_token, created_at) VALUES (?, ?, ?, ?)'
);
const selectDraftResetToken = db.prepare(
  'SELECT draft_token FROM draft_reset_tokens WHERE form_id = ? AND response_id = ? AND draft_token = ? LIMIT 1'
);
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
const reviewRows = db.prepare(
  `
  SELECT r.id as id,
         r.created_at as submitted_at,
         r.score as score,
         r.completed as completed,
         COUNT(DISTINCT a.id) as answer_count,
         MAX(l.name) as lead_name,
         MAX(l.email) as lead_email
  FROM responses r
  LEFT JOIN answers a ON a.response_id = r.id
  LEFT JOIN leads l ON l.response_id = r.id
  WHERE r.form_id = ?
  GROUP BY r.id
  ORDER BY r.created_at DESC
  LIMIT ?
  `
);
const reviewResponse = db.prepare(
  `
  SELECT r.id as id,
         r.form_id as form_id,
         r.created_at as submitted_at,
         r.score as score,
         r.meta_json as meta_json,
         r.completed as completed,
         MAX(l.name) as lead_name,
         MAX(l.email) as lead_email
  FROM responses r
  LEFT JOIN leads l ON l.response_id = r.id
  WHERE r.id = ? AND r.form_id = ?
  GROUP BY r.id
  `
);
const responseAnswers = db.prepare(
  'SELECT question_id, answer, created_at FROM answers WHERE response_id = ? ORDER BY created_at ASC'
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
  const existingRow = requestedResponseId
    ? (selectResponseById.get(requestedResponseId) as ResponseRecord | null)
    : null;
  const existing = existingRow ?? undefined;
  let requestedDraftToken: string | null = null;
  if (input.meta && typeof input.meta === 'object') {
    const candidate = (input.meta as { draftToken?: unknown }).draftToken;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      requestedDraftToken = candidate.trim();
    }
  }
  let existingDraftToken: string | null = null;
  if (existing?.meta_json) {
    try {
      const parsed = JSON.parse(existing.meta_json) as ResponsePathMeta;
      if (typeof parsed.draftToken === 'string' && parsed.draftToken.trim().length > 0) {
        existingDraftToken = parsed.draftToken.trim();
      }
    } catch {
      existingDraftToken = null;
    }
  }
  const canUpdateExisting =
    existing !== undefined && existing.form_id === input.formId && existing.completed === 0;
  const shouldIgnoreLateDraftWrite =
    existing !== undefined &&
    existing.form_id === input.formId &&
    existing.completed === 1 &&
    input.completed !== true &&
    requestedDraftToken !== null &&
    requestedDraftToken === existingDraftToken;
  const responseId =
    canUpdateExisting
      ? existing.id
      : shouldIgnoreLateDraftWrite
        ? existing.id
      : existing
        ? crypto.randomUUID()
        : requestedResponseId || crypto.randomUUID();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;
  const completed = input.completed ? 1 : 0;

  if (shouldIgnoreLateDraftWrite) {
    return { id: responseId, created_at: existing.created_at };
  }

  db.transaction(() => {
    if (canUpdateExisting) {
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

  return { id: responseId, created_at: canUpdateExisting ? existing.created_at : now };
};

export const listResponses = (formId: string, limit = 50) => {
  const responses = selectResponses.all(formId, limit) as ResponseRecord[];
  const countRow = countCompletedResponses.get(formId) as { count: number } | undefined;
  return { responses, count: countRow?.count ?? 0 };
};

export const deleteResponse = (formId: string, responseId: string) => {
  const existing = selectResponseById.get(responseId) as ResponseRecord | undefined;
  if (!existing || existing.form_id !== formId) {
    return false;
  }

  let draftToken: string | null = null;
  if (existing.meta_json) {
    try {
      const meta = JSON.parse(existing.meta_json) as ResponsePathMeta;
      draftToken =
        typeof meta.draftToken === 'string' && meta.draftToken.trim().length > 0
          ? meta.draftToken.trim()
          : null;
    } catch {
      draftToken = null;
    }
  }

  db.transaction(() => {
    if (draftToken) {
      insertDraftResetToken.run(formId, responseId, draftToken, Date.now());
    }
    deleteAnswersByResponse.run(responseId);
    deleteLeadsByResponse.run(responseId);
    deleteResponseById.run(responseId, formId);
  })();

  return true;
};

export const getDraftRestoreStatus = (formId: string, responseId: string, draftToken: string) => {
  const invalidated = selectDraftResetToken.get(formId, responseId, draftToken) as
    | { draft_token: string }
    | undefined;
  if (invalidated) {
    return { resetRequired: true };
  }

  const existing = selectResponseById.get(responseId) as ResponseRecord | undefined;
  if (!existing || existing.form_id !== formId || existing.completed === 1) {
    return { resetRequired: true };
  }

  return { resetRequired: false };
};

export const getDraftResumeState = (
  formId: string,
  schema: FormSchemaV0,
  draftToken: string
): DraftResumeState | null => {
  const rows = reviewRows.all(formId, 200) as Array<{
    id: string;
    submitted_at: number;
    completed: number;
  }>;

  for (const row of rows) {
    if (row.completed === 1) continue;
    const existing = selectResponseById.get(row.id) as ResponseRecord | null;
    if (!existing?.meta_json) continue;

    let meta: ResponsePathMeta | null = null;
    try {
      meta = JSON.parse(existing.meta_json) as ResponsePathMeta;
    } catch {
      meta = null;
    }

    if (!meta || meta.draftToken !== draftToken || typeof meta.lastQuestionId !== 'number') {
      continue;
    }

    const answers = responseAnswers.all(row.id) as Array<{
      question_id: string;
      answer: string;
      created_at: number;
    }>;
    const answersByQuestionId = new Map<number, Array<boolean | string | string[]>>();
    const answerMap: Record<number, boolean | string | string[]> = {};

    for (const answer of answers) {
      const questionId = Number(answer.question_id);
      const question = schema.questions.find((item) => item.id === questionId);
      if (!question) continue;
      const parsedAnswer = parseStoredAnswerForQuestion(question, answer.answer) as
        | boolean
        | string
        | string[];
      const existingAnswers = answersByQuestionId.get(questionId) ?? [];
      existingAnswers.push(parsedAnswer);
      answersByQuestionId.set(questionId, existingAnswers);
      answerMap[questionId] = parsedAnswer;
    }

    const repeatInstances: DraftResumeState['repeatInstances'] = {};
    const activeLoopId =
      schema.repeatLoops?.find((loop) => {
        const startIndex = schema.questions.findIndex((item) => item.id === loop.startQuestionId);
        const endIndex = schema.questions.findIndex((item) => item.id === loop.endQuestionId);
        const currentIndex = schema.questions.findIndex((item) => item.id === meta?.lastQuestionId);
        return startIndex !== -1 && endIndex !== -1 && currentIndex >= startIndex && currentIndex <= endIndex;
      })?.id ?? null;

    meta.repeatLoops?.forEach((loopMeta) => {
      const instances = loopMeta.instances.map((instance, instanceIndex) => {
        const instanceAnswers: Record<number, boolean | string | string[]> = {};
        instance.questionIds.forEach((questionId) => {
          const value = answersByQuestionId.get(questionId)?.[instanceIndex];
          if (value !== undefined) {
            instanceAnswers[questionId] = value;
          }
        });
        return instanceAnswers;
      });

      if (instances.length === 0) {
        return;
      }

      if (activeLoopId === loopMeta.loopId) {
        const currentInstance = instances[instances.length - 1] ?? {};
        Object.entries(currentInstance).forEach(([questionId, value]) => {
          answerMap[Number(questionId)] = value as boolean | string | string[];
        });
        repeatInstances[loopMeta.loopId] = instances.slice(0, -1);
        return;
      }

      repeatInstances[loopMeta.loopId] = instances;
    });

    return {
      responseId: existing.id,
      draftToken,
      currentQuestionId: meta.lastQuestionId,
      answers: answerMap,
      history: (meta.visitedQuestionIds ?? []).filter(
        (questionId) => questionId !== meta?.lastQuestionId
      ),
      showWelcome: false,
      repeatInstances,
      loopSummaryId: null,
    };
  }

  return null;
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

export const exportReadableResponses = (formId: string, schema: FormSchemaV0) => {
  const rows = exportResponses(formId);
  const grouped = new Map<
    string,
    {
      submittedAt: number;
      score: number;
      meta: ResponsePathMeta | null;
      leadName: string | null;
      leadEmail: string | null;
      leadCompany: string | null;
      answers: Array<{ question_id: string | null; answer: string | null }>;
    }
  >();

  rows.forEach((row) => {
    const existing = grouped.get(row.response_id) ?? {
      submittedAt: row.response_created_at,
      score: row.score,
      meta: null as ResponsePathMeta | null,
      leadName: row.lead_name,
      leadEmail: row.lead_email,
      leadCompany: row.lead_company,
      answers: [],
    };
    if (existing.meta === null && row.meta_json) {
      try {
        existing.meta = JSON.parse(row.meta_json) as ResponsePathMeta;
      } catch {
        existing.meta = null;
      }
    }
    existing.leadName = existing.leadName ?? row.lead_name;
    existing.leadEmail = existing.leadEmail ?? row.lead_email;
    existing.leadCompany = existing.leadCompany ?? row.lead_company;
    if (row.question_id !== null && row.answer !== null) {
      existing.answers.push({ question_id: row.question_id, answer: row.answer });
    }
    grouped.set(row.response_id, existing);
  });

  const csvRows: Array<{
    response_id: string;
    submitted_at: number;
    submitter_name: string;
    submitter_email: string | null;
    submitter_company: string | null;
    score: number;
    section: string;
    repeat_loop_label: string | null;
    repeat_instance_index: number | null;
    repeat_instance_title: string | null;
    question_id: number | null;
    question: string | null;
    answer: string | null;
  }> = [];

  grouped.forEach((response, responseId) => {
    const answersByQuestionId = new Map<number, string[]>();
    response.answers.forEach((answer) => {
      const questionId = Number(answer.question_id);
      if (!Number.isInteger(questionId) || answer.answer === null) return;
      answersByQuestionId.set(questionId, [...(answersByQuestionId.get(questionId) ?? []), answer.answer]);
    });

    const submitterName = inferSubmitterName(
      schema,
      response.answers
        .filter((answer): answer is { question_id: string; answer: string } => !!answer.question_id && !!answer.answer),
      response.leadName
    );

    const repeatedQuestionIds = new Set<number>();
    response.meta?.repeatLoops?.forEach((loop) => {
      loop.instances.forEach((instance) => {
        instance.questionIds.forEach((questionId) => repeatedQuestionIds.add(questionId));
      });
    });

    response.meta?.repeatLoops?.forEach((loopMeta) => {
      const loop = schema.repeatLoops?.find((item) => item.id === loopMeta.loopId);
      if (!loop) return;
      const loopQuestions = schema.questions.filter((question) => {
        const startIndex = schema.questions.findIndex((item) => item.id === loop.startQuestionId);
        const endIndex = schema.questions.findIndex((item) => item.id === loop.endQuestionId);
        const questionIndex = schema.questions.findIndex((item) => item.id === question.id);
        return startIndex !== -1 && endIndex !== -1 && questionIndex >= startIndex && questionIndex <= endIndex;
      });

      loopMeta.instances.forEach((instance, instanceIndex) => {
        loopQuestions.forEach((question) => {
          if (!isAnswerableResponseQuestion(question)) return;
          const answer = answersByQuestionId.get(question.id)?.[instanceIndex];
          if (answer === undefined) return;
          csvRows.push({
            response_id: responseId,
            submitted_at: response.submittedAt,
            submitter_name: submitterName,
            submitter_email: response.leadEmail,
            submitter_company: response.leadCompany,
            score: response.score,
            section: instance.title || `${loopMeta.label} ${instance.index}`,
            repeat_loop_label: loopMeta.label,
            repeat_instance_index: instance.index,
            repeat_instance_title: instance.title || null,
            question_id: question.id,
            question: question.text,
            answer,
          });
        });
      });
    });

    let currentSection = 'Answers';
    for (const question of schema.questions) {
      const kind = question.settings?.kind;
      if (
        kind === 'welcome' ||
        kind === 'end' ||
        question.category === 'Welcome Screen' ||
        question.category === 'End Screen'
      ) {
        continue;
      }

      if (
        kind === 'group' ||
        question.category === 'Question Group' ||
        kind === 'details' ||
        question.category === 'Details Screen'
      ) {
        currentSection = question.text;
        continue;
      }

      if (repeatedQuestionIds.has(question.id)) {
        continue;
      }

      const answer = answersByQuestionId.get(question.id)?.[0];
      if (answer === undefined) {
        continue;
      }

      csvRows.push({
        response_id: responseId,
        submitted_at: response.submittedAt,
        submitter_name: submitterName,
        submitter_email: response.leadEmail,
        submitter_company: response.leadCompany,
        score: response.score,
        section: currentSection,
        repeat_loop_label: null,
        repeat_instance_index: null,
        repeat_instance_title: null,
        question_id: question.id,
        question: question.text,
        answer,
      });
    }
  });

  return csvRows;
};

const preferredSubmitterNamePatterns = [
  /^what[’']?s your name\??$/i,
  /^what is your name\??$/i,
  /^your name\??$/i,
  /^full name\??$/i,
];
const fallbackSubmitterNamePattern =
  /(^|\b)(submitter name|full name|your name|what[’']?s your name|what is your name|name)(\b|$)/i;

const isAnswerableResponseQuestion = (question: FormSchemaV0['questions'][number]) => {
  const kind = question.settings?.kind;
  return !(
    kind === 'welcome' ||
    kind === 'end' ||
    kind === 'group' ||
    kind === 'details' ||
    question.category === 'Welcome Screen' ||
    question.category === 'End Screen' ||
    question.category === 'Question Group' ||
    question.category === 'Details Screen'
  );
};

const inferSubmitterName = (
  schema: FormSchemaV0,
  answers: Array<{ question_id: string; answer: string }>,
  leadName?: string | null
) => {
  if (leadName?.trim()) {
    return leadName.trim();
  }

  const preferredQuestionIds = schema.questions
    .filter((question) =>
      preferredSubmitterNamePatterns.some((pattern) => pattern.test(question.text.trim()))
    )
    .map((question) => String(question.id));

  for (const questionId of preferredQuestionIds) {
    const submitterAnswer = answers.find((answer) => answer.question_id === questionId);
    if (submitterAnswer?.answer.trim()) {
      return submitterAnswer.answer.trim();
    }
  }

  const fallbackQuestionIds = schema.questions
    .filter((question) => fallbackSubmitterNamePattern.test(question.text.trim()))
    .map((question) => String(question.id));

  for (const questionId of fallbackQuestionIds) {
    const submitterAnswer = answers.find((answer) => answer.question_id === questionId);
    if (submitterAnswer?.answer.trim()) {
      return submitterAnswer.answer.trim();
    }
  }

  return 'Anonymous response';
};

export const listResponseReviewItems = (
  formId: string,
  schema: FormSchemaV0,
  limit = 100,
  status: 'completed' | 'in_progress' | 'all' = 'completed'
) => {
  const rows = reviewRows.all(formId, limit) as Array<{
    id: string;
    submitted_at: number;
    score: number;
    completed: number;
    answer_count: number;
    lead_name: string | null;
    lead_email: string | null;
  }>;

  return rows
    .filter((row) => {
      if (status === 'all') return true;
      if (status === 'completed') return row.completed === 1;
      return row.completed === 0;
    })
    .map<ResponseReviewListItem>((row) => {
    const answers = responseAnswers.all(row.id) as Array<{
      question_id: string;
      answer: string;
    }>;

    return {
      id: row.id,
      submittedAt: row.submitted_at,
      score: row.score,
      completed: row.completed === 1,
      answerCount: row.answer_count,
      submitterName: inferSubmitterName(schema, answers, row.lead_name),
      submitterEmail: row.lead_email,
    };
  });
};

export const getResponseReviewDetail = (
  formId: string,
  responseId: string,
  schema: FormSchemaV0
): ResponseReviewDetail | null => {
  const row = reviewResponse.get(responseId, formId) as
    | {
        id: string;
        submitted_at: number;
        score: number;
        completed: number;
        meta_json: string | null;
        lead_name: string | null;
        lead_email: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  const answers = responseAnswers.all(responseId) as Array<{
    question_id: string;
    answer: string;
  }>;
  const answersByQuestionId = new Map<number, string[]>();
  answers.forEach((answer) => {
    const questionId = Number(answer.question_id);
    answersByQuestionId.set(questionId, [
      ...(answersByQuestionId.get(questionId) ?? []),
      answer.answer,
    ]);
  });
  let meta: ResponsePathMeta | null = null;
  if (row.meta_json) {
    try {
      meta = JSON.parse(row.meta_json) as ResponsePathMeta;
    } catch {
      meta = null;
    }
  }
  const repeatedQuestionIds = new Set<number>();
  meta?.repeatLoops?.forEach((loop) => {
    loop.instances.forEach((instance) => {
      instance.questionIds.forEach((questionId) => repeatedQuestionIds.add(questionId));
    });
  });
  const sections: ResponseReviewDetail['sections'] = [];
  let currentSection: ResponseReviewDetail['sections'][number] = {
    title: 'Answers',
    answers: [],
  };

  const pushCurrentSection = () => {
    if (currentSection.answers.length > 0) {
      sections.push(currentSection);
    }
  };

  meta?.repeatLoops?.forEach((loopMeta) => {
    const loop = schema.repeatLoops?.find((item) => item.id === loopMeta.loopId);
    if (!loop) return;
    const loopQuestions = schema.questions.filter((question) => {
      const startIndex = schema.questions.findIndex((item) => item.id === loop.startQuestionId);
      const endIndex = schema.questions.findIndex((item) => item.id === loop.endQuestionId);
      const questionIndex = schema.questions.findIndex((item) => item.id === question.id);
      return startIndex !== -1 && endIndex !== -1 && questionIndex >= startIndex && questionIndex <= endIndex;
    });

    loopMeta.instances.forEach((instance, instanceIndex) => {
      const sectionAnswers: ResponseReviewDetail['sections'][number]['answers'] = [];
      loopQuestions.forEach((question) => {
        if (!isAnswerableResponseQuestion(question)) return;
        const answer = answersByQuestionId.get(question.id)?.[instanceIndex];
        if (answer !== undefined) {
          sectionAnswers.push({
            questionId: question.id,
            question: question.text,
            answer,
          });
        }
      });
      if (sectionAnswers.length > 0) {
        sections.push({
          title: instance.title || `${loopMeta.label} ${instance.index}`,
          answers: sectionAnswers,
        });
      }
    });
  });

  for (const question of schema.questions) {
    const kind = question.settings?.kind;
    if (kind === 'welcome' || kind === 'end' || question.category === 'Welcome Screen' || question.category === 'End Screen') {
      continue;
    }

    if (kind === 'group' || question.category === 'Question Group' || kind === 'details' || question.category === 'Details Screen') {
      pushCurrentSection();
      currentSection = { title: question.text, answers: [] };
      continue;
    }

    if (repeatedQuestionIds.has(question.id)) {
      continue;
    }

    const answer = answersByQuestionId.get(question.id)?.[0];
    if (answer !== undefined) {
      currentSection.answers.push({
        questionId: question.id,
        question: question.text,
        answer,
      });
    }
  }

  pushCurrentSection();

  return {
    id: row.id,
    submittedAt: row.submitted_at,
    score: row.score,
    completed: row.completed === 1,
    submitterName: inferSubmitterName(schema, answers, row.lead_name),
    submitterEmail: row.lead_email,
    sections,
  };
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
