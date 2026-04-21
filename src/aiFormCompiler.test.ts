import { describe, expect, it } from 'vitest';
import type { AiFormSpec } from '../shared/aiFormSpec';
import { compileAiFormSpec } from '../shared/aiFormCompiler';

const createSpec = (overrides: Partial<AiFormSpec> = {}): AiFormSpec => ({
  version: 'v1',
  title: 'AI Discovery Form',
  description: 'A generated discovery form.',
  steps: [
    {
      stepRef: 'welcome',
      title: 'Welcome',
      kind: 'welcome',
      buttonLabel: 'Start',
      weight: 0,
      defaultGoToStepRef: 'budget',
    },
    {
      stepRef: 'budget',
      title: 'Do you have approved budget?',
      kind: 'yesno',
      required: true,
      weight: 5,
      branchConditions: [
        { answer: true, goToStepRef: 'team-size' },
        { answer: false, goToStepRef: 'end' },
      ],
    },
    {
      stepRef: 'team-size',
      title: 'How large is your team?',
      kind: 'number',
      description: 'Enter the total team size.',
      numberRange: { min: 1, max: 1000 },
      weight: 3,
      defaultGoToStepRef: 'end',
    },
    {
      stepRef: 'end',
      title: 'Thanks for your time',
      kind: 'end',
      buttonLabel: 'Finish',
      weight: 0,
    },
  ],
  results: [
    {
      label: 'Lower intent',
      description: 'Not ready yet.',
      maxScore: 4,
    },
    {
      label: 'Higher intent',
      description: 'Good fit.',
      minScore: 4,
    },
  ],
  theme: {
    primaryColor: '#177767',
  },
  ...overrides,
});

describe('aiFormCompiler', () => {
  it('compiles a valid AI form spec into a valid Census schema', () => {
    const { schema, errors } = compileAiFormSpec(createSpec(), { formId: 'draft-form' });

    expect(errors).toEqual([]);
    expect(schema).not.toBeNull();
    expect(schema?.id).toBe('draft-form');
    expect(schema?.title).toBe('AI Discovery Form');
    expect(schema?.questions).toHaveLength(4);
    expect(schema?.questions[0]).toMatchObject({
      id: 1,
      category: 'Welcome Screen',
      settings: { kind: 'welcome', buttonLabel: 'Start' },
      branching: { next: 2 },
    });
    expect(schema?.questions[1]).toMatchObject({
      id: 2,
      category: 'Yes/No',
      settings: { answerType: 'yesno', required: true },
      branching: {
        conditions: [
          { when: { answer: true }, next: 3 },
          { when: { answer: false }, next: 4 },
        ],
      },
    });
    expect(schema?.questions[2]).toMatchObject({
      id: 3,
      category: 'Number',
      settings: {
        answerType: 'number',
        description: 'Enter the total team size.',
        minNumberEnabled: true,
        minNumber: 1,
        maxNumberEnabled: true,
        maxNumber: 1000,
      },
      branching: { next: 4 },
    });
    expect(schema?.theme?.primaryColor).toBe('#177767');
    expect(schema?.theme?.fontFamily).toBe('Inter, sans-serif');
  });

  it('uses a deterministic slug when no formId is supplied', () => {
    const { schema, errors } = compileAiFormSpec(createSpec({ title: '   AI Generated Form   ' }));

    expect(errors).toEqual([]);
    expect(schema?.id).toBe('ai-generated-form');
  });

  it('returns AI spec validation errors instead of compiling invalid input', () => {
    const { schema, errors } = compileAiFormSpec(
      createSpec({
        steps: [
          {
            stepRef: 'q1',
            title: 'Pick one',
            kind: 'multiple',
            weight: 1,
            choices: [],
          },
        ],
      })
    );

    expect(schema).toBeNull();
    expect(errors).toContain('Step q1 must define at least one choice.');
  });

  it('compiles date and multiple-choice step settings into Census question settings', () => {
    const { schema, errors } = compileAiFormSpec(
      createSpec({
        steps: [
          {
            stepRef: 'welcome',
            title: 'Welcome',
            kind: 'welcome',
            weight: 0,
            defaultGoToStepRef: 'q1',
          },
          {
            stepRef: 'q1',
            title: 'Pick all that apply',
            kind: 'multiple',
            choices: ['A', 'B'],
            allowMultipleSelection: true,
            allowOtherOption: true,
            weight: 2,
            defaultGoToStepRef: 'q2',
          },
          {
            stepRef: 'q2',
            title: 'Preferred start date',
            kind: 'date',
            dateFormat: { order: 'DDMMYYYY', separator: '-' },
            weight: 1,
            defaultGoToStepRef: 'end',
          },
          {
            stepRef: 'end',
            title: 'Done',
            kind: 'end',
            weight: 0,
          },
        ],
      })
    );

    expect(errors).toEqual([]);
    expect(schema?.questions[1]).toMatchObject({
      category: 'Multiple Choice',
      settings: {
        answerType: 'multiple',
        choices: ['A', 'B'],
        multipleSelection: true,
        otherOption: true,
      },
    });
    expect(schema?.questions[2]).toMatchObject({
      category: 'Date',
      settings: {
        answerType: 'date',
        dateFormat: 'DDMMYYYY',
        dateSeparator: '-',
      },
    });
  });

  it('compiles operator-based branch conditions into Census branching rules', () => {
    const { schema, errors } = compileAiFormSpec(
      createSpec({
        steps: [
          {
            stepRef: 'welcome',
            title: 'Welcome',
            kind: 'welcome',
            weight: 0,
            defaultGoToStepRef: 'q1',
          },
          {
            stepRef: 'q1',
            title: 'Which products do you use?',
            kind: 'multiple',
            choices: ['Analytics', 'Billing', 'CRM'],
            allowMultipleSelection: true,
            weight: 1,
            branchConditions: [
              { operator: 'contains', value: 'CRM', goToStepRef: 'crm-follow-up' },
            ],
            defaultGoToStepRef: 'end',
          },
          {
            stepRef: 'crm-follow-up',
            title: 'CRM follow-up',
            kind: 'long',
            weight: 1,
            defaultGoToStepRef: 'end',
          },
          {
            stepRef: 'end',
            title: 'Done',
            kind: 'end',
            weight: 0,
          },
        ],
      })
    );

    expect(errors).toEqual([]);
    expect(schema?.questions[1]).toMatchObject({
      branching: {
        next: 4,
        conditions: [{ when: { operator: 'contains', value: 'CRM' }, next: 3 }],
      },
    });
  });
});
