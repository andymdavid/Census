import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { FormSchemaV0 } from './types/formSchema';

const createPublicBranchedForm = (): FormSchemaV0 => ({
  version: 'v0',
  id: 'public-flow-form',
  title: 'Public Flow Form',
  description: 'A test form for the public flow.',
  questions: [
    {
      id: 1,
      text: 'Welcome to the form',
      weight: 0,
      category: 'Welcome Screen',
      settings: { kind: 'welcome', buttonLabel: 'Begin' },
    },
    {
      id: 2,
      text: 'Do you want the primary path?',
      weight: 1,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
      branching: {
        conditions: [
          { when: { answer: true }, next: 3 },
          { when: { answer: false }, next: 4 },
        ],
      },
    },
    {
      id: 3,
      text: 'Primary path question',
      weight: 2,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
    {
      id: 4,
      text: 'All done',
      weight: 0,
      category: 'End Screen',
      settings: { kind: 'end', buttonLabel: 'Close' },
    },
    {
      id: 5,
      text: 'Secondary path question',
      weight: 2,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
    {
      id: 6,
      text: 'All done',
      weight: 0,
      category: 'End Screen',
      settings: { kind: 'end', buttonLabel: 'Close' },
    },
  ],
  results: [{ label: 'Complete', description: 'Done' }],
});

const createRepeatLoopForm = (): FormSchemaV0 => ({
  version: 'v0',
  id: 'repeat-loop-form',
  title: 'Repeat Loop Form',
  questions: [
    {
      id: 1,
      text: 'Process name',
      weight: 0,
      category: 'Text',
      settings: { answerType: 'long' },
    },
    {
      id: 2,
      text: 'Is this process documented?',
      weight: 0,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
    {
      id: 3,
      text: 'Finished',
      weight: 0,
      category: 'End Screen',
      settings: { kind: 'end', buttonLabel: 'Close' },
    },
  ],
  repeatLoops: [
    {
      id: 'process-loop',
      label: 'Process',
      pluralLabel: 'Processes',
      startQuestionId: 1,
      endQuestionId: 2,
      exitQuestionId: 3,
      titleQuestionId: 1,
      addAnotherLabel: 'Add another process',
      continueLabel: 'Continue',
    },
  ],
  results: [],
});

describe('Public form flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/f/public-flow-form');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads a published form, follows the chosen branch, and persists draft then final responses', async () => {
    const form = createPublicBranchedForm();
    const fetchMock = vi.spyOn(global, 'fetch');
    const responsePayloads: Array<{
      responseId?: string;
      answers: Array<{ questionId: string; answer: string }>;
      completed: boolean;
      meta?: {
        visitedQuestionIds?: number[];
        lastQuestionId?: number;
        completed?: boolean;
        draftToken?: string;
      };
    }> = [];

    fetchMock.mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? 'GET';

      if (url === '/api/forms/public-flow-form/public' && method === 'GET') {
        return new Response(JSON.stringify({ schema: form }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        url.startsWith('/api/forms/public-flow-form/responses/draft-status') &&
        method === 'GET'
      ) {
        return new Response(JSON.stringify({ resetRequired: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        url.startsWith('/api/forms/public-flow-form/responses/draft-resume') &&
        method === 'GET'
      ) {
        return new Response(JSON.stringify({ draft: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/forms/public-flow-form/responses' && method === 'POST') {
        const rawBody = init?.body;
        const payload =
          typeof rawBody === 'string'
            ? (JSON.parse(rawBody) as {
                responseId?: string;
                answers: Array<{ questionId: string; answer: string }>;
                completed: boolean;
                meta?: {
                  visitedQuestionIds?: number[];
                  lastQuestionId?: number;
                  completed?: boolean;
                  draftToken?: string;
                };
              })
            : null;

        if (!payload) {
          throw new Error('Expected response payload.');
        }

        responsePayloads.push(payload);
        return new Response(JSON.stringify({ id: 'draft-response-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    render(<App />);

    expect(await screen.findByText('Welcome to the form')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));

    expect(await screen.findByText('Do you want the primary path?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText('Primary path question')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText('All done')).toBeInTheDocument();
    expect(
      screen.getByText('Thank you for your submissions. You may now close this page.')
    ).toBeInTheDocument();
    expect(screen.getByText('All done')).toBeInTheDocument();
    expect(screen.queryByText('Thank You!')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/f/public-flow-form');

    await waitFor(() => {
      expect(responsePayloads).toHaveLength(3);
    });

    expect(responsePayloads[0]).toMatchObject({
      answers: [],
      completed: false,
      meta: {
        visitedQuestionIds: [2],
        lastQuestionId: 2,
        completed: false,
      },
    });
    expect(responsePayloads[0].responseId).toBeUndefined();
    expect(typeof responsePayloads[0].meta?.draftToken).toBe('string');

    expect(responsePayloads[1]).toMatchObject({
      responseId: 'draft-response-id',
      answers: [{ questionId: '2', answer: 'yes' }],
      completed: false,
      meta: {
        visitedQuestionIds: [2, 3],
        lastQuestionId: 3,
        completed: false,
      },
    });
    expect(responsePayloads[1].meta?.draftToken).toBe(responsePayloads[0].meta?.draftToken);

    expect(responsePayloads[2]).toMatchObject({
      responseId: 'draft-response-id',
      answers: [
        { questionId: '2', answer: 'yes' },
        { questionId: '3', answer: 'yes' },
      ],
      completed: true,
      meta: {
        visitedQuestionIds: [2, 3],
        lastQuestionId: 3,
        completed: true,
      },
    });
  });

  it('captures multiple repeat loop instances in one completed response', async () => {
    window.history.pushState({}, '', '/f/repeat-loop-form');
    const form = createRepeatLoopForm();
    const completedPayloads: Array<{
      answers: Array<{ questionId: string; answer: string }>;
      completed: boolean;
      meta?: { repeatLoops?: Array<{ loopId: string; instances: Array<{ title?: string }> }> };
    }> = [];
    const draftPayloads: Array<{
      answers: Array<{ questionId: string; answer: string }>;
      completed: boolean;
    }> = [];

    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? 'GET';

      if (url === '/api/forms/repeat-loop-form/public' && method === 'GET') {
        return new Response(JSON.stringify({ schema: form }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/forms/repeat-loop-form/responses' && method === 'POST') {
        const rawBody = init?.body;
        const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
        if (payload?.completed) {
          completedPayloads.push(payload);
        } else {
          draftPayloads.push(payload);
        }
        return new Response(JSON.stringify({ id: 'repeat-response-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    render(<App />);

    expect(await screen.findByText('Process name')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Invoice approvals' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Is this process documented?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText('Process 1 complete')).toBeInTheDocument();
    expect(screen.getByText('Invoice approvals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add another process' }));

    expect(await screen.findByText('Process name')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Employee onboarding' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Is this process documented?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText('Process 2 complete')).toBeInTheDocument();
    expect(screen.getByText('Invoice approvals')).toBeInTheDocument();
    expect(screen.getByText('Employee onboarding')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Finished')).toBeInTheDocument();

    await waitFor(() => {
      expect(completedPayloads).toHaveLength(1);
    });
    expect(completedPayloads[0].answers).toEqual([
      { questionId: '1', answer: 'Invoice approvals' },
      { questionId: '2', answer: 'yes' },
      { questionId: '1', answer: 'Employee onboarding' },
      { questionId: '2', answer: 'yes' },
    ]);
    expect(completedPayloads[0].meta?.repeatLoops?.[0].instances).toEqual([
      { index: 1, title: 'Invoice approvals', questionIds: [1, 2] },
      { index: 2, title: 'Employee onboarding', questionIds: [1, 2] },
    ]);
    expect(draftPayloads.map((payload) => payload.answers)).toContainEqual([
      { questionId: '1', answer: 'Employee onboarding' },
    ]);
    expect(
      draftPayloads.some(
        (payload) =>
          payload.answers.filter((answer) => answer.questionId === '1').length > 1
      )
    ).toBe(false);
  });

  it('shows a not-found message when the public form cannot be loaded', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);

    render(<App />);

    expect(
      await screen.findByText('This form could not be found or is not published.')
    ).toBeInTheDocument();
  });
});
