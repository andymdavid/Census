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

      if (url === '/api/forms/public-flow-form/responses' && method === 'POST') {
        const rawBody = init?.body;
        const payload =
          typeof rawBody === 'string'
            ? (JSON.parse(rawBody) as {
                responseId?: string;
                answers: Array<{ questionId: string; answer: string }>;
                completed: boolean;
                meta?: { visitedQuestionIds?: number[]; lastQuestionId?: number; completed?: boolean };
              })
            : null;

        if (!payload) {
          throw new Error('Expected response payload.');
        }

        if (payload.completed) {
          expect(payload.responseId).toBe('draft-response-id');
          expect(payload.answers).toEqual([
            { questionId: '2', answer: 'yes' },
            { questionId: '3', answer: 'yes' },
          ]);
          expect(payload.meta).toEqual({
            visitedQuestionIds: [2, 3],
            lastQuestionId: 3,
            completed: true,
          });
          return new Response(JSON.stringify({ id: 'draft-response-id' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        expect(payload.responseId).toBeUndefined();
        expect(payload.answers).toEqual([{ questionId: '2', answer: 'yes' }]);
        expect(payload.meta).toEqual({
          visitedQuestionIds: [2, 3],
          lastQuestionId: 3,
          completed: false,
        });
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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
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
