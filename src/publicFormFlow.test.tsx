import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { FormSchemaV0 } from './types/formSchema';

const hasTextContent = (text: string) => (_content: string, element: Element | null) =>
  element?.textContent === text;

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
      text: "What's your name?",
      weight: 0,
      category: 'Text',
      settings: { answerType: 'long' },
    },
    {
      id: 2,
      text: 'Process name',
      weight: 0,
      category: 'Text',
      settings: { answerType: 'long' },
    },
    {
      id: 3,
      text: 'Is this process documented?',
      weight: 0,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
    {
      id: 4,
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
      startQuestionId: 2,
      endQuestionId: 3,
      exitQuestionId: 4,
      titleQuestionId: 2,
      addAnotherLabel: 'Add another process',
      continueLabel: 'Continue',
    },
  ],
  results: [],
});

const createRecallStepListForm = (): FormSchemaV0 => ({
  version: 'v0',
  id: 'recall-step-form',
  title: 'Recall Step Form',
  questions: [
    {
      id: 2,
      text: 'What are the top activities that take up your time?',
      weight: 0,
      category: 'Text',
      settings: {
        answerType: 'long',
        longTextFormat: 'steps',
        stepListCount: 2,
      },
      branching: { next: 3 },
    },
    {
      id: 3,
      text: 'Can you describe the key activities you complete for "Answer:Q2:Step1"?',
      weight: 0,
      category: 'Text',
      settings: { answerType: 'long' },
    },
    {
      id: 4,
      text: 'Done',
      weight: 0,
      category: 'End Screen',
      settings: { kind: 'end' },
    },
  ],
  results: [],
});

const createLoopRecallStepListForm = (): FormSchemaV0 => ({
  version: 'v0',
  id: 'loop-recall-step-form',
  title: 'Loop Recall Step Form',
  questions: [
    {
      id: 2,
      text: 'What are the top activities that take up your time?',
      weight: 0,
      category: 'Text',
      settings: {
        answerType: 'long',
        longTextFormat: 'steps',
        stepListCount: 2,
      },
      branching: { next: 3 },
    },
    {
      id: 3,
      text: 'Can you describe the key activities you complete for "Answer:Q2:StepCurrent"?',
      weight: 0,
      category: 'Text',
      settings: { answerType: 'long' },
    },
    {
      id: 4,
      text: 'Done',
      weight: 0,
      category: 'End Screen',
      settings: { kind: 'end' },
    },
  ],
  repeatLoops: [
    {
      id: 'activity-loop',
      label: 'Activity',
      pluralLabel: 'Activities',
      startQuestionId: 3,
      endQuestionId: 3,
      exitQuestionId: 4,
      requiredStepListQuestionId: 2,
      addAnotherLabel: 'Add another activity',
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

    expect(await screen.findByText("What's your name?")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Andy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

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
    expect(completedPayloads[0].answers).toEqual(
      expect.arrayContaining([
        { questionId: '1', answer: 'Andy' },
        { questionId: '2', answer: 'Invoice approvals' },
        { questionId: '3', answer: 'yes' },
        { questionId: '2', answer: 'Employee onboarding' },
      ])
    );
    expect(completedPayloads[0].meta?.repeatLoops?.[0].instances).toEqual([
      { index: 1, title: 'Invoice approvals', questionIds: [2, 3] },
      { index: 2, title: 'Employee onboarding', questionIds: [2, 3] },
    ]);
    expect(
      draftPayloads.some(
        (payload) =>
          payload.answers.some(
            (answer) => answer.questionId === '1' && answer.answer === 'Andy'
          ) &&
          payload.answers.some(
            (answer) => answer.questionId === '2' && answer.answer === 'Invoice approvals'
          ) &&
          payload.answers.some(
            (answer) => answer.questionId === '2' && answer.answer === 'Employee onboarding'
          )
      )
    ).toBe(true);
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

  it('recalls a step-list answer in later question text using the internal question id', async () => {
    const form = createRecallStepListForm();
    window.history.pushState({}, '', '/f/recall-step-form');
    const fetchMock = vi.spyOn(global, 'fetch');

    fetchMock.mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? 'GET';

      if (url === '/api/forms/recall-step-form/public' && method === 'GET') {
        return new Response(JSON.stringify({ schema: form }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        (url.startsWith('/api/forms/recall-step-form/responses/draft-status') ||
          url.startsWith('/api/forms/recall-step-form/responses/draft-resume')) &&
        method === 'GET'
      ) {
        return new Response(JSON.stringify(url.includes('draft-resume') ? { draft: null } : { resetRequired: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/forms/recall-step-form/responses' && method === 'POST') {
        return new Response(JSON.stringify({ id: 'recall-response-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    render(<App />);

    expect(await screen.findByText('What are the top activities that take up your time?')).toBeInTheDocument();
    const stepInputs = await screen.findAllByPlaceholderText('Describe this step...');
    fireEvent.change(stepInputs[0], { target: { value: 'Reconciling Invoices' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        hasTextContent('Can you describe the key activities you complete for "Reconciling Invoices"?')
      )
    ).toBeInTheDocument();
  });

  it('recalls the matching step-list answer for each repeat loop pass', async () => {
    const form = createLoopRecallStepListForm();
    window.history.pushState({}, '', '/f/loop-recall-step-form');
    const fetchMock = vi.spyOn(global, 'fetch');

    fetchMock.mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? 'GET';

      if (url === '/api/forms/loop-recall-step-form/public' && method === 'GET') {
        return new Response(JSON.stringify({ schema: form }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        (url.startsWith('/api/forms/loop-recall-step-form/responses/draft-status') ||
          url.startsWith('/api/forms/loop-recall-step-form/responses/draft-resume')) &&
        method === 'GET'
      ) {
        return new Response(JSON.stringify(url.includes('draft-resume') ? { draft: null } : { resetRequired: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/forms/loop-recall-step-form/responses' && method === 'POST') {
        return new Response(JSON.stringify({ id: 'loop-recall-response-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    render(<App />);

    expect(await screen.findByText('What are the top activities that take up your time?')).toBeInTheDocument();
    const stepInputs = await screen.findAllByPlaceholderText('Describe this step...');
    fireEvent.change(stepInputs[0], { target: { value: 'Reconciling Invoices' } });
    fireEvent.change(stepInputs[1], { target: { value: 'Account management' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        hasTextContent('Can you describe the key activities you complete for "Reconciling Invoices"?')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Invoice work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(hasTextContent('Reconciling Invoices complete'))).toBeInTheDocument();
    expect(screen.getAllByText('Reconciling Invoices').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: 'Add another activity' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        hasTextContent('Can you describe the key activities you complete for "Account management"?')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Account work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('All 2 step-list answers have been covered.')).toBeInTheDocument();
    expect(screen.getByText('Reconciling Invoices')).toBeInTheDocument();
    expect(screen.getAllByText('Account management').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: 'Add another activity' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Done')).toBeInTheDocument();
  });
});
