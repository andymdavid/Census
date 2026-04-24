import type {
  FormBranchCondition,
  FormQuestion,
  FormQuestionSettings,
  FormRepeatLoop,
  FormSchemaV0,
} from '../src/types/formSchema';

export interface ResponsePathMeta {
  visitedQuestionIds?: number[];
  lastQuestionId?: number;
  completed?: boolean;
  draftToken?: string;
  repeatLoops?: Array<{
    loopId: string;
    label: string;
    instances: Array<{
      index: number;
      title?: string;
      questionIds: number[];
    }>;
  }>;
}

export type FormAnswerValue = boolean | string | string[] | undefined;

export const hasScoredResults = (form: FormSchemaV0) => {
  return form.results.some(
    (result) => result.minScore !== undefined || result.maxScore !== undefined
  );
};

export const isScoringEnabled = (form: FormSchemaV0) => {
  return form.scoringEnabled ?? hasScoredResults(form);
};

export const getTotalScore = (form: FormSchemaV0) => {
  if (!isScoringEnabled(form)) return 0;
  return form.questions.reduce((sum, question) => sum + question.weight, 0);
};

const NON_ANSWERABLE_KINDS: Array<FormQuestionSettings['kind']> = ['welcome', 'end', 'group', 'details'];
const NON_ANSWERABLE_CATEGORIES = new Set([
  'Welcome Screen',
  'End Screen',
  'Question Group',
  'Details Screen',
]);

export const isAnswerableQuestion = (question: FormQuestion) => {
  if (NON_ANSWERABLE_CATEGORIES.has(question.category)) {
    return false;
  }

  return !NON_ANSWERABLE_KINDS.includes(question.settings?.kind);
};

export const isFlowQuestion = (question: FormQuestion) => {
  if (question.settings?.kind === 'welcome' || question.category === 'Welcome Screen') {
    return false;
  }

  if (question.settings?.kind === 'end' || question.category === 'End Screen') {
    return false;
  }

  return true;
};

const getQuestionMap = (form: FormSchemaV0) => {
  return new Map(form.questions.map((question) => [question.id, question]));
};

export const getQuestionRangeIds = (
  form: FormSchemaV0,
  startQuestionId: number,
  endQuestionId: number
) => {
  const startIndex = form.questions.findIndex((question) => question.id === startQuestionId);
  const endIndex = form.questions.findIndex((question) => question.id === endQuestionId);
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return [];
  }
  return form.questions.slice(startIndex, endIndex + 1).map((question) => question.id);
};

export const getRepeatLoopForQuestion = (
  form: FormSchemaV0,
  questionId: number
): FormRepeatLoop | undefined => {
  return form.repeatLoops?.find((loop) =>
    getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId).includes(questionId)
  );
};

export const getRepeatLoopAfterQuestion = (
  form: FormSchemaV0,
  questionId: number
): FormRepeatLoop | undefined => {
  return form.repeatLoops?.find((loop) => loop.endQuestionId === questionId);
};

export const getRepeatLoopExitQuestionId = (form: FormSchemaV0, loop: FormRepeatLoop) => {
  return normalizeNextQuestionId(
    form,
    loop.exitQuestionId ?? getSequentialRawNextId(form, loop.endQuestionId)
  );
};

const getSequentialRawNextId = (form: FormSchemaV0, questionId: number) => {
  const index = form.questions.findIndex((question) => question.id === questionId);
  if (index === -1) return null;
  return form.questions[index + 1]?.id ?? null;
};

const normalizeNextQuestionId = (form: FormSchemaV0, rawNextId: number | null): number | null => {
  const questionMap = getQuestionMap(form);
  let currentId = rawNextId;

  while (currentId !== null) {
    const nextQuestion = questionMap.get(currentId);
    if (!nextQuestion) {
      return null;
    }

    if (nextQuestion.settings?.kind === 'end' || nextQuestion.category === 'End Screen') {
      return null;
    }

    if (isFlowQuestion(nextQuestion)) {
      return currentId;
    }

    currentId = getSequentialRawNextId(form, currentId);
  }

  return null;
};

export const getFirstAnswerableQuestionId = (form: FormSchemaV0) => {
  const firstQuestion = form.questions.find(isAnswerableQuestion);
  return firstQuestion?.id ?? null;
};

export const getFirstFlowQuestionId = (form: FormSchemaV0) => {
  const firstQuestion = form.questions.find(isFlowQuestion);
  return firstQuestion?.id ?? null;
};

export const inferQuestionAnswerType = (
  question: FormQuestion
): NonNullable<FormQuestionSettings['answerType']> => {
  if (question.settings?.answerType) {
    return question.settings.answerType;
  }

  switch (question.category) {
    case 'Multiple Choice':
      return 'multiple';
    case 'Text':
    case 'Short Text':
      return 'long';
    case 'Email':
      return 'email';
    case 'Number':
      return 'number';
    case 'Date':
      return 'date';
    case 'Yes/No':
    default:
      return 'yesno';
  }
};

const normalizeString = (value: string) => value.trim();

const isOtherAnswer = (value: string) => {
  const normalized = normalizeString(value);
  return normalized === 'Other' || normalized.startsWith('Other:');
};

const normalizeChoiceForBranching = (value: string) => (isOtherAnswer(value) ? 'Other' : value);

const parseMultipleAnswer = (rawAnswer: string) => {
  const separator = rawAnswer.includes('\n') ? '\n' : ',';
  return rawAnswer
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseStoredAnswerForQuestion = (
  question: FormQuestion,
  rawAnswer: string
): FormAnswerValue => {
  const answerType = inferQuestionAnswerType(question);
  const normalized = normalizeString(rawAnswer);

  if (answerType === 'yesno') {
    return normalized === 'yes';
  }

  if (answerType === 'multiple') {
    if (question.settings?.multipleSelection) {
      const selections = parseMultipleAnswer(normalized).map(normalizeChoiceForBranching);
      return selections;
    }
    return normalizeChoiceForBranching(normalized);
  }

  return normalized;
};

const hasAnswerValue = (answer: FormAnswerValue) => {
  if (typeof answer === 'boolean') return true;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === 'string') return answer.trim().length > 0;
  return false;
};

const compareStringValue = (actual: string, expected: string | number | boolean | undefined, operator: NonNullable<FormBranchCondition['when']['operator']>) => {
  const normalizedActual = actual.trim();
  const normalizedExpected = String(expected ?? '').trim();

  if (operator === 'equals') return normalizedActual === normalizedExpected;
  if (operator === 'not_equals') return normalizedActual !== normalizedExpected;
  if (operator === 'contains') return normalizedActual.includes(normalizedExpected);
  if (operator === 'not_contains') return !normalizedActual.includes(normalizedExpected);
  if (operator === 'is_empty') return normalizedActual.length === 0;
  if (operator === 'not_empty') return normalizedActual.length > 0;
  return false;
};

const compareNumberValue = (
  actual: string,
  expected: string | number | boolean | undefined,
  operator: NonNullable<FormBranchCondition['when']['operator']>
) => {
  const numericMatch = actual.trim().match(/^-?\d+(?:\.\d+)?/);
  const actualNumber = numericMatch ? Number(numericMatch[0]) : Number.NaN;
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber)) return false;

  if (operator === 'is_empty') return actual.trim().length === 0;
  if (operator === 'not_empty') return actual.trim().length > 0;
  if (!Number.isFinite(expectedNumber)) return false;

  if (operator === 'equals') return actualNumber === expectedNumber;
  if (operator === 'not_equals') return actualNumber !== expectedNumber;
  if (operator === 'greater_than') return actualNumber > expectedNumber;
  if (operator === 'greater_than_or_equal') return actualNumber >= expectedNumber;
  if (operator === 'less_than') return actualNumber < expectedNumber;
  if (operator === 'less_than_or_equal') return actualNumber <= expectedNumber;
  return false;
};

const compareArrayValue = (
  actual: string[],
  expected: string | number | boolean | undefined,
  operator: NonNullable<FormBranchCondition['when']['operator']>
) => {
  const normalizedActual = actual.map(normalizeChoiceForBranching);
  const normalizedExpected = String(expected ?? '').trim();

  if (operator === 'contains') return normalizedActual.includes(normalizedExpected);
  if (operator === 'not_contains') return !normalizedActual.includes(normalizedExpected);
  if (operator === 'equals') return normalizedActual.length === 1 && normalizedActual[0] === normalizedExpected;
  if (operator === 'not_equals') return !(normalizedActual.length === 1 && normalizedActual[0] === normalizedExpected);
  if (operator === 'is_empty') return normalizedActual.length === 0;
  if (operator === 'not_empty') return normalizedActual.length > 0;
  return false;
};

export const evaluateBranchCondition = (
  question: FormQuestion,
  answer: FormAnswerValue,
  condition: FormBranchCondition
) => {
  if (condition.when.answer !== undefined) {
    return typeof answer === 'boolean' && answer === condition.when.answer;
  }

  const operator = condition.when.operator;
  if (!operator) {
    return false;
  }

  if (!hasAnswerValue(answer)) {
    return operator === 'is_empty';
  }

  if (typeof answer === 'boolean') {
    if (operator === 'equals') return answer === Boolean(condition.when.value);
    if (operator === 'not_equals') return answer !== Boolean(condition.when.value);
    if (operator === 'not_empty') return true;
    return false;
  }

  if (Array.isArray(answer)) {
    return compareArrayValue(answer, condition.when.value, operator);
  }

  if (typeof answer !== 'string') {
    return false;
  }

  const answerType = inferQuestionAnswerType(question);
  if (answerType === 'number') {
    return compareNumberValue(answer, condition.when.value, operator);
  }
  if (answerType === 'multiple') {
    return compareStringValue(normalizeChoiceForBranching(answer), condition.when.value, operator);
  }

  return compareStringValue(answer, condition.when.value, operator);
};

export const getNextQuestionId = (
  form: FormSchemaV0,
  questionId: number,
  answer?: FormAnswerValue
): number | null => {
  const question = getQuestionMap(form).get(questionId);
  if (!question) {
    return null;
  }

  let rawNextId: number | null = null;

  if (question.branching?.conditions?.length) {
    const matched = question.branching.conditions.find((condition) =>
      evaluateBranchCondition(question, answer, condition)
    );
    rawNextId = matched?.next ?? null;
  }

  if (rawNextId === null && question.branching?.next !== undefined) {
    rawNextId = question.branching.next;
  }

  if (rawNextId === null) {
    rawNextId = getSequentialRawNextId(form, questionId);
  }

  return normalizeNextQuestionId(form, rawNextId);
};

const hasReachableConfiguredNext = (form: FormSchemaV0, question: FormQuestion) => {
  const defaultNext = normalizeNextQuestionId(form, question.branching?.next ?? null);
  if (defaultNext !== null) {
    return true;
  }

  return Boolean(
    question.branching?.conditions?.some((condition) => normalizeNextQuestionId(form, condition.next) !== null)
  );
};

export const getTerminalQuestionIds = (form: FormSchemaV0) => {
  return form.questions
    .filter(isAnswerableQuestion)
    .filter((question) => !hasReachableConfiguredNext(form, question))
    .map((question) => question.id);
};
