import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendPreviewUrl, setResendPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const emailChanged = user !== null && email !== user.email;

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setProfilePreviewUrl(null);
    try {
      setSavingProfile(true);
      const updated = await api.updateProfile({
        name: name !== user?.name ? name : undefined,
        email: emailChanged ? email : undefined,
        currentPassword: emailChanged ? currentPasswordForEmail : undefined,
      });
      await refreshUser();
      setCurrentPasswordForEmail('');
      if (updated.devEmailPreviewUrl) {
        setProfilePreviewUrl(updated.devEmailPreviewUrl);
        setProfileSuccess('Profile updated. No mail server is configured — preview the verification email below.');
      } else {
        setProfileSuccess(emailChanged ? 'Profile updated. Check your new inbox for a verification link.' : 'Profile updated.');
      }
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      setSavingPassword(true);
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess('Password changed.');
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleResend() {
    setResendMessage(null);
    setResendPreviewUrl(null);
    try {
      setResending(true);
      const result = await api.resendVerification();
      if (result.devEmailPreviewUrl) {
        setResendPreviewUrl(result.devEmailPreviewUrl);
        setResendMessage('No mail server is configured — preview the verification email below.');
      } else {
        setResendMessage('Verification email sent — check your inbox.');
      }
    } catch (err) {
      setResendMessage((err as Error).message);
    } finally {
      setResending(false);
    }
  }

  if (!user) return null;

  return (
    <div className="canvas">
      <div className="canvas-header">
        <div>
          <h1 className="canvas-title">Your profile</h1>
          <p className="canvas-subtitle">Manage your account details and password.</p>
        </div>
      </div>

      <div className="profile-header card">
        <span className="avatar profile-avatar">{initials(user.name)}</span>
        <div>
          <p className="profile-name">{user.name}</p>
          <p className="profile-email">{user.email}</p>
        </div>
        {user.email_verified ? (
          <span className="chip" style={{ background: '#f0fdf4', color: 'var(--color-success)' }}>
            Verified
          </span>
        ) : (
          <div className="profile-unverified">
            <span className="chip" style={{ background: '#fffbeb', color: 'var(--color-priority-medium)' }}>
              Unverified
            </span>
            <button className="btn btn-ghost" onClick={handleResend} disabled={resending}>
              {resending ? 'Sending…' : 'Resend verification'}
            </button>
          </div>
        )}
      </div>
      {resendMessage && (
        <div style={{ marginBottom: 16 }}>
          <p className="canvas-subtitle">{resendMessage}</p>
          {resendPreviewUrl && (
            <a href={resendPreviewUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ marginTop: 8 }}>
              Open verification email preview ↗
            </a>
          )}
        </div>
      )}

      <div className="profile-forms">
        <form onSubmit={handleProfileSubmit} className="card profile-form">
          <h3 className="profile-form-title">Account details</h3>
          <div className="field">
            <label htmlFor="profile-name">Name</label>
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {emailChanged && (
            <div className="field">
              <label htmlFor="profile-current-password">Current password (required to change email)</label>
              <input
                id="profile-current-password"
                type="password"
                value={currentPasswordForEmail}
                onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
              />
            </div>
          )}
          {profileError && <p className="error-banner">{profileError}</p>}
          {profileSuccess && <p className="success-banner">{profileSuccess}</p>}
          {profilePreviewUrl && (
            <a
              href={profilePreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start' }}
            >
              Open verification email preview ↗
            </a>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingProfile || (!name.trim() && !emailChanged)}
          >
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="card profile-form">
          <h3 className="profile-form-title">Change password</h3>
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="error-banner">{passwordError}</p>}
          {passwordSuccess && <p className="success-banner">{passwordSuccess}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPassword || !currentPassword || newPassword.length < 8}
          >
            {savingPassword ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
