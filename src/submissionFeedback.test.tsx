import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Questions from './pages/Questions';
import Results from './pages/Results';
import type { LoadedFormSchema } from './types/formSchema';

const createQuestionFlowForm = (): LoadedFormSchema => ({
  version: 'v0',
  id: 'feedback-form',
  title: 'Feedback Form',
  description: 'Testing submission feedback.',
  questions: [
    {
      id: 1,
      text: 'Question 1',
      weight: 3,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
  ],
  results: [{ label: 'Done', description: 'Done' }],
  totalScore: 3,
});

const createResultsStateForm = (): LoadedFormSchema => ({
  version: 'v0',
  id: 'result-form',
  title: 'Result Form',
  description: 'Result description',
  questions: [
    {
      id: 1,
      text: 'Question 1',
      weight: 2,
      category: 'Yes/No',
      settings: { answerType: 'yesno' },
    },
  ],
  results: [{ label: 'Result', description: 'Result description' }],
  totalScore: 2,
});

describe('submission feedback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks completion and shows an error when the final response submission fails', async () => {
    const onComplete = vi.fn();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Response rejected.' }),
    } as Response);

    render(
      <MemoryRouter>
        <Questions form={createQuestionFlowForm()} formId="feedback-form" onComplete={onComplete} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText('Response rejected.')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('blocks result submission and shows the lead API error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid email format.' }),
    } as Response);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/results',
            state: {
              score: 2,
              form: createResultsStateForm(),
              formId: 'result-form',
              responseId: 'response-1',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/results" element={<Results />} />
          <Route path="/thank-you" element={<div>Thank you page</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Contact Stakwork' }));

    expect(await screen.findByText('Invalid email format.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Thank you page')).not.toBeInTheDocument();
    });
  });
});
