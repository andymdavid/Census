import React, { useMemo, useState } from 'react';
import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey, nip44 } from 'nostr-tools';

interface NostrLoginModalProps {
  onSuccess: () => void;
}

const NostrLoginModal: React.FC<NostrLoginModalProps> = ({ onSuccess }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'extension' | 'bunker'>('extension');
  const [bunkerUrl, setBunkerUrl] = useState('');
  const nostrAvailable = typeof window !== 'undefined' && Boolean(window.nostr);

  const bunkerConfig = useMemo(() => {
    if (!bunkerUrl.trim()) return null;
    try {
      const url = new URL(bunkerUrl);
      const pubkey = url.hostname;
      const relays = url.searchParams.getAll('relay');
      const secret = url.searchParams.get('secret') ?? undefined;
      if (!pubkey || relays.length === 0) return null;
      return { pubkey, relays, secret };
    } catch {
      return null;
    }
  }, [bunkerUrl]);

  const fetchChallenge = async () => {
    const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST', credentials: 'include' });
    if (!nonceResponse.ok) {
      throw new Error('Failed to get challenge.');
    }
    return (await nonceResponse.json()) as { challenge: string };
  };

  const verifyWithServer = async (signedEvent: unknown) => {
    const verifyResponse = await fetch('/api/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: signedEvent }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Verification failed.');
    }
  };

  const handleLogin = async () => {
    setStatus('loading');
    setError(null);

    if (!window.nostr) {
      setStatus('error');
      setError('Nostr extension not found.');
      return;
    }

    try {
      const nonceData = await fetchChallenge();

      const pubkey = await window.nostr.getPublicKey();
      const event = {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', nonceData.challenge]],
        content: '',
        pubkey,
      };

      const signedEvent = await window.nostr.signEvent(event);

      await verifyWithServer(signedEvent);

      setStatus('idle');
      onSuccess();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleBunkerLogin = async () => {
    setStatus('loading');
    setError(null);

    if (!bunkerConfig) {
      setStatus('error');
      setError('Enter a valid bunker:// URL with relay parameters.');
      return;
    }

    let pool: SimplePool | null = null;

    try {
      const nonceData = await fetchChallenge();
      const clientSecret = generateSecretKey();
      const clientPubkey = getPublicKey(clientSecret);
      pool = new SimplePool();

      const conversationKey = nip44.getConversationKey(clientSecret, bunkerConfig.pubkey);

      const sendRequest = async (method: string, params: unknown[]) => {
        const activePool = pool;
        if (!activePool) {
          throw new Error('Bunker connection is not initialized.');
        }
        const requestId = crypto.randomUUID();
        const payload = JSON.stringify({ id: requestId, method, params });
        const content = nip44.encrypt(payload, conversationKey);
        const event = finalizeEvent(
          {
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', bunkerConfig.pubkey]],
            content,
          },
          clientSecret
        );

        await Promise.all(activePool.publish(bunkerConfig.relays, event));
        const responseEvent = await activePool.get(
          bunkerConfig.relays,
          {
            kinds: [24133],
            authors: [bunkerConfig.pubkey],
            '#p': [clientPubkey],
          },
          { maxWait: 8000 }
        );

        if (!responseEvent) {
          throw new Error('No response from bunker.');
        }

        const decrypted = nip44.decrypt(responseEvent.content, conversationKey);
        const response = JSON.parse(decrypted) as { id: string; result?: unknown; error?: string };

        if (response.id !== requestId) {
          throw new Error('Unexpected response from bunker.');
        }

        if (response.error) {
          throw new Error(response.error);
        }

        return response.result;
      };

      const connectParams = bunkerConfig.secret
        ? [bunkerConfig.pubkey, bunkerConfig.secret]
        : [bunkerConfig.pubkey];
      await sendRequest('connect', connectParams);

      const remotePubkey = await sendRequest('get_public_key', []);
      if (typeof remotePubkey !== 'string') {
        throw new Error('Invalid bunker pubkey response.');
      }

      const authEventTemplate = {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', nonceData.challenge]],
        content: '',
      };

      const signedEvent = await sendRequest('sign_event', [authEventTemplate]);
      await verifyWithServer(signedEvent);

      setStatus('idle');
      onSuccess();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      pool?.destroy();
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

        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => setMode('extension')}
            className={`text-sm font-medium ${mode === 'extension' ? 'text-primary' : 'text-gray-500'}`}
          >
            Extension
          </button>
          <button
            type="button"
            onClick={() => setMode('bunker')}
            className={`text-sm font-medium ${mode === 'bunker' ? 'text-primary' : 'text-gray-500'}`}
          >
            Bunker (NIP-46)
          </button>
        </div>

        {mode === 'extension' && (
          <>
            {!nostrAvailable && (
              <div className="text-xs text-gray-500 mb-4">
                No Nostr extension detected. Install a NIP-07 signer or use a bunker connection.
              </div>
            )}
            <button
              type="button"
              onClick={handleLogin}
              className="typeform-button w-full"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Signing...' : 'Connect Extension'}
            </button>
          </>
        )}

        {mode === 'bunker' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2" htmlFor="bunker">
                Bunker URL
              </label>
              <input
                id="bunker"
                type="text"
                value={bunkerUrl}
                onChange={(event) => setBunkerUrl(event.target.value)}
                placeholder="bunker://<pubkey>?relay=wss://...&secret=..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
            <div className="text-xs text-gray-500">
              Paste your bunker connection string from your remote signer (NIP-46).
            </div>
            <button
              type="button"
              onClick={handleBunkerLogin}
              className="typeform-button w-full"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Connecting...' : 'Connect Bunker'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NostrLoginModal;
