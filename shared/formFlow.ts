import type {
  FormBranchCondition,
  FormQuestion,
  FormQuestionSettings,
  FormSchemaV0,
} from '../src/types/formSchema';

export interface ResponsePathMeta {
  visitedQuestionIds?: number[];
  lastQuestionId?: number;
  completed?: boolean;
}

export type FormAnswerValue = boolean | string | string[] | undefined;

const NON_ANSWERABLE_KINDS: Array<FormQuestionSettings['kind']> = ['welcome', 'end', 'group'];
const NON_ANSWERABLE_CATEGORIES = new Set(['Welcome Screen', 'End Screen', 'Question Group']);

export const isAnswerableQuestion = (question: FormQuestion) => {
  if (NON_ANSWERABLE_CATEGORIES.has(question.category)) {
    return false;
  }

  return !NON_ANSWERABLE_KINDS.includes(question.settings?.kind);
};

const getQuestionMap = (form: FormSchemaV0) => {
  return new Map(form.questions.map((question) => [question.id, question]));
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

    if (isAnswerableQuestion(nextQuestion)) {
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

const parseMultipleAnswer = (rawAnswer: string) => {
  return rawAnswer
    .split(',')
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
    const selections = parseMultipleAnswer(normalized);
    if (question.settings?.multipleSelection) {
      return selections;
    }
    return selections[0] ?? normalized;
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
  const actualNumber = Number(actual);
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
  const normalizedExpected = String(expected ?? '').trim();

  if (operator === 'contains') return actual.includes(normalizedExpected);
  if (operator === 'not_contains') return !actual.includes(normalizedExpected);
  if (operator === 'equals') return actual.length === 1 && actual[0] === normalizedExpected;
  if (operator === 'not_equals') return !(actual.length === 1 && actual[0] === normalizedExpected);
  if (operator === 'is_empty') return actual.length === 0;
  if (operator === 'not_empty') return actual.length > 0;
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
