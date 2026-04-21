import { describe, expect, it } from 'vitest';
import type { FormSchemaV0 } from './types/formSchema';
import {
  getFirstAnswerableQuestionId,
  getNextQuestionId,
  getTerminalQuestionIds,
} from '../shared/formFlow';

const createForm = (questions: FormSchemaV0['questions']): FormSchemaV0 => ({
  version: 'v0',
  id: 'test-form',
  title: 'Test form',
  questions,
  results: [],
});

describe('formFlow', () => {
  it('starts on the first answerable question after a welcome screen', () => {
    const form = createForm([
      { id: 1, text: 'Welcome', weight: 0, category: 'Welcome Screen', settings: { kind: 'welcome' } },
      { id: 2, text: 'Question', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    expect(getFirstAnswerableQuestionId(form)).toBe(2);
  });

  it('skips group screens when resolving the next question', () => {
    const form = createForm([
      { id: 1, text: 'Question 1', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 2, text: 'Section', weight: 0, category: 'Question Group', settings: { kind: 'group' } },
      { id: 3, text: 'Question 2', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    expect(getNextQuestionId(form, 1, true)).toBe(3);
  });

  it('treats a question before an end screen as terminal', () => {
    const form = createForm([
      { id: 1, text: 'Question 1', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 2, text: 'Done', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    expect(getNextQuestionId(form, 1, true)).toBeNull();
    expect(getTerminalQuestionIds(form)).toEqual([1]);
  });

  it('computes terminal questions for a branched form', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Branch',
        weight: 10,
        category: 'Yes/No',
        settings: { answerType: 'yesno' },
        branching: {
          conditions: [
            { when: { answer: true }, next: 2 },
            { when: { answer: false }, next: 4 },
          ],
        },
      },
      { id: 2, text: 'Path A', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 3, text: 'Done A', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
      { id: 4, text: 'Path B', weight: 10, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 5, text: 'Done B', weight: 0, category: 'End Screen', settings: { kind: 'end' } },
    ]);

    expect(getNextQuestionId(form, 1, true)).toBe(2);
    expect(getNextQuestionId(form, 1, false)).toBe(4);
    expect(getTerminalQuestionIds(form)).toEqual([2, 4]);
  });

  it('routes single-select multiple choice answers by exact match', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Pick one',
        weight: 1,
        category: 'Multiple Choice',
        settings: { answerType: 'multiple', choices: ['Alpha', 'Beta'] },
        branching: {
          next: 4,
          conditions: [{ when: { operator: 'equals', value: 'Beta' }, next: 3 }],
        },
      },
      { id: 2, text: 'Unused', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 3, text: 'Beta path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 4, text: 'Default path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    expect(getNextQuestionId(form, 1, 'Beta')).toBe(3);
    expect(getNextQuestionId(form, 1, 'Alpha')).toBe(4);
  });

  it('routes multi-select answers by contains operator', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Pick any',
        weight: 1,
        category: 'Multiple Choice',
        settings: {
          answerType: 'multiple',
          choices: ['Alpha', 'Beta', 'Gamma'],
          multipleSelection: true,
        },
        branching: {
          next: 4,
          conditions: [{ when: { operator: 'contains', value: 'Gamma' }, next: 3 }],
        },
      },
      { id: 2, text: 'Unused', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 3, text: 'Gamma path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 4, text: 'Default path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    expect(getNextQuestionId(form, 1, ['Alpha', 'Gamma'])).toBe(3);
    expect(getNextQuestionId(form, 1, ['Alpha'])).toBe(4);
  });

  it('routes numeric answers with comparison operators', () => {
    const form = createForm([
      {
        id: 1,
        text: 'Age',
        weight: 1,
        category: 'Number',
        settings: { answerType: 'number' },
        branching: {
          next: 4,
          conditions: [{ when: { operator: 'greater_than_or_equal', value: 18 }, next: 3 }],
        },
      },
      { id: 2, text: 'Unused', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 3, text: 'Adult path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
      { id: 4, text: 'Minor path', weight: 1, category: 'Yes/No', settings: { answerType: 'yesno' } },
    ]);

    expect(getNextQuestionId(form, 1, '21')).toBe(3);
    expect(getNextQuestionId(form, 1, '16')).toBe(4);
  });
});
