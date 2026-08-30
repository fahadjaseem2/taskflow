import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from './ProfilePage';
import { AuthProvider } from '../context/AuthContext';
import * as apiModule from '../api';

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('taskflow_token', 'fake-token');
    vi.spyOn(apiModule.api, 'me').mockResolvedValue({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      email_verified: false,
    });
  });

  it('shows an "Unverified" badge and resend button when email is not verified', async () => {
    renderProfilePage();
    expect(await screen.findByText('Unverified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification/i })).toBeInTheDocument();
  });

  it('only reveals the current-password field once the email is changed', async () => {
    renderProfilePage();
    await screen.findByText('Unverified');

    expect(screen.queryByLabelText(/current password \(required/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    expect(screen.getByLabelText(/current password \(required/i)).toBeInTheDocument();
  });

  it('calls resendVerification when the resend button is clicked', async () => {
    const resendSpy = vi.spyOn(apiModule.api, 'resendVerification').mockResolvedValue({ sent: true });
    renderProfilePage();

    fireEvent.click(await screen.findByRole('button', { name: /resend verification/i }));
    await waitFor(() => expect(resendSpy).toHaveBeenCalled());
  });

  it('submits a password change with current and new password', async () => {
    const changeSpy = vi
      .spyOn(apiModule.api, 'changePassword')
      .mockResolvedValue({ changed: true });
    renderProfilePage();
    await screen.findByText('Unverified');

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    await waitFor(() =>
      expect(changeSpy).toHaveBeenCalledWith({ currentPassword: 'oldpass123', newPassword: 'newpass123' })
    );
  });
});
