import React, { useState } from 'react';

interface NostrLoginModalProps {
  onSuccess: () => void;
}

const NostrLoginModal: React.FC<NostrLoginModalProps> = ({ onSuccess }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setStatus('loading');
    setError(null);

    if (!window.nostr) {
      setStatus('error');
      setError('Nostr extension not found.');
      return;
    }

    try {
      const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST' });
      if (!nonceResponse.ok) {
        throw new Error('Failed to get challenge.');
      }
      const nonceData = (await nonceResponse.json()) as { challenge: string };

      const pubkey = await window.nostr.getPublicKey();
      const event = {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', nonceData.challenge]],
        content: '',
        pubkey,
      };

      const signedEvent = await window.nostr.signEvent(event);

      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event: signedEvent }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Verification failed.');
      }

      setStatus('idle');
      onSuccess();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Sign in</h3>
        <p className="text-sm text-gray-600 mb-6">
          Connect your Nostr signer to access admin tools.
        </p>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        <button
          type="button"
          onClick={handleLogin}
          className="typeform-button w-full"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Signing...' : 'Connect Nostr'}
        </button>
      </div>
    </div>
  );
};

export default NostrLoginModal;
