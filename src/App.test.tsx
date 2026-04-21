import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects to the auth-gated forms flow and shows sign in when the session is missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);

    render(<App />);

    expect(screen.getByText(/Checking session/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/^Sign in$/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Connect your Nostr signer to access admin tools/i)).toBeInTheDocument();
  });
});
