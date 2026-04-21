import { describe, expect, it } from 'vitest';
import type { AiFormSpec } from '../shared/aiFormSpec';
import { parseAndValidateAiFormSpec, validateAiFormSpec } from '../shared/aiFormSpec';

const createSpec = (overrides: Partial<AiFormSpec> = {}): AiFormSpec => ({
  version: 'v1',
  title: 'AI Generated Form',
  description: 'A generated form spec.',
  steps: [
    {
      stepRef: 'welcome',
      title: 'Welcome',
      kind: 'welcome',
      buttonLabel: 'Start',
      weight: 0,
      defaultGoToStepRef: 'q1',
    },
    {
      stepRef: 'q1',
      title: 'Do you have budget approval?',
      kind: 'yesno',
      required: true,
      weight: 5,
      branchConditions: [
        { answer: true, goToStepRef: 'q2' },
        { answer: false, goToStepRef: 'end' },
      ],
    },
    {
      stepRef: 'q2',
      title: 'What is your team size?',
      kind: 'number',
      weight: 3,
      numberRange: { min: 1, max: 5000 },
      defaultGoToStepRef: 'end',
    },
    {
      stepRef: 'end',
      title: 'Thanks',
      kind: 'end',
      buttonLabel: 'Finish',
      weight: 0,
    },
  ],
  results: [
    {
      label: 'Low fit',
      description: 'Not ready yet.',
      maxScore: 4,
    },
    {
      label: 'High fit',
      description: 'Strong fit.',
      minScore: 4,
    },
  ],
  theme: {
    primaryColor: '#177767',
  },
  assumptions: [{ type: 'assumption', message: 'Budget approval is a strong buying signal.' }],
  ...overrides,
});

describe('aiFormSpec', () => {
  it('accepts a valid AI form spec', () => {
    expect(validateAiFormSpec(createSpec())).toEqual([]);
  });

  it('rejects duplicate step refs', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'Question 1',
          kind: 'yesno',
          weight: 1,
        },
        {
          stepRef: 'q1',
          title: 'Question 2',
          kind: 'yesno',
          weight: 1,
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toContain('Step refs must be unique.');
  });

  it('rejects invalid multiple-choice configuration', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'Choose one',
          kind: 'multiple',
          choices: ['Alpha', 'Alpha'],
          weight: 1,
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toContain('Step q1 has duplicate choice labels.');
  });

  it('rejects invalid number ranges', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'Number',
          kind: 'number',
          weight: 1,
          numberRange: { min: 10, max: 5 },
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toContain('Step q1 has min number greater than max number.');
  });

  it('accepts operator-based branching on non-boolean steps', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'What is your team size?',
          kind: 'number',
          weight: 1,
          branchConditions: [
            { operator: 'greater_than_or_equal', value: 50, goToStepRef: 'end' },
          ],
        },
        {
          stepRef: 'end',
          title: 'Done',
          kind: 'end',
          weight: 0,
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toEqual([]);
  });

  it('rejects boolean branching on non-yes-no steps', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'Pick one',
          kind: 'multiple',
          choices: ['Alpha', 'Beta'],
          weight: 1,
          branchConditions: [{ answer: true, goToStepRef: 'end' }],
        },
        {
          stepRef: 'end',
          title: 'Done',
          kind: 'end',
          weight: 0,
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toContain(
      'Step q1 branch condition 1 uses boolean branching on a non-yes/no step.'
    );
  });

  it('rejects unsupported operators for a step kind', () => {
    const spec = createSpec({
      steps: [
        {
          stepRef: 'q1',
          title: 'Team size',
          kind: 'number',
          weight: 1,
          branchConditions: [{ operator: 'contains', value: '5', goToStepRef: 'end' }],
        },
        {
          stepRef: 'end',
          title: 'Done',
          kind: 'end',
          weight: 0,
        },
      ],
    });

    expect(validateAiFormSpec(spec)).toContain(
      'Step q1 branch condition 1 uses an unsupported contains operator.'
    );
  });

  it('rejects invalid shapes during parse', () => {
    const { spec, errors } = parseAndValidateAiFormSpec({
      version: 'v1',
      title: 'Bad',
      steps: 'not-an-array',
    });

    expect(spec).toBeNull();
    expect(errors).toEqual(['Invalid AI form spec.']);
  });
});
