import React, { useEffect, useState } from 'react';
import NostrLoginModal from './NostrLoginModal';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'authed' | 'unauth'>('loading');

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        setStatus('authed');
      } else {
        setStatus('unauth');
      }
    } catch {
      setStatus('unauth');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (status === 'loading') {
    return (
      <div className="typeform-fullscreen">
        <div className="typeform-content">
          <div className="text-gray-500">Checking session...</div>
        </div>
      </div>
    );
  }

  if (status === 'unauth') {
    return <NostrLoginModal onSuccess={checkAuth} />;
  }

  return <>{children}</>;
};

export default AuthGate;
