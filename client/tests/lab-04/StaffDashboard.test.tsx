import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { StaffDashboard } from '../../src/components/StaffDashboard';

// UI-01..UI-03 (docs/lab-04/tests.md): the IT Staff / Administrator dashboard (AC-22, AC-24, AC-25).

const staffUser = { id: 7, name: 'Michael Chen', email: 'm@toktick.internal', department: 'IT', role: 'IT_STAFF', mustChangePassword: false };
const adminUser = { ...staffUser, role: 'ADMINISTRATOR' };

const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];

const payload = {
  generatedAt: '2026-11-02T09:00:00.000Z',
  timeZone: 'Asia/Bangkok',
  metrics: {
    unassigned: { count: 4, href: '/staff/queue?ownerId=unassigned&status=ACTIVE' },
    myOwnedTickets: { count: 6, href: '/staff/queue?ownerId=7&status=ACTIVE' },
    myOpenActions: { count: 3, href: '#my-actions' },
    pendingFollowUps: { count: 2, href: '/staff/queue?followUp=true&status=ACTIVE' },
    waitingForRequester: { count: 5, href: '/staff/queue?status=WAITING_FOR_REQUESTER' },
  },
  byStatus: STATUSES.map((status, i) => ({ status, count: i === 7 ? 0 : i + 1, href: `/staff/queue?status=${status}` })),
  byItPriority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority, i) => ({
    priority,
    count: i,
    href: `/staff/queue?itPriority=${priority}&status=ACTIVE`,
  })),
  attention: [
    { id: 5, ticketNumber: 'TKT-2026-000501', summary: 'Core switch down', status: 'OPEN', itPriority: 'URGENT', requesterSignalledResolved: false, updatedAt: '2026-11-02T03:00:00.000Z', href: '/staff/tickets/5' },
    { id: 6, ticketNumber: 'TKT-2026-000502', summary: 'Printer fixed itself?', status: 'IN_PROGRESS', itPriority: 'LOW', requesterSignalledResolved: true, updatedAt: '2026-11-02T02:00:00.000Z', href: '/staff/tickets/6' },
  ],
  myOpenActionsList: [
    { actionId: 12, ticketId: 5, ticketNumber: 'TKT-2026-000501', description: 'Replace the faulty uplink cable', status: 'IN_PROGRESS', actionAt: '2026-11-02T03:15:00.000Z', href: '/staff/tickets/5#actions' },
  ],
  recentlyUpdated: [
    { id: 5, ticketNumber: 'TKT-2026-000501', summary: 'Core switch down', status: 'OPEN', updatedAt: '2026-11-02T03:00:00.000Z', href: '/staff/tickets/5' },
  ],
};

const emptyPayload = {
  ...payload,
  metrics: Object.fromEntries(Object.entries(payload.metrics).map(([k, v]) => [k, { ...v, count: 0 }])),
  byStatus: STATUSES.map((status) => ({ status, count: 0, href: `/staff/queue?status=${status}` })),
  byItPriority: payload.byItPriority.map((p) => ({ ...p, count: 0 })),
  attention: [],
  myOpenActionsList: [],
  recentlyUpdated: [],
};

let me: typeof staffUser;
let response: () => Promise<Response>;
const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <StaffDashboard />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Staff dashboard (UI-01..UI-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    me = staffUser;
    response = () => json(200, payload);
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/api/auth/me')) return json(200, { user: me });
      if (u.includes('/api/dashboard/staff')) return response();
      return json(404, {});
    }) as typeof fetch);
  });

  it('UI-01a: renders every metric card, the status and priority strips and all lists from the payload', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: /welcome back, michael chen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /unassigned: 4/i })).toHaveAttribute('href', '/staff/queue?ownerId=unassigned&status=ACTIVE');
    expect(screen.getByRole('link', { name: /my owned tickets: 6/i })).toHaveAttribute('href', '/staff/queue?ownerId=7&status=ACTIVE');
    expect(screen.getByRole('link', { name: /pending follow-ups: 2/i })).toHaveAttribute('href', '/staff/queue?followUp=true&status=ACTIVE');
    expect(screen.getByRole('link', { name: /waiting for requester: 5/i })).toHaveAttribute('href', '/staff/queue?status=WAITING_FOR_REQUESTER');

    const byStatus = screen.getByTestId('by-status');
    expect(within(byStatus).getAllByRole('link')).toHaveLength(8);
    expect(within(byStatus).getByRole('link', { name: /open: 2/i })).toHaveAttribute('href', '/staff/queue?status=OPEN');
    const byPriority = screen.getByTestId('by-priority');
    expect(within(byPriority).getByRole('link', { name: /urgent: 0/i })).toHaveAttribute('href', '/staff/queue?itPriority=URGENT&status=ACTIVE');

    const attention = screen.getByRole('region', { name: /needs attention/i });
    expect(within(attention).getByText('Core switch down')).toBeInTheDocument();
    expect(within(attention).getByText('URGENT')).toBeInTheDocument();
    expect(within(attention).getByText(/requester says resolved/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('my-actions')).getByRole('link', { name: /replace the faulty uplink cable/i })).toHaveAttribute('href', '/staff/tickets/5#actions');
    expect(within(screen.getByRole('region', { name: /recently updated/i })).getByRole('link', { name: /TKT-2026-000501/ })).toHaveAttribute('href', '/staff/tickets/5');
  });

  it('UI-01b: the Users strip is shown only to Administrators', async () => {
    const { unmount } = renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.queryByTestId('user-counts')).not.toBeInTheDocument();
    unmount();

    me = adminUser;
    response = () => json(200, { ...payload, userCounts: { byRole: { REQUESTER: 440, IT_STAFF: 7, ADMINISTRATOR: 4 }, active: 440, inactive: 11, href: '/admin/users' } });
    renderDashboard();
    const counts = await screen.findByTestId('user-counts');
    expect(counts).toHaveTextContent('Requesters: 440');
    expect(counts).toHaveTextContent('Active: 440');
    expect(screen.getByRole('link', { name: /manage users/i })).toHaveAttribute('href', '/admin/users');
  });

  it('UI-02a: shows zeros with per-card empty hints and empty lists when there is no data (AC-24)', async () => {
    response = () => json(200, emptyPayload);
    renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.getByTestId('card-unassigned')).toHaveTextContent(/every active ticket has an owner/i);
    expect(screen.getByTestId('card-actions')).toHaveTextContent(/no open actions assigned to you/i);
    expect(screen.getByText(/nothing needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/no tickets yet/i)).toBeInTheDocument();
    // Zero counts stay visible in the strips.
    expect(within(screen.getByTestId('by-status')).getByRole('link', { name: /new: 0/i })).toBeInTheDocument();
  });

  it('UI-02b: loading, forbidden and safe-failure states', async () => {
    response = () => new Promise<Response>(() => undefined);
    const first = renderDashboard();
    expect(await screen.findByTestId('dashboard-loading')).toHaveAttribute('aria-busy', 'true');
    first.unmount();

    response = () => json(403, { error: { code: 'FORBIDDEN' } });
    const second = renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    second.unmount();

    response = () => json(500, { error: { message: 'stack trace here' } });
    renderDashboard();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(alert).not.toHaveTextContent(/stack trace/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('UI-03: the My Open Actions card moves focus to its list instead of navigating away', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    const card = screen.getByRole('link', { name: /my open actions: 3/i });
    expect(card).toHaveAttribute('href', '#my-actions');
    fireEvent.click(card);
    expect(screen.getByTestId('my-actions')).toHaveFocus();
  });

  it('UI-03b: quick actions link to the queue and to unassigned active tickets', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.getByRole('link', { name: /ticket queue/i })).toHaveAttribute('href', '/staff/queue');
    expect(screen.getByRole('link', { name: /unassigned tickets/i })).toHaveAttribute('href', '/staff/queue?ownerId=unassigned&status=ACTIVE');
  });
});
