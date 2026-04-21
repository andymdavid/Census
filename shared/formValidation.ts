import type { FormQuestion, FormQuestionSettings, FormSchemaV0 } from '../src/types/formSchema';
import {
  getNextQuestionId,
  inferQuestionAnswerType,
  isAnswerableQuestion,
  parseStoredAnswerForQuestion,
} from './formFlow';

export interface ResponseSubmissionPayload {
  answers: Array<{ questionId: string; answer: string }>;
  score: number;
  meta?: unknown;
  completed?: boolean;
}

interface ParsedResponseMeta {
  visitedQuestionIds?: number[];
  lastQuestionId?: number;
  completed?: boolean;
}

const VALID_DATE_FORMATS = new Set<NonNullable<FormQuestionSettings['dateFormat']>>([
  'MMDDYYYY',
  'DDMMYYYY',
  'YYYYMMDD',
]);

const VALID_DATE_SEPARATORS = new Set<NonNullable<FormQuestionSettings['dateSeparator']>>([
  '/',
  '-',
  '.',
]);

const VALID_QUESTION_KINDS = new Set<NonNullable<FormQuestionSettings['kind']>>([
  'welcome',
  'end',
  'group',
  'yesno',
  'multiple',
  'short',
  'long',
  'email',
  'number',
  'date',
]);

const VALID_ANSWER_TYPES = new Set<NonNullable<FormQuestionSettings['answerType']>>([
  'multiple',
  'yesno',
  'short',
  'long',
  'email',
  'number',
  'date',
]);

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isLeapYear = (year: number) => {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
};

const getDaysInMonth = (year: number, month: number) => {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
};

const isValidConfiguredDate = (
  normalized: string,
  format: NonNullable<FormQuestionSettings['dateFormat']>,
  separator: NonNullable<FormQuestionSettings['dateSeparator']>
) => {
  const escapedSeparator = escapeRegExp(separator);
  const pattern =
    format === 'DDMMYYYY'
      ? new RegExp(`^(\\d{2})${escapedSeparator}(\\d{2})${escapedSeparator}(\\d{4})$`)
      : format === 'YYYYMMDD'
        ? new RegExp(`^(\\d{4})${escapedSeparator}(\\d{2})${escapedSeparator}(\\d{2})$`)
        : new RegExp(`^(\\d{2})${escapedSeparator}(\\d{2})${escapedSeparator}(\\d{4})$`);
  const match = normalized.match(pattern);
  if (!match) {
    return false;
  }

  let year: number;
  let month: number;
  let day: number;

  if (format === 'DDMMYYYY') {
    [, day, month, year] = match.map(Number);
  } else if (format === 'YYYYMMDD') {
    [, year, month, day] = match.map(Number);
  } else {
    [, month, day, year] = match.map(Number);
  }

  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > getDaysInMonth(year, month)) {
    return false;
  }
  return true;
};

const parseMultipleAnswer = (answer: string) => {
  return answer
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const isFormSchemaV0 = (value: unknown): value is FormSchemaV0 => {
  if (!isObject(value)) return false;
  return (
    value.version === 'v0' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.questions) &&
    Array.isArray(value.results)
  );
};

export const validateFormSchema = (schema: FormSchemaV0) => {
  const errors: string[] = [];
  const ids = schema.questions.map((question) => question.id);
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    errors.push('Question IDs must be unique.');
  }

  schema.questions.forEach((question) => {
    if (!Number.isInteger(question.id) || question.id <= 0) {
      errors.push(`Question ${question.id} has an invalid ID.`);
    }
    if (!question.text.trim()) {
      errors.push(`Question ${question.id} is missing text.`);
    }
    if (!question.category.trim()) {
      errors.push(`Question ${question.id} is missing a category.`);
    }
    if (!Number.isFinite(question.weight)) {
      errors.push(`Question ${question.id} has an invalid weight.`);
    }

    const kind = question.settings?.kind;
    if (kind && !VALID_QUESTION_KINDS.has(kind)) {
      errors.push(`Question ${question.id} has an invalid kind.`);
    }

    const answerType = question.settings?.answerType;
    if (answerType && !VALID_ANSWER_TYPES.has(answerType)) {
      errors.push(`Question ${question.id} has an invalid answer type.`);
    }

    if (inferQuestionAnswerType(question) === 'multiple') {
      const choices = question.settings?.choices ?? [];
      if (!Array.isArray(choices) || choices.length === 0) {
        errors.push(`Question ${question.id} must define at least one choice.`);
      }
      if (choices.some((choice) => !choice.trim())) {
        errors.push(`Question ${question.id} has an empty choice label.`);
      }
      if (new Set(choices.map((choice) => choice.trim())).size !== choices.length) {
        errors.push(`Question ${question.id} has duplicate choice labels.`);
      }
    }

    if (inferQuestionAnswerType(question) === 'number') {
      if (
        question.settings?.minNumberEnabled &&
        (typeof question.settings.minNumber !== 'number' || !Number.isFinite(question.settings.minNumber))
      ) {
        errors.push(`Question ${question.id} has an invalid minimum number.`);
      }
      if (
        question.settings?.maxNumberEnabled &&
        (typeof question.settings.maxNumber !== 'number' || !Number.isFinite(question.settings.maxNumber))
      ) {
        errors.push(`Question ${question.id} has an invalid maximum number.`);
      }
      if (
        question.settings?.minNumberEnabled &&
        question.settings?.maxNumberEnabled &&
        (question.settings.minNumber ?? 0) > (question.settings.maxNumber ?? 0)
      ) {
        errors.push(`Question ${question.id} has min number greater than max number.`);
      }
    }

    if (inferQuestionAnswerType(question) === 'date') {
      if (question.settings?.dateFormat && !VALID_DATE_FORMATS.has(question.settings.dateFormat)) {
        errors.push(`Question ${question.id} has an invalid date format.`);
      }
      if (
        question.settings?.dateSeparator &&
        !VALID_DATE_SEPARATORS.has(question.settings.dateSeparator)
      ) {
        errors.push(`Question ${question.id} has an invalid date separator.`);
      }
    }

    const branching = question.branching;
    if (branching?.next !== undefined && !uniqueIds.has(branching.next)) {
      errors.push(`Question ${question.id} has an invalid default next target.`);
    }

    branching?.conditions?.forEach((condition, index) => {
      if (!uniqueIds.has(condition.next)) {
        errors.push(`Question ${question.id} condition ${index + 1} has an invalid next target.`);
      }

      const answerType = inferQuestionAnswerType(question);
      if (condition.when.answer !== undefined && answerType !== 'yesno') {
        errors.push(`Question ${question.id} condition ${index + 1} uses boolean branching on a non-yes/no question.`);
      }

      if (condition.when.operator !== undefined) {
        const operator = condition.when.operator;
        const value = condition.when.value;

        if (operator === 'contains' || operator === 'not_contains') {
          if (!['multiple', 'long', 'email', 'date'].includes(answerType)) {
            errors.push(`Question ${question.id} condition ${index + 1} uses an unsupported contains operator.`);
          }
          if (value === undefined || value === '') {
            errors.push(`Question ${question.id} condition ${index + 1} is missing a comparison value.`);
          }
        }

        if (
          ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(
            operator
          ) &&
          answerType !== 'number'
        ) {
          errors.push(`Question ${question.id} condition ${index + 1} uses numeric comparison on a non-number question.`);
        }

        if (operator !== 'is_empty' && operator !== 'not_empty' && value === undefined && condition.when.answer === undefined) {
          errors.push(`Question ${question.id} condition ${index + 1} is missing a comparison value.`);
        }
      } else if (condition.when.answer === undefined) {
        errors.push(`Question ${question.id} condition ${index + 1} is missing a branching rule.`);
      }
    });
  });

  schema.results.forEach((result, index) => {
    if (!result.label.trim()) {
      errors.push(`Result ${index + 1} is missing a label.`);
    }
    if (!result.description.trim()) {
      errors.push(`Result ${index + 1} is missing a description.`);
    }
    if (
      result.minScore !== undefined &&
      result.maxScore !== undefined &&
      result.minScore > result.maxScore
    ) {
      errors.push(`Result ${index + 1} has min score greater than max score.`);
    }
  });

  return errors;
};

export const parseAndValidateFormSchema = (value: unknown) => {
  if (!isFormSchemaV0(value)) {
    return { schema: null, errors: ['Invalid form schema.'] };
  }

  const errors = validateFormSchema(value);
  return {
    schema: value,
    errors,
  };
};

const parseResponseMeta = (value: unknown): ParsedResponseMeta | null => {
  if (value === undefined) return {};
  if (!isObject(value)) return null;

  const visitedQuestionIds = value.visitedQuestionIds;
  const lastQuestionId = value.lastQuestionId;
  const completed = value.completed;

  if (
    visitedQuestionIds !== undefined &&
    (!Array.isArray(visitedQuestionIds) ||
      visitedQuestionIds.some((id) => !Number.isInteger(id) || id <= 0))
  ) {
    return null;
  }

  if (
    lastQuestionId !== undefined &&
    (typeof lastQuestionId !== 'number' ||
      !Number.isInteger(lastQuestionId) ||
      lastQuestionId <= 0)
  ) {
    return null;
  }

  if (completed !== undefined && typeof completed !== 'boolean') {
    return null;
  }

  return {
    visitedQuestionIds: visitedQuestionIds as number[] | undefined,
    lastQuestionId: lastQuestionId as number | undefined,
    completed: completed as boolean | undefined,
  };
};

const isValidAnswerForQuestion = (question: FormQuestion, answer: string) => {
  const answerType = inferQuestionAnswerType(question);
  const normalized = answer.trim();

  if (answerType === 'yesno') {
    return normalized === 'yes' || normalized === 'no';
  }

  if (answerType === 'email') {
    return normalized.length > 0 && /\S+@\S+\.\S+/.test(normalized);
  }

  if (answerType === 'number') {
    if (!normalized.length) return false;
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      return false;
    }
    if (question.settings?.minNumberEnabled && value < (question.settings.minNumber ?? 0)) {
      return false;
    }
    if (question.settings?.maxNumberEnabled && value > (question.settings.maxNumber ?? 0)) {
      return false;
    }
    return true;
  }

  if (answerType === 'multiple') {
    if (!normalized.length) return false;
    const selections = parseMultipleAnswer(normalized);
    if (selections.length === 0) {
      return false;
    }
    const allowedChoices = new Set((question.settings?.choices ?? []).map((choice) => choice.trim()));
    if (question.settings?.otherOption) {
      allowedChoices.add('Other');
    }
    return selections.every((selection) => allowedChoices.has(selection));
  }

  if (answerType === 'date') {
    if (!normalized.length) return false;
    const format = question.settings?.dateFormat ?? 'MMDDYYYY';
    const separator = question.settings?.dateSeparator ?? '/';
    return isValidConfiguredDate(normalized, format, separator);
  }

  return normalized.length > 0;
};

const scoreContributionForAnswer = (question: FormQuestion, answer: string) => {
  const answerType = inferQuestionAnswerType(question);
  const normalized = answer.trim();

  if (answerType === 'yesno') {
    return normalized === 'yes' ? question.weight : 0;
  }

  return normalized.length > 0 ? question.weight : 0;
};

export const validateResponseSubmission = (
  schema: FormSchemaV0,
  payload: ResponseSubmissionPayload
) => {
  const errors: string[] = [];
  const answerableQuestions = schema.questions.filter(isAnswerableQuestion);
  const answerableQuestionIds = new Set(answerableQuestions.map((question) => question.id));
  const questionById = new Map(answerableQuestions.map((question) => [question.id, question]));
  const meta = parseResponseMeta(payload.meta);
  const completed = payload.completed ?? false;
  let computedScore = 0;
  const answerById = new Map<number, string>();

  if (typeof payload.score !== 'number' || !Number.isFinite(payload.score)) {
    errors.push('Score must be a finite number.');
  }

  if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
    errors.push('At least one answer is required.');
  }

  if (!meta) {
    errors.push('Invalid response metadata.');
  }

  const answerIds = new Set<number>();
  payload.answers.forEach((item, index) => {
    const numericQuestionId = Number(item.questionId);
    if (!Number.isInteger(numericQuestionId) || !answerableQuestionIds.has(numericQuestionId)) {
      errors.push(`Answer ${index + 1} targets an invalid question.`);
      return;
    }
    if (answerIds.has(numericQuestionId)) {
      errors.push(`Question ${numericQuestionId} has duplicate answers.`);
      return;
    }
    answerIds.add(numericQuestionId);

    const question = questionById.get(numericQuestionId);
    if (!question || !isValidAnswerForQuestion(question, item.answer)) {
      errors.push(`Question ${numericQuestionId} has an invalid answer value.`);
      return;
    }
    answerById.set(numericQuestionId, item.answer);
    computedScore += scoreContributionForAnswer(question, item.answer);
  });

  if (meta?.visitedQuestionIds?.length) {
    const visitedIds = new Set(meta.visitedQuestionIds);
    answerIds.forEach((questionId) => {
      if (!visitedIds.has(questionId)) {
        errors.push(`Answered question ${questionId} is missing from the recorded path.`);
      }
    });
    if (meta.lastQuestionId !== undefined && !visitedIds.has(meta.lastQuestionId)) {
      errors.push('The recorded last question is missing from the response path.');
    }
  }

  if (meta?.lastQuestionId !== undefined && !answerableQuestionIds.has(meta.lastQuestionId)) {
    errors.push('The recorded last question is invalid.');
  }

  if (completed) {
    if (meta?.completed !== true) {
      errors.push('Completed responses must record completed metadata.');
    }
    const lastQuestion =
      meta?.lastQuestionId !== undefined ? questionById.get(meta.lastQuestionId) : undefined;
    const lastRawAnswer =
      meta?.lastQuestionId !== undefined ? answerById.get(meta.lastQuestionId) : undefined;
    const resolvedNext =
      lastQuestion && lastRawAnswer !== undefined
        ? getNextQuestionId(schema, lastQuestion.id, parseStoredAnswerForQuestion(lastQuestion, lastRawAnswer))
        : null;
    if (meta?.lastQuestionId === undefined || !lastQuestion || resolvedNext !== null) {
      errors.push('Completed responses must end on a terminal question.');
    }
  } else if (meta?.completed === true) {
    errors.push('Draft responses cannot mark metadata as completed.');
  }

  if (errors.length === 0 && payload.score !== computedScore) {
    errors.push(`Score does not match answers. Expected ${computedScore}.`);
  }

  return errors;
};
