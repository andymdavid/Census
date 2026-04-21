import type { FormBranchOperator, FormQuestionSettings, FormTheme } from '../src/types/formSchema';

export type AiAnswerType =
  | 'yesno'
  | 'multiple'
  | 'long'
  | 'email'
  | 'number'
  | 'date'
  | 'welcome'
  | 'end'
  | 'group';

export interface AiFormBranchCondition {
  answer?: boolean;
  operator?: FormBranchOperator;
  value?: string | number | boolean;
  goToStepRef: string;
}

export interface AiFormStep {
  stepRef: string;
  title: string;
  kind: AiAnswerType;
  description?: string;
  required?: boolean;
  choices?: string[];
  allowMultipleSelection?: boolean;
  allowOtherOption?: boolean;
  numberRange?: {
    min?: number;
    max?: number;
  };
  dateFormat?: {
    order: NonNullable<FormQuestionSettings['dateFormat']>;
    separator: NonNullable<FormQuestionSettings['dateSeparator']>;
  };
  weight?: number;
  defaultGoToStepRef?: string;
  branchConditions?: AiFormBranchCondition[];
  buttonLabel?: string;
}

export interface AiFormResultBand {
  label: string;
  description: string;
  minScore?: number;
  maxScore?: number;
}

export interface AiFormAssumption {
  type: 'assumption' | 'ambiguity';
  message: string;
}

export interface AiFormSpec {
  version: 'v1';
  title: string;
  description?: string;
  steps: AiFormStep[];
  results: AiFormResultBand[];
  theme?: Partial<FormTheme>;
  assumptions?: AiFormAssumption[];
}

const VALID_STEP_KINDS = new Set<AiAnswerType>([
  'yesno',
  'multiple',
  'long',
  'email',
  'number',
  'date',
  'welcome',
  'end',
  'group',
]);

const VALID_THEME_KEYS = new Set<keyof FormTheme>([
  'primaryColor',
  'backgroundColor',
  'textColor',
  'fontFamily',
  'logoUrl',
]);

const NON_QUESTION_KINDS = new Set<AiAnswerType>(['welcome', 'end', 'group']);

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const isAiFormSpec = (value: unknown): value is AiFormSpec => {
  if (!isObject(value)) return false;
  return (
    value.version === 'v1' &&
    typeof value.title === 'string' &&
    Array.isArray(value.steps) &&
    Array.isArray(value.results)
  );
};

const validateStep = (step: AiFormStep, allStepRefs: Set<string>) => {
  const errors: string[] = [];

  if (!step.stepRef.trim()) {
    errors.push('Each step must define a non-empty stepRef.');
  }

  if (!step.title.trim()) {
    errors.push(`Step ${step.stepRef || '(missing ref)'} is missing a title.`);
  }

  if (!VALID_STEP_KINDS.has(step.kind)) {
    errors.push(`Step ${step.stepRef || '(missing ref)'} has an invalid kind.`);
  }

  if (step.defaultGoToStepRef !== undefined && !allStepRefs.has(step.defaultGoToStepRef)) {
    errors.push(`Step ${step.stepRef} has an invalid defaultGoToStepRef.`);
  }

  if (step.branchConditions?.length) {
    if (NON_QUESTION_KINDS.has(step.kind)) {
      errors.push(`Step ${step.stepRef} cannot use branchConditions.`);
    }
    step.branchConditions.forEach((condition, index) => {
      if (!condition.goToStepRef.trim() || !allStepRefs.has(condition.goToStepRef)) {
        errors.push(`Step ${step.stepRef} branch condition ${index + 1} has an invalid goToStepRef.`);
      }

      if (condition.answer !== undefined && step.kind !== 'yesno') {
        errors.push(
          `Step ${step.stepRef} branch condition ${index + 1} uses boolean branching on a non-yes/no step.`
        );
      }

      if (condition.operator !== undefined) {
        if (
          (condition.operator === 'contains' || condition.operator === 'not_contains') &&
          !['multiple', 'long', 'email', 'date'].includes(step.kind)
        ) {
          errors.push(
            `Step ${step.stepRef} branch condition ${index + 1} uses an unsupported contains operator.`
          );
        }

        if (
          [
            'greater_than',
            'greater_than_or_equal',
            'less_than',
            'less_than_or_equal',
          ].includes(condition.operator) &&
          step.kind !== 'number'
        ) {
          errors.push(
            `Step ${step.stepRef} branch condition ${index + 1} uses numeric comparison on a non-number step.`
          );
        }

        if (
          condition.operator !== 'is_empty' &&
          condition.operator !== 'not_empty' &&
          condition.value === undefined &&
          condition.answer === undefined
        ) {
          errors.push(
            `Step ${step.stepRef} branch condition ${index + 1} is missing a comparison value.`
          );
        }
      } else if (condition.answer === undefined) {
        errors.push(`Step ${step.stepRef} branch condition ${index + 1} is missing a branching rule.`);
      }
    });

    const uniqueConditions = new Set(
      step.branchConditions.map((condition) =>
        JSON.stringify({
          answer: condition.answer,
          operator: condition.operator,
          value: condition.value,
        })
      )
    );
    if (uniqueConditions.size !== step.branchConditions.length) {
      errors.push(`Step ${step.stepRef} has duplicate branch conditions.`);
    }
  }

  if (step.kind === 'multiple') {
    const choices = step.choices ?? [];
    if (choices.length === 0) {
      errors.push(`Step ${step.stepRef} must define at least one choice.`);
    }
    if (choices.some((choice) => !choice.trim())) {
      errors.push(`Step ${step.stepRef} has an empty choice label.`);
    }
    if (new Set(choices.map((choice) => choice.trim())).size !== choices.length) {
      errors.push(`Step ${step.stepRef} has duplicate choice labels.`);
    }
  } else if (step.choices?.length) {
    errors.push(`Step ${step.stepRef} can only define choices for multiple-choice steps.`);
  }

  if (step.allowMultipleSelection && step.kind !== 'multiple') {
    errors.push(`Step ${step.stepRef} can only enable multiple selection for multiple-choice steps.`);
  }

  if (step.allowOtherOption && step.kind !== 'multiple') {
    errors.push(`Step ${step.stepRef} can only enable "Other" for multiple-choice steps.`);
  }

  if (step.numberRange) {
    if (step.kind !== 'number') {
      errors.push(`Step ${step.stepRef} can only define numberRange for number steps.`);
    }
    const { min, max } = step.numberRange;
    if (min !== undefined && !isFiniteNumber(min)) {
      errors.push(`Step ${step.stepRef} has an invalid minimum number.`);
    }
    if (max !== undefined && !isFiniteNumber(max)) {
      errors.push(`Step ${step.stepRef} has an invalid maximum number.`);
    }
    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`Step ${step.stepRef} has min number greater than max number.`);
    }
  }

  if (step.dateFormat) {
    if (step.kind !== 'date') {
      errors.push(`Step ${step.stepRef} can only define dateFormat for date steps.`);
    }
  }

  if (step.weight !== undefined) {
    if (!isFiniteNumber(step.weight)) {
      errors.push(`Step ${step.stepRef} has an invalid weight.`);
    }
    if (NON_QUESTION_KINDS.has(step.kind) && step.weight !== 0) {
      errors.push(`Step ${step.stepRef} must use weight 0 for non-question steps.`);
    }
  }

  return errors;
};

export const validateAiFormSpec = (spec: AiFormSpec) => {
  const errors: string[] = [];

  if (!spec.title.trim()) {
    errors.push('Form title is required.');
  }

  if (spec.steps.length === 0) {
    errors.push('At least one step is required.');
  }

  const stepRefs = spec.steps.map((step) => step.stepRef);
  const uniqueStepRefs = new Set(stepRefs);

  if (uniqueStepRefs.size !== stepRefs.length) {
    errors.push('Step refs must be unique.');
  }

  spec.steps.forEach((step) => {
    errors.push(...validateStep(step, uniqueStepRefs));
  });

  const welcomeSteps = spec.steps.filter((step) => step.kind === 'welcome');
  const endSteps = spec.steps.filter((step) => step.kind === 'end');
  if (welcomeSteps.length > 1) {
    errors.push('Only one welcome step is allowed.');
  }
  if (endSteps.length > 1) {
    errors.push('Only one end step is allowed.');
  }

  if (spec.results.length === 0) {
    errors.push('At least one result band is required.');
  }

  spec.results.forEach((result, index) => {
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

  if (spec.theme) {
    Object.entries(spec.theme).forEach(([key, value]) => {
      if (!VALID_THEME_KEYS.has(key as keyof FormTheme)) {
        errors.push(`Theme key ${key} is not supported.`);
        return;
      }
      if (value !== undefined && typeof value !== 'string') {
        errors.push(`Theme key ${key} must be a string.`);
      }
    });
  }

  spec.assumptions?.forEach((item, index) => {
    if (!item.message.trim()) {
      errors.push(`Assumption ${index + 1} is missing a message.`);
    }
    if (item.type !== 'assumption' && item.type !== 'ambiguity') {
      errors.push(`Assumption ${index + 1} has an invalid type.`);
    }
  });

  return errors;
};

export const parseAndValidateAiFormSpec = (value: unknown) => {
  if (!isAiFormSpec(value)) {
    return { spec: null, errors: ['Invalid AI form spec.'] };
  }

  return {
    spec: value,
    errors: validateAiFormSpec(value),
  };
};
