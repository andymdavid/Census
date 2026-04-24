import type { FormQuestion, FormQuestionSettings, FormSchemaV0, FormTheme } from '../src/types/formSchema';
import { validateFormSchema } from './formValidation';
import type { AiFormSpec, AiFormStep } from './aiFormSpec';
import { validateAiFormSpec } from './aiFormSpec';

const DEFAULT_THEME: FormTheme = {
  primaryColor: '#4f46e5',
  backgroundColor: '#f5f6fa',
  textColor: '#1f2937',
  fontFamily: 'Inter, sans-serif',
  logoUrl: '',
};

const categoryForStepKind = (kind: AiFormStep['kind']) => {
  switch (kind) {
    case 'welcome':
      return 'Welcome Screen';
    case 'end':
      return 'End Screen';
    case 'details':
      return 'Details Screen';
    case 'group':
      return 'Question Group';
    case 'multiple':
      return 'Multiple Choice';
    case 'email':
      return 'Email';
    case 'number':
      return 'Number';
    case 'date':
      return 'Date';
    case 'long':
      return 'Text';
    case 'yesno':
    default:
      return 'Yes/No';
  }
};

const settingsForStep = (step: AiFormStep): FormQuestionSettings => {
  const base: FormQuestionSettings = {};

  if (step.kind === 'welcome' || step.kind === 'end' || step.kind === 'group' || step.kind === 'details') {
    base.kind = step.kind;
  } else {
    base.answerType = step.kind;
  }

  if (step.description) {
    base.description = step.description;
  }

  if (step.required !== undefined) {
    base.required = step.required;
  }

  if (step.buttonLabel) {
    base.buttonLabel = step.buttonLabel;
  }

  if (step.kind === 'multiple') {
    base.choices = step.choices;
    base.multipleSelection = Boolean(step.allowMultipleSelection);
    base.otherOption = Boolean(step.allowOtherOption);
  }

  if (step.kind === 'number' && step.numberRange) {
    if (step.numberRange.min !== undefined) {
      base.minNumberEnabled = true;
      base.minNumber = step.numberRange.min;
    }
    if (step.numberRange.max !== undefined) {
      base.maxNumberEnabled = true;
      base.maxNumber = step.numberRange.max;
    }
  }

  if (step.kind === 'date' && step.dateFormat) {
    base.dateFormat = step.dateFormat.order;
    base.dateSeparator = step.dateFormat.separator;
  }

  return base;
};

const branchingForStep = (
  step: AiFormStep,
  stepIdByRef: Map<string, number>
): FormQuestion['branching'] | undefined => {
  const branching: NonNullable<FormQuestion['branching']> = {};

  if (step.defaultGoToStepRef) {
    const nextId = stepIdByRef.get(step.defaultGoToStepRef);
    if (nextId !== undefined) {
      branching.next = nextId;
    }
  }

  if (step.branchConditions?.length) {
    branching.conditions = step.branchConditions
      .map((condition) => {
        const nextId = stepIdByRef.get(condition.goToStepRef);
        if (nextId === undefined) {
          return null;
        }
        return {
          when:
            condition.answer !== undefined
              ? { answer: condition.answer }
              : {
                  operator: condition.operator,
                  value: condition.value,
                },
          next: nextId,
        };
      })
      .filter(Boolean) as NonNullable<FormQuestion['branching']>['conditions'];
  }

  if (branching.next === undefined && !branching.conditions?.length) {
    return undefined;
  }

  return branching;
};

const defaultFormIdFromTitle = (title: string) => {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'ai-generated-form';
};

export const compileAiFormSpec = (
  spec: AiFormSpec,
  options?: { formId?: string }
) => {
  const aiSpecErrors = validateAiFormSpec(spec);
  if (aiSpecErrors.length > 0) {
    return { schema: null, errors: aiSpecErrors };
  }

  const stepIdByRef = new Map(spec.steps.map((step, index) => [step.stepRef, index + 1]));

  const questions: FormQuestion[] = spec.steps.map((step) => ({
    id: stepIdByRef.get(step.stepRef)!,
    text: step.title,
    weight: step.weight ?? (step.kind === 'welcome' || step.kind === 'end' || step.kind === 'group' || step.kind === 'details' ? 0 : 1),
    category: categoryForStepKind(step.kind),
    settings: settingsForStep(step),
    branching: branchingForStep(step, stepIdByRef),
  }));

  const schema: FormSchemaV0 = {
    version: 'v0',
    id: options?.formId ?? defaultFormIdFromTitle(spec.title),
    title: spec.title,
    description: spec.description,
    scoringEnabled: spec.results.some(
      (result) => result.minScore !== undefined || result.maxScore !== undefined
    ),
    questions,
    results: spec.results.map((result) => ({
      label: result.label,
      description: result.description,
      minScore: result.minScore,
      maxScore: result.maxScore,
    })),
    theme: {
      ...DEFAULT_THEME,
      ...(spec.theme ?? {}),
    },
  };

  const schemaErrors = validateFormSchema(schema);
  if (schemaErrors.length > 0) {
    return { schema: null, errors: schemaErrors };
  }

  return { schema, errors: [] as string[] };
};
