import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { RequesterDashboard } from '../../src/components/RequesterDashboard';

// UI-04, UI-05 (docs/lab-04/tests.md): the Requester dashboard (AC-02, AC-24).

const requester = { id: 5, name: 'Jennifer Anderson', email: 'j@toktick.internal', department: 'Finance', role: 'REQUESTER', mustChangePassword: false };

const payload = {
  generatedAt: '2026-11-02T09:00:00.000Z',
  timeZone: 'Asia/Bangkok',
  metrics: {
    openTickets: { count: 3, href: '/tickets?status=ACTIVE' },
    waitingForRequester: { count: 1, href: '/tickets?status=WAITING_FOR_REQUESTER' },
    resolved: { count: 2, href: '/tickets?status=RESOLVED' },
    closed: { count: 12, href: '/tickets?status=CLOSED' },
  },
  recentlyUpdated: [
    { id: 11, ticketNumber: 'TKT-2026-000234', summary: 'Laptop battery drains quickly', status: 'IN_PROGRESS', updatedAt: '2026-11-02T03:00:00.000Z', href: '/tickets/11' },
  ],
  recentlyResolved: [
    { id: 12, ticketNumber: 'TKT-2026-000199', summary: 'VPN disconnects randomly', status: 'RESOLVED', updatedAt: '2026-11-01T03:00:00.000Z', resolvedAt: '2026-11-01T03:00:00.000Z', href: '/tickets/12' },
  ],
};

const empty = {
  ...payload,
  metrics: {
    openTickets: { count: 0, href: '/tickets?status=ACTIVE' },
    waitingForRequester: { count: 0, href: '/tickets?status=WAITING_FOR_REQUESTER' },
    resolved: { count: 0, href: '/tickets?status=RESOLVED' },
    closed: { count: 0, href: '/tickets?status=CLOSED' },
  },
  recentlyUpdated: [],
  recentlyResolved: [],
};

let dashboardResponse: () => Promise<Response>;
let dashboardCalls: number;
const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RequesterDashboard />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Requester dashboard (UI-04, UI-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dashboardCalls = 0;
    dashboardResponse = () => json(200, payload);
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/api/auth/me')) return json(200, { user: requester });
      if (u.includes('/api/dashboard/requester')) {
        dashboardCalls += 1;
        return dashboardResponse();
      }
      return json(404, {});
    }) as typeof fetch);
  });

  it('UI-04a: greets the user, shows the four metric cards as links with accessible names, and both recent lists', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: /welcome back, jennifer anderson/i })).toBeInTheDocument();
    const open = screen.getByRole('link', { name: /my open tickets: 3/i });
    expect(open).toHaveAttribute('href', '/tickets?status=ACTIVE');
    expect(screen.getByRole('link', { name: /waiting for you: 1/i })).toHaveAttribute('href', '/tickets?status=WAITING_FOR_REQUESTER');
    expect(screen.getByRole('link', { name: /resolved: 2/i })).toHaveAttribute('href', '/tickets?status=RESOLVED');
    expect(screen.getByRole('link', { name: /closed: 12/i })).toHaveAttribute('href', '/tickets?status=CLOSED');
    expect(screen.getByTestId('card-waiting')).toHaveTextContent(/needs your reply/i);

    const updated = screen.getByRole('region', { name: /recently updated/i });
    expect(within(updated).getByRole('link', { name: /TKT-2026-000234/ })).toHaveAttribute('href', '/tickets/11');
    const resolved = screen.getByRole('region', { name: /recently resolved/i });
    expect(within(resolved).getByText('VPN disconnects randomly')).toBeInTheDocument();
  });

  it('UI-04b: offers Quick Actions and does not duplicate the My Tickets screen (no search, filters or paging)', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.getByRole('link', { name: /create ticket/i })).toHaveAttribute('href', '/tickets/new');
    expect(screen.getByRole('link', { name: /view my tickets/i })).toHaveAttribute('href', '/tickets');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('UI-05a: shows per-card empty messages, empty lists and a Create Ticket link when there is no data', async () => {
    dashboardResponse = () => json(200, empty);
    renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.getByTestId('card-open')).toHaveTextContent(/no open tickets/i);
    expect(screen.getByTestId('card-waiting')).toHaveTextContent(/nothing waiting for you/i);
    expect(screen.getByTestId('card-waiting')).not.toHaveTextContent(/needs your reply/i);
    expect(screen.getAllByText(/nothing here yet/i)).toHaveLength(2);
    expect(screen.getByRole('link', { name: /create a ticket/i })).toHaveAttribute('href', '/tickets/new');
  });

  it('UI-05b: shows a busy state while loading', async () => {
    dashboardResponse = () => new Promise<Response>(() => undefined);
    renderDashboard();
    expect(await screen.findByTestId('dashboard-loading')).toHaveAttribute('aria-busy', 'true');
  });

  it('UI-05c: a failed load shows a safe alert with a retry that works, never raw error text', async () => {
    dashboardResponse = () => json(500, { error: { message: 'Prisma exploded at line 42' } });
    renderDashboard();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).not.toHaveTextContent(/prisma/i);
    dashboardResponse = () => json(200, payload);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByRole('link', { name: /my open tickets: 3/i });
  });

  it('UI-05d: Refresh reloads the data; a 403 shows the no-access message', async () => {
    renderDashboard();
    await screen.findByRole('link', { name: /my open tickets: 3/i });
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(dashboardCalls).toBe(2));

    dashboardResponse = () => json(403, { error: { code: 'FORBIDDEN' } });
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/only for requesters/i);
  });
});
