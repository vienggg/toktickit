import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { RequireAuth, RequireRole } from '../../src/components/ProtectedRoute';

// Review item 9: this PR is the first consumer of RequireRole guarding a
// route as sensitive as /admin/users (ADMINISTRATOR-only), and no existing
// client test exercised RequireRole redirecting a wrong-role user away from
// it. Follows the same render/mock-fetch pattern already established by
// UserManagement.test.tsx and StaffTicketQueue.test.tsx.

function mockMeAs(role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR') {
  return (url: RequestInfo | URL) => {
    if (String(url).includes('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          user: { id: 1, name: 'Test User', email: 'test.user@toktick.internal', role, mustChangePassword: false },
        }),
      } as Response);
    }
    return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
  };
}

function renderAdminUsersRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireRole roles={['ADMINISTRATOR']}>
                  <div data-testid="admin-users-screen">Admin Users Screen</div>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="/" element={<div data-testid="home-screen">Home Screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('RequireRole route guard on /admin/users (ADMINISTRATOR-only)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects an IT_STAFF user away from /admin/users instead of rendering it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockMeAs('IT_STAFF') as typeof fetch);
    renderAdminUsersRoute();

    await waitFor(() => expect(screen.getByTestId('home-screen')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-users-screen')).not.toBeInTheDocument();
  });

  it('redirects a REQUESTER user away from /admin/users instead of rendering it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockMeAs('REQUESTER') as typeof fetch);
    renderAdminUsersRoute();

    await waitFor(() => expect(screen.getByTestId('home-screen')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-users-screen')).not.toBeInTheDocument();
  });

  it('renders /admin/users for an ADMINISTRATOR user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockMeAs('ADMINISTRATOR') as typeof fetch);
    renderAdminUsersRoute();

    await waitFor(() => expect(screen.getByTestId('admin-users-screen')).toBeInTheDocument());
  });
});
