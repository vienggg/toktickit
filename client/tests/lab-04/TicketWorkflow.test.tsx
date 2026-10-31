import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail';
import { StatusHistory } from '../../src/components/StatusHistory';

// UI-11..UI-14 (docs/lab-04/tests.md): the status control shows only permitted
// transitions and explains blocked ones, cancel/reopen need a reason, a stale
// change shows a conflict banner, and the history timeline respects role visibility.

const staffUser = { id: 10, name: 'Sam Rivera', email: 'sam@toktick.internal', department: 'IT', role: 'IT_STAFF', mustChangePassword: false };
const members = [{ id: 10, name: 'Sam Rivera' }];

function ticketDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000201',
    summary: 'Printer offline on 3rd floor',
    description: 'The printer will not respond.',
    categoryId: 2,
    category: { id: 2, name: 'Hardware' },
    relatedSystemId: null,
    relatedSystem: null,
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    status: 'IN_PROGRESS',
    permittedStatusTransitions: ['WAITING_FOR_REQUESTER', 'CANCELLED'],
    resolutionBlockers: ['NO_COMPLETED_ACTION'],
    actionsSummary: { total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0 },
    version: 4,
    resolvedAt: null,
    closedAt: null,
    ownerId: 10,
    owner: { id: 10, name: 'Sam Rivera' },
    requesterId: 5,
    requester: { id: 5, name: 'Jennifer Anderson', email: 'j@toktick.internal', department: 'Finance' },
    attachments: [],
    requesterResolvedAt: null,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z',
    ...overrides,
  };
}

let ticket: ReturnType<typeof ticketDetail>;
let calls: Array<{ url: string; method: string; body?: Record<string, unknown> }>;
let nextStatus: (() => Promise<Response>) | null;
let historyItems: unknown[];

const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

function mockFetchImpl(url: RequestInfo | URL, init?: RequestInit) {
  const u = String(url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ url: u, method, body });
  if (u.includes('/api/auth/me')) return json(200, { user: staffUser });
  if (u.includes('/api/staff/members')) return json(200, members);
  if (u.match(/\/api\/staff\/tickets\/\d+\/status$/) && method === 'PATCH') {
    if (nextStatus) {
      const fn = nextStatus;
      nextStatus = null;
      return fn();
    }
    ticket = ticketDetail({ status: body.status, version: 5, permittedStatusTransitions: [], resolutionBlockers: [] });
    return json(200, ticket);
  }
  if (u.match(/\/api\/staff\/tickets\/\d+$/)) return json(200, ticket);
  if (u.match(/\/api\/tickets\/\d+\/actions$/)) return json(200, { items: [], total: 0 });
  if (u.match(/\/api\/tickets\/\d+\/history$/)) return json(200, { items: historyItems });
  if (u.match(/\/comments$/) || u.match(/\/internal-notes$/)) return json(200, []);
  return json(404, {});
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/staff/tickets/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Ticket workflow UI (UI-11..UI-14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ticket = ticketDetail();
    calls = [];
    nextStatus = null;
    historyItems = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetchImpl as typeof fetch);
  });

  it('UI-11a: the status control offers exactly the permitted transitions', async () => {
    renderDetail();
    const select = await screen.findByLabelText(/change status to/i);
    const values = Array.from((select as HTMLSelectElement).options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['WAITING_FOR_REQUESTER', 'CANCELLED']);
  });

  it('UI-11b: while Resolve is blocked it explains why and links to the Actions Taken section', async () => {
    ticket = ticketDetail({ resolutionBlockers: ['NO_OWNER', 'NO_COMPLETED_ACTION', 'OPEN_ACTIONS'], ownerId: null, owner: null });
    renderDetail();
    const note = await screen.findByTestId('resolve-blocked');
    expect(note).toHaveTextContent(/resolve is not available yet/i);
    expect(note).toHaveTextContent(/needs an owner/i);
    expect(note).toHaveTextContent(/at least one action must be completed/i);
    expect(note).toHaveTextContent(/finish or cancel the planned and in-progress actions/i);
    expect(note.querySelector('a')).toHaveAttribute('href', '#actions');
    expect(screen.queryByRole('option', { name: /resolved/i })).not.toBeInTheDocument();
  });

  it('UI-11c: Cancel needs a reason; the reason and expectedVersion are sent with the change', async () => {
    renderDetail();
    fireEvent.change(await screen.findByLabelText(/change status to/i), { target: { value: 'CANCELLED' } });
    const apply = screen.getByRole('button', { name: /^apply$/i });
    expect(apply).toBeDisabled();
    const reason = screen.getByLabelText(/reason/i);
    expect(reason).toBeRequired();
    fireEvent.change(reason, { target: { value: 'Duplicate of another ticket' } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/status'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/status'))!.body).toMatchObject({ status: 'CANCELLED', reason: 'Duplicate of another ticket', expectedVersion: 4 });
  });

  it('UI-11d: Reopen also requires a reason', async () => {
    ticket = ticketDetail({ status: 'RESOLVED', permittedStatusTransitions: ['CLOSED', 'REOPENED'], resolutionBlockers: [] });
    renderDetail();
    fireEvent.change(await screen.findByLabelText(/change status to/i), { target: { value: 'REOPENED' } });
    expect(screen.getByLabelText(/reason/i)).toBeRequired();
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled();
  });

  it('UI-12: after a successful change the summary badge and the history are refreshed and announced', async () => {
    renderDetail();
    fireEvent.change(await screen.findByLabelText(/change status to/i), { target: { value: 'WAITING_FOR_REQUESTER' } });
    const historyCallsBefore = calls.filter((c) => c.url.endsWith('/history')).length;
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await waitFor(() => expect(screen.getAllByTestId('status-badge')[0]).toHaveAttribute('data-status', 'WAITING_FOR_REQUESTER'));
    expect(await screen.findByText(/status updated/i)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/history')).length).toBeGreaterThan(historyCallsBefore));
  });

  it('UI-13: a stale status change shows a conflict banner, keeps the typed reason and reloads on request', async () => {
    renderDetail();
    fireEvent.change(await screen.findByLabelText(/change status to/i), { target: { value: 'CANCELLED' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Keep this reason' } });
    nextStatus = () =>
      json(409, { error: { code: 'STALE_UPDATE', message: 'This ticket was changed by someone else.', current: ticketDetail({ version: 6, status: 'OPEN' }) } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    const banner = await screen.findByTestId('conflict-banner');
    expect(banner).toHaveTextContent(/changed by someone else/i);
    expect(screen.getByLabelText(/reason/i)).toHaveValue('Keep this reason');
    ticket = ticketDetail({ version: 6, status: 'OPEN', permittedStatusTransitions: ['IN_PROGRESS', 'CANCELLED'] });
    fireEvent.click(screen.getByRole('button', { name: /reload latest/i }));
    await waitFor(() => expect(screen.queryByTestId('conflict-banner')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId('status-badge')[0]).toHaveAttribute('data-status', 'OPEN'));
  });

  it('UI-14a: the history timeline lists changes in order; staff see reasons, Requesters do not', async () => {
    historyItems = [
      { id: 1, fromStatus: 'NEW', toStatus: 'OPEN', changedBy: { id: 10, name: 'Sam Rivera' }, createdAt: '2026-11-01T01:00:00Z' , reason: 'Triaged' },
      { id: 2, fromStatus: 'OPEN', toStatus: 'CANCELLED', changedBy: { id: 11, name: 'Alex Chen' }, createdAt: '2026-11-01T02:00:00Z', reason: 'Duplicate' },
    ];
    const { unmount } = render(<StatusHistory ticketId={1} showReasons />);
    const list = await screen.findByRole('list', { name: /status history/i });
    const entries = list.querySelectorAll('li');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Sam Rivera');
    expect(entries[0]).toHaveTextContent('Triaged');
    expect(entries[1]).toHaveTextContent('Cancelled');
    unmount();

    historyItems = historyItems.map((h) => { const { reason: _reason, ...rest } = h as Record<string, unknown>; return rest; });
    render(<StatusHistory ticketId={1} showReasons={false} />);
    await screen.findByRole('list', { name: /status history/i });
    expect(screen.queryByText('Triaged')).not.toBeInTheDocument();
    expect(screen.queryByText(/reason/i)).not.toBeInTheDocument();
  });

  it('UI-14b: an empty history says it is recorded from Lab 4 onward; a failed load shows an alert', async () => {
    const { unmount } = render(<StatusHistory ticketId={1} showReasons />);
    expect(await screen.findByText(/history is recorded from lab 4 onward/i)).toBeInTheDocument();
    unmount();
    vi.spyOn(globalThis, 'fetch').mockImplementation((() => json(500, {})) as typeof fetch);
    render(<StatusHistory ticketId={1} showReasons />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
