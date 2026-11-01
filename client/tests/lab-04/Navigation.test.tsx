import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../../src/App';

// UI-15 (docs/lab-04/tests.md): role navigation, landing page, URL-based Requester routes (FR-18, AC-30).

const base = { id: 5, name: 'Pat Example', email: 'p@toktick.internal', department: 'IT', mustChangePassword: false };
const users = {
  REQUESTER: { ...base, role: 'REQUESTER' },
  IT_STAFF: { ...base, role: 'IT_STAFF' },
  ADMINISTRATOR: { ...base, role: 'ADMINISTRATOR' },
};

const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

let role: keyof typeof users;
let ticketListUrls: string[];

const requesterDash = {
  metrics: Object.fromEntries(['openTickets', 'waitingForRequester', 'resolved', 'closed'].map((k) => [k, { count: 0, href: '/tickets' }])),
  recentlyUpdated: [],
  recentlyResolved: [],
};
const staffDash = {
  metrics: Object.fromEntries(['unassigned', 'myOwnedTickets', 'myOpenActions', 'pendingFollowUps', 'waitingForRequester'].map((k) => [k, { count: 0, href: '/staff/queue' }])),
  byStatus: [],
  byItPriority: [],
  attention: [],
  myOpenActionsList: [],
  recentlyUpdated: [],
};

function go(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('Role navigation and routes (UI-15)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    role = 'REQUESTER';
    ticketListUrls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/api/auth/me')) return json(200, { user: users[role] });
      if (u.includes('/api/dashboard/requester')) return json(200, requesterDash);
      if (u.includes('/api/dashboard/staff')) return json(200, staffDash);
      if (u.includes('/api/staff/members')) return json(200, []);
      if (u.includes('/api/categories')) return json(200, []);
      if (u.match(/\/api\/tickets(\?|$)/)) {
        ticketListUrls.push(u);
        return json(200, { tickets: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNext: false, hasPrev: false } });
      }
      if (u.match(/\/api\/staff\/tickets(\?|$)/)) {
        ticketListUrls.push(u);
        return json(200, { data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
      }
      return json(404, {});
    }) as typeof fetch);
  });

  it('a Requester lands on the Dashboard and sees Dashboard, Create Ticket and My Tickets only', async () => {
    go('/');
    await screen.findByTestId('requester-dashboard');
    expect(window.location.pathname).toBe('/dashboard');
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('button', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: /my tickets/i })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /ticket queue|user management/i })).not.toBeInTheDocument();
  });

  it('IT Staff land on the staff Dashboard and see Dashboard and Ticket Queue, but not User Management', async () => {
    role = 'IT_STAFF';
    go('/');
    await screen.findByTestId('staff-dashboard');
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('button', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /ticket queue/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /user management/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: /my tickets|create ticket/i })).not.toBeInTheDocument();
  });

  it('an Administrator sees all three destinations', async () => {
    role = 'ADMINISTRATOR';
    go('/dashboard');
    await screen.findByTestId('staff-dashboard');
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('link', { name: /ticket queue/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /user management/i })).toBeInTheDocument();
  });

  it('a direct /tickets?status=ACTIVE URL opens My Tickets already filtered and marks it as the current page', async () => {
    go('/tickets?status=ACTIVE');
    const select = await screen.findByLabelText(/^status/i);
    expect((select as HTMLSelectElement).value).toBe('ACTIVE');
    await waitFor(() => expect(ticketListUrls.some((u) => u.includes('status=ACTIVE'))).toBe(true));
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('button', { name: /my tickets/i })).toHaveAttribute('aria-current', 'page');
  });

  it('a direct staff queue URL opens already filtered by owner and status', async () => {
    role = 'IT_STAFF';
    go('/staff/queue?ownerId=unassigned&status=ACTIVE');
    const status = await screen.findByLabelText(/^status/i);
    expect((status as HTMLSelectElement).value).toBe('ACTIVE');
    await waitFor(() => expect(ticketListUrls.some((u) => u.includes('ownerId=unassigned') && u.includes('status=ACTIVE'))).toBe(true));
  });

  it('staff cannot open the Requester routes, and Requesters cannot open staff routes', async () => {
    role = 'IT_STAFF';
    const first = go('/tickets');
    await screen.findByTestId('staff-dashboard');
    expect(window.location.pathname).not.toBe('/tickets');
    first.unmount();

    role = 'REQUESTER';
    go('/staff/queue');
    await screen.findByTestId('requester-dashboard');
    expect(window.location.pathname).not.toBe('/staff/queue');
  });
});
