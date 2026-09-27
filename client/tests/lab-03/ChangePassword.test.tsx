import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { ChangePassword } from '../../src/components/ChangePassword';

function renderChangePassword() {
  return render(
    <MemoryRouter initialEntries={['/change-password']}>
      <AuthProvider>
        <ChangePassword />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Change Password Screen (AC-02, BR-09, BR-10, BR-11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { id: 1, mustChangePassword: true } }) } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it('UI-02a: the policy checklist updates live as the user types (BR-09)', async () => {
    renderChangePassword();
    await waitFor(() => expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument());

    expect(screen.getByText(/At least 8 characters/).closest('li')).toHaveClass('text-muted');

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'Short1' } });
    expect(screen.getByText(/Contains a letter/).closest('li')).toHaveClass('text-success');
    expect(screen.getByText(/At least 8 characters/).closest('li')).toHaveClass('text-muted');

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'LongEnough123' } });
    expect(screen.getByText(/At least 8 characters/).closest('li')).toHaveClass('text-success');
  });

  it('UI-02b: blocks submission client-side until the confirmation matches (BR-11)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderChangePassword();
    await waitFor(() => expect(screen.getByLabelText(/current password/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'OldPass123' } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPass123' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'Mismatch123' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/please satisfy all password requirements/i)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/api/auth/change-password'), expect.anything());
  });

  it('UI-02c: submits and shows a server-side rejection (e.g. reused password, BR-10)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: { id: 1, mustChangePassword: true } }) } as Response;
      }
      if (urlStr.includes('/api/auth/change-password')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { code: 'PASSWORD_UNCHANGED', message: 'New password must be different from your current password.' } }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    renderChangePassword();
    await waitFor(() => expect(screen.getByLabelText(/current password/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'SamePass123' } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'SamePass123' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'SamePass123' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

    await waitFor(() => {
      expect(screen.getByText('New password must be different from your current password.')).toBeInTheDocument();
    });
  });
});
