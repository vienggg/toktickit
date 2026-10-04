import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { UserManagement } from '../../src/components/UserManagement';

const mockAdminUser = {
  id: 1,
  name: 'Admin Adams',
  email: 'admin.adams@toktick.internal',
  department: 'IT',
  role: 'ADMINISTRATOR',
  mustChangePassword: false,
};

interface MockAdminUserRow {
  id: number;
  name: string;
  email: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
}

const baseUsers: MockAdminUserRow[] = [
  { id: 2, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', role: 'REQUESTER', isActive: true },
  { id: 3, name: 'Sam Rivera', email: 'sam.rivera@toktick.internal', role: 'IT_STAFF', isActive: true },
];

let users: MockAdminUserRow[] = [];
let createHandler: ((body: unknown) => { status: number; body: unknown }) | null = null;
let patchHandler: ((id: number, body: unknown) => { status: number; body: unknown }) | null = null;

function mockFetchImpl(url: RequestInfo | URL, init?: RequestInit) {
  const urlStr = String(url);
  const method = init?.method ?? 'GET';

  if (urlStr.includes('/api/auth/me')) {
    return Promise.resolve({ ok: true, json: async () => ({ user: mockAdminUser }) } as Response);
  }

  if (urlStr.includes('/api/admin/users/') && urlStr.includes('/initial-password')) {
    return Promise.resolve({ ok: true, json: async () => ({ ...users[0] }) } as Response);
  }

  const patchMatch = urlStr.match(/\/api\/admin\/users\/(\d+)$/);
  if (patchMatch && method === 'PATCH') {
    const id = Number(patchMatch[1]);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (patchHandler) {
      const result = patchHandler(id, body);
      return Promise.resolve({ ok: result.status < 300, status: result.status, json: async () => result.body } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({ id, ...body }) } as Response);
  }

  if (urlStr.includes('/api/admin/users') && method === 'POST') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (createHandler) {
      const result = createHandler(body);
      return Promise.resolve({ ok: result.status < 300, status: result.status, json: async () => result.body } as Response);
    }
    return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 99, ...body }) } as Response);
  }

  if (urlStr.includes('/api/admin/users')) {
    const params = new URL(urlStr, 'http://localhost').searchParams;
    const search = params.get('search')?.toLowerCase() ?? '';
    const role = params.get('role');
    let filtered = users;
    if (search) {
      filtered = filtered.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    }
    if (role) {
      filtered = filtered.filter((u) => u.role === role);
    }
    return Promise.resolve({ ok: true, json: async () => filtered } as Response);
  }

  return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AuthProvider>
        <UserManagement />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Administrator User Management (UI-08, UI-09)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    users = [...baseUsers];
    createHandler = null;
    patchHandler = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetchImpl as typeof fetch);
  });

  it('UI-08a: renders the list of users with name/email/role/status', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());
    expect(screen.getAllByText('Sam Rivera')[0]).toBeInTheDocument();
    expect(screen.getAllByTestId('role-badge').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('status-badge').length).toBeGreaterThan(0);
  });

  it('UI-08b: search calls the API with the correct query param', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/SEARCH/i), { target: { value: 'Jennifer' } });

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('search=Jennifer'))).toBe(true);
    });
  });

  it('UI-08c: role filter calls the API with the correct query param', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/ROLE/i), { target: { value: 'IT_STAFF' } });

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('role=IT_STAFF'))).toBe(true);
    });
  });

  it('UI-08d: Create User modal submits the correct payload', async () => {
    let capturedBody: unknown = null;
    createHandler = (body) => {
      capturedBody = body;
      return { status: 201, body: { id: 50, name: (body as { name: string }).name, email: (body as { email: string }).email, role: (body as { role: string }).role, isActive: true } };
    };

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(document.getElementById('create-name')!, { target: { value: 'New Person' } });
    fireEvent.change(document.getElementById('create-email')!, { target: { value: 'new.person@toktick.internal' } });
    fireEvent.change(document.getElementById('create-role')!, { target: { value: 'IT_STAFF' } });
    fireEvent.change(document.getElementById('create-password')!, { target: { value: 'ValidPass1' } });

    fireEvent.click(screen.getByRole('button', { name: /^Create User$/i, hidden: true }));

    await waitFor(() => expect(capturedBody).toMatchObject({
      name: 'New Person',
      email: 'new.person@toktick.internal',
      role: 'IT_STAFF',
      initialPassword: 'ValidPass1',
    }));
  });

  it('UI-08e: duplicate-email error on create renders inline beneath the email field', async () => {
    createHandler = () => ({ status: 409, body: { error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email address already exists.' } } });

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(document.getElementById('create-name')!, { target: { value: 'Dup' } });
    fireEvent.change(document.getElementById('create-email')!, { target: { value: 'jennifer.anderson@toktick.internal' } });
    fireEvent.change(document.getElementById('create-password')!, { target: { value: 'ValidPass1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create User$/i, hidden: true }));

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
  });

  it('UI-08f: invalid-role error on create renders inline beneath the role field', async () => {
    createHandler = () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: "Invalid 'role': must be one of REQUESTER, IT_STAFF, ADMINISTRATOR." } } });

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(document.getElementById('create-name')!, { target: { value: 'Bad Role' } });
    fireEvent.change(document.getElementById('create-email')!, { target: { value: 'badrole@toktick.internal' } });
    fireEvent.change(document.getElementById('create-password')!, { target: { value: 'ValidPass1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create User$/i, hidden: true }));

    await waitFor(() => expect(screen.getByText(/must be one of/i)).toBeInTheDocument());
  });

  it('UI-08g: Edit modal submits the correct payload', async () => {
    let capturedBody: unknown = null;
    patchHandler = (id, body) => {
      capturedBody = body;
      return { status: 200, body: { id, ...(body as object), name: (body as { name?: string }).name ?? 'Jennifer Anderson' } };
    };

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0]);
    const nameInput = await screen.findByLabelText(/^Name$/i);
    fireEvent.change(nameInput, { target: { value: 'Jennifer A. Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(capturedBody).toMatchObject({ name: 'Jennifer A. Updated' }));
  });

  it('UI-09a: self-deactivation attempt shows the inline blocking message from the server 403, not a generic failure', async () => {
    patchHandler = () => ({
      status: 403,
      body: { error: { code: 'SELF_MODIFICATION_BLOCKED', message: 'You cannot deactivate or change the role of your own account.' } },
    });
    users = [{ id: mockAdminUser.id, name: mockAdminUser.name, email: mockAdminUser.email, role: 'ADMINISTRATOR', isActive: true }];

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Admin Adams')[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0]);
    const activeToggle = await screen.findByLabelText(/^Active$/i);
    fireEvent.click(activeToggle);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(screen.getByTestId('admin-safety-blocked-message')).toHaveTextContent(/cannot deactivate/i));
  });

  it('UI-09b: last-Administrator attempt shows the inline blocking message from the server 403', async () => {
    patchHandler = () => ({
      status: 403,
      body: { error: { code: 'LAST_ADMINISTRATOR', message: 'This action would leave zero active Administrator accounts and is not permitted.' } },
    });
    users = [{ id: 5, name: 'Sole Admin', email: 'sole.admin@toktick.internal', role: 'ADMINISTRATOR', isActive: true }];

    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Sole Admin')[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0]);
    const activeToggle = await screen.findByLabelText(/^Active$/i);
    fireEvent.click(activeToggle);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(screen.getByTestId('admin-safety-blocked-message')).toHaveTextContent(/zero active administrator/i));
  });

  it('UI-08h: Set New Initial Password requires a confirmation step before submitting', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText('Jennifer Anderson')[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0]);
    await screen.findByLabelText(/^Name$/i);

    expect(screen.queryByLabelText(/New initial password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Set New Initial Password\.\.\./i }));
    expect(screen.getByLabelText(/New initial password/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/New initial password/i), { target: { value: 'BrandNewPass1' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm New Password/i }));

    await waitFor(() => expect(screen.getByText(/New initial password set/i)).toBeInTheDocument());
  });
});
