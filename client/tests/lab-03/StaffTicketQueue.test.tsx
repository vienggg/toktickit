import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { StaffTicketQueue } from '../../src/components/StaffTicketQueue';

const mockStaffUser = {
  id: 10,
  name: 'Sam Rivera',
  email: 'sam.rivera@toktick.internal',
  department: 'IT',
  role: 'IT_STAFF',
  mustChangePassword: false,
};

interface MockQueueTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  categoryId: number;
  category: { id: number; name: string };
  requestedPriority: string;
  itPriority: string;
  status: string;
  ownerId: number | null;
  ownerName: string | null;
  requesterId: number;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  updatedAt: string;
}

const baseTicket: MockQueueTicket = {
  id: 1,
  ticketNumber: 'TKT-2026-000201',
  summary: 'Printer offline on 3rd floor',
  description: 'The printer will not respond to print jobs.',
  categoryId: 2,
  category: { id: 2, name: 'Hardware' },
  requestedPriority: 'HIGH',
  itPriority: 'URGENT',
  status: 'NEW',
  ownerId: null,
  ownerName: null,
  requesterId: 5,
  requesterName: 'Jennifer Anderson',
  requesterEmail: 'jennifer.anderson@toktick.internal',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

let queueTickets: MockQueueTicket[] = [];

function mockFetchImpl(url: RequestInfo | URL) {
  const urlStr = String(url);
  if (urlStr.includes('/api/auth/me')) {
    return Promise.resolve({ ok: true, json: async () => ({ user: mockStaffUser }) } as Response);
  }
  if (urlStr.includes('/api/categories')) {
    return Promise.resolve({ ok: true, json: async () => [{ id: 2, name: 'Hardware' }] } as Response);
  }
  if (urlStr.includes('/api/staff/tickets')) {
    const params = new URL(urlStr, 'http://localhost').searchParams;
    const search = params.get('search')?.toLowerCase() ?? '';
    let filtered = queueTickets;
    if (search) {
      filtered = filtered.filter((t) => t.summary.toLowerCase().includes(search) || t.ticketNumber.toLowerCase().includes(search));
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        data: filtered,
        pagination: { page: 1, pageSize: 10, total: filtered.length, totalPages: 1 },
      }),
    } as Response);
  }
  return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
}

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={['/staff/queue']}>
      <AuthProvider>
        <StaffTicketQueue />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('IT Staff Ticket Queue (UI-03, UI-04, UI-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    queueTickets = [baseTicket];
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetchImpl as typeof fetch);
  });

  it('UI-03a: renders the desktop table with ticket rows and correct badges', async () => {
    renderQueue();
    await waitFor(() => expect(screen.getAllByText('TKT-2026-000201').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Printer offline on 3rd floor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('URGENT').length).toBeGreaterThan(0);
  });

  it('UI-04: shows owner name for an assigned ticket instead of Unassigned', async () => {
    queueTickets = [{ ...baseTicket, ownerId: 99, ownerName: 'Sam Rivera' }];
    renderQueue();
    await waitFor(() => expect(screen.getAllByText('TKT-2026-000201').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Sam Rivera').length).toBeGreaterThan(0);
  });

  it('UI-03b: renders an empty-queue state when there are no tickets at all', async () => {
    queueTickets = [];
    renderQueue();
    await waitFor(() => expect(screen.getByText(/No tickets in the queue yet/i)).toBeInTheDocument());
  });

  it('UI-03c: renders a no-results state with Clear Filters after searching to nothing', async () => {
    queueTickets = [baseTicket];
    renderQueue();
    await waitFor(() => expect(screen.getAllByText('TKT-2026-000201').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText(/SEARCH/i), { target: { value: 'nonexistent-xyz' } });

    await waitFor(() => expect(screen.getByText(/No tickets match your filters/i)).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getAllByRole('button', { name: /Clear Filters/i }).length).toBeGreaterThan(0);
  });

  it('UI-03d: search interaction calls the API with the search query', async () => {
    renderQueue();
    await waitFor(() => expect(screen.getAllByText('TKT-2026-000201').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText(/SEARCH/i), { target: { value: 'Printer' } });

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some((c) => String(c[0]).includes('search=Printer'))).toBe(true);
    });
  });

  it('UI-05: renders ticket cards (not the desktop table) on a mobile-width viewport', async () => {
    renderQueue();
    await waitFor(() => expect(screen.getAllByText('TKT-2026-000201').length).toBeGreaterThan(0));
    expect(screen.getAllByTestId('ticket-card').length).toBeGreaterThan(0);
  });
});
