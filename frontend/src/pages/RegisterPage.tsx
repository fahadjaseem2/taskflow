import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      const devEmailPreviewUrl = await register(email, password, name);
      if (devEmailPreviewUrl) {
        // No real SMTP is configured - show the dev preview link instead of
        // silently navigating away, so verification is visibly working.
        setPreviewUrl(devEmailPreviewUrl);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (previewUrl) {
    return (
      <div className="auth-screen">
        <div className="auth-card card">
          <div className="auth-brand">
            <span className="rail-brand-mark">TF</span>
            <span className="auth-brand-name">TaskFlow</span>
          </div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-subtitle">
            No mail server is configured for this environment, so here's a preview of the
            verification email that would have been sent:
          </p>
          <a href={previewUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ marginBottom: 16 }}>
            Open verification email preview ↗
          </a>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            Continue to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <span className="rail-brand-mark">TF</span>
          <span className="auth-brand-name">TaskFlow</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Set up a board and start tracking work.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>At least 8 characters</span>
          </div>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
