import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the assessment welcome title', () => {
  render(<App />);
  const titleElement = screen.getByText(/AI Disruption Self-Assessment Tool/i);
  expect(titleElement).toBeInTheDocument();
});
