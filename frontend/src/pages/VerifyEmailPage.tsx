import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing a token.');
      return;
    }
    api
      .verifyEmail(token)
      .then(async () => {
        setStatus('success');
        if (user) await refreshUser();
      })
      .catch((err) => {
        setStatus('error');
        setMessage((err as Error).message);
      });
    // Only run once on mount with whatever token was in the URL.
  }, [token]);

  return (
    <div className="auth-screen">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>
          <span className="rail-brand-mark">TF</span>
          <span className="auth-brand-name">TaskFlow</span>
        </div>

        {status === 'loading' && <p>Verifying your email…</p>}
        {status === 'success' && (
          <>
            <h1 className="auth-title">Email verified</h1>
            <p className="auth-subtitle">Your email address has been confirmed.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="auth-title">Verification failed</h1>
            <p className="error-banner">{message}</p>
          </>
        )}

        <p className="auth-switch">
          <Link to={user ? '/dashboard' : '/login'}>
            {user ? 'Back to dashboard' : 'Back to sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
