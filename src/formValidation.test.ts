import { describe, expect, it } from 'vitest';
import type { FormSchemaV0 } from './types/formSchema';
import {
  parseAndValidateFormSchema,
  validateResponseSubmission,
} from '../shared/formValidation';

const createForm = (questions: FormSchemaV0['questions']): FormSchemaV0 => ({
  version: 'v0',
  id: 'test-form',
  title: 'Test form',
  questions,
  results: [{ label: 'Default', description: 'Default result' }],
});

describe('formValidation', () => {
  it('rejects schemas with duplicate question ids', () => {
    const form = createForm([
      { id: 1, text: 'A', weight: 1, category: 'Yes/No' },
      { id: 1, text: 'B', weight: 1, category: 'Yes/No' },
    ]);

    const { errors } = parseAndValidateFormSchema(form);
    expect(errors).toContain('Question IDs must be unique.');
  });

  it('accepts operator-based branching on supported question types', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Age',
        weight: 1,
        category: 'Number',
        settings: { answerType: 'number' },
        branching: {
          next: 2,
          conditions: [{ when: { operator: 'greater_than', value: 17 }, next: 2 }],
        },
      },
      { id: 2, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    const { errors } = parseAndValidateFormSchema(form);
    expect(errors).toEqual([]);
  });

  it('rejects unsupported branching operators for the question type', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Age',
        weight: 1,
        category: 'Number',
        settings: { answerType: 'number' },
        branching: {
          next: 2,
          conditions: [{ when: { operator: 'contains', value: '1' }, next: 2 }],
        },
      },
      { id: 2, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    const { errors } = parseAndValidateFormSchema(form);
    expect(errors).toContain(
      'Question 1 condition 1 uses an unsupported contains operator.'
    );
  });

  it('accepts completed responses on operator-based terminal branches', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Pick one',
        weight: 1,
        category: 'Multiple Choice',
        settings: { answerType: 'multiple', choices: ['Alpha', 'Beta'] },
        branching: {
          conditions: [{ when: { operator: 'equals', value: 'Beta' }, next: 3 }],
          next: 2,
        },
      },
      { id: 2, text: 'Continue', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 3, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'Beta' }],
      score: 1,
      completed: true,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: true,
      },
    });

    expect(errors).toEqual([]);
  });

  it('accepts a valid completed response submission', () => {
    const form = createForm([
      { id: 1, text: 'Question', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 2, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'yes' }],
      score: 1,
      completed: true,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: true,
      },
    });

    expect(errors).toEqual([]);
  });

  it('rejects completed responses that do not end on a terminal question', () => {
    const form = createForm([
      { id: 1, text: 'Question 1', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 2, text: 'Question 2', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'yes' }],
      score: 1,
      completed: true,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: true,
      },
    });

    expect(errors).toContain('Completed responses must end on a terminal question.');
  });

  it('rejects answer values that do not match the question type', () => {
    const form = createForm([
      { id: 1, text: 'Email', weight: 1, category: 'Email', settings: { answerType: 'email' } },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'not-an-email' }],
      score: 1,
      completed: false,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: false,
      },
    });

    expect(errors).toContain('Question 1 has an invalid answer value.');
  });

  it('rejects multiple-choice answers that are not in the configured choices', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Pick one',
        weight: 1,
        category: 'Multiple Choice',
        settings: { answerType: 'multiple', choices: ['Alpha', 'Beta'] },
      },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'Gamma' }],
      score: 1,
      completed: false,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: false,
      },
    });

    expect(errors).toContain('Question 1 has an invalid answer value.');
  });

  it('rejects numeric answers outside configured min and max bounds', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Amount',
        weight: 1,
        category: 'Number',
        settings: {
          answerType: 'number',
          minNumberEnabled: true,
          minNumber: 10,
          maxNumberEnabled: true,
          maxNumber: 20,
        },
      },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: '25' }],
      score: 1,
      completed: false,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: false,
      },
    });

    expect(errors).toContain('Question 1 has an invalid answer value.');
  });

  it('rejects dates that do not match the configured format', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Date',
        weight: 1,
        category: 'Date',
        settings: {
          answerType: 'date',
          dateFormat: 'DDMMYYYY',
          dateSeparator: '-',
        },
      },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: '2026-04-21' }],
      score: 1,
      completed: false,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: false,
      },
    });

    expect(errors).toContain('Question 1 has an invalid answer value.');
  });

  it('rejects responses whose score does not match the answers', () => {
    const form = createForm([
      { id: 1, text: 'Question', weight: 3, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 2, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    const errors = validateResponseSubmission(form, {
      answers: [{ questionId: '1', answer: 'no' }],
      score: 3,
      completed: true,
      meta: {
        visitedQuestionIds: [1],
        lastQuestionId: 1,
        completed: true,
      },
    });

    expect(errors).toContain('Score does not match answers. Expected 0.');
  });
});
