import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { Login } from '../../src/components/Login';

// Login is rendered standalone here (MemoryRouter, no App/RequireAuth tree)
// so these are true unit tests of the form's own behavior — busy state,
// generic error display, and the login() call shape — independent of
// routing/redirect concerns already covered by App.test.tsx (AC-15).
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Login Screen (AC-01, AC-05, AC-06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('UI-01a: renders email and password fields with a Log In button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    renderLogin();
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });
  });

  it('UI-01b: shows a busy state and disables the button while submitting', async () => {
    let resolveLogin: (value: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/auth/me')) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) } as Response);
      }
      return new Promise((resolve) => {
        resolveLogin = resolve;
      });
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jennifer.anderson@toktick.internal' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'ChangeMe123!' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });

    resolveLogin({ ok: true, json: async () => ({ user: { id: 1, mustChangePassword: false } }) } as Response);
  });

  it('UI-01c: renders a generic error message on invalid credentials (BR-06 — no field is singled out)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) } as Response);
      }
      if (urlStr.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@toktick.internal' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('UI-01d: rejects an empty submission client-side without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter both/i)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.anything());
  });
});
