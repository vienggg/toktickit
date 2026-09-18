import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail';

// UI-06 (FR-15/16/17: claim/reassign/IT Priority/status controls call the
// correct endpoints) and UI-07 (§7 ui-spec: distinct Public Comment vs.
// Internal Note panel styling/label) per docs/lab-03/tests.md.

const mockStaffUser = {
  id: 10,
  name: 'Sam Rivera',
  email: 'sam.rivera@toktick.internal',
  department: 'IT',
  role: 'IT_STAFF',
  mustChangePassword: false,
};

const mockStaffMembers = [
  { id: 10, name: 'Sam Rivera' },
  { id: 11, name: 'Alex Chen' },
];

interface MockStaffTicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  categoryId: number;
  category: { id: number; name: string };
  relatedSystemId: number | null;
  relatedSystem: { id: number; name: string } | null;
  requestedPriority: string;
  itPriority: string;
  status: string;
  permittedStatusTransitions: string[];
  ownerId: number | null;
  owner: { id: number; name: string } | null;
  requesterId: number;
  requester: { id: number; name: string; email: string; department: string };
  attachments: unknown[];
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function baseTicketDetail(overrides: Partial<MockStaffTicketDetail> = {}): MockStaffTicketDetail {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000201',
    summary: 'Printer offline on 3rd floor',
    description: 'The printer will not respond to print jobs.',
    categoryId: 2,
    category: { id: 2, name: 'Hardware' },
    relatedSystemId: null,
    relatedSystem: null,
    requestedPriority: 'HIGH',
    itPriority: 'URGENT',
    status: 'NEW',
    permittedStatusTransitions: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
    ownerId: null,
    owner: null,
    requesterId: 5,
    requester: { id: 5, name: 'Jennifer Anderson', email: 'jennifer@toktick.internal', department: 'Finance' },
    attachments: [],
    requesterResolvedAt: null,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z',
    ...overrides,
  };
}

let ticketState: MockStaffTicketDetail;
let comments: unknown[];
let notes: unknown[];
let failNextPatch: string | null;

function mockFetchImpl(url: RequestInfo | URL, init?: RequestInit) {
  const urlStr = String(url);
  const method = (init?.method ?? 'GET').toUpperCase();

  if (urlStr.includes('/api/auth/me')) {
    return Promise.resolve({ ok: true, json: async () => ({ user: mockStaffUser }) } as Response);
  }
  if (urlStr.includes('/api/staff/members')) {
    return Promise.resolve({ ok: true, json: async () => mockStaffMembers } as Response);
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+\/owner$/) && method === 'PATCH') {
    if (failNextPatch === 'owner') {
      failNextPatch = null;
      return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Owner update failed.' } }) } as Response);
    }
    const body = JSON.parse(String(init?.body));
    ticketState = { ...ticketState, ownerId: body.ownerId, owner: body.ownerId ? mockStaffMembers.find((m) => m.id === body.ownerId) ?? null : null };
    return Promise.resolve({ ok: true, json: async () => ticketState } as Response);
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+\/it-priority$/) && method === 'PATCH') {
    const body = JSON.parse(String(init?.body));
    ticketState = { ...ticketState, itPriority: body.itPriority };
    return Promise.resolve({ ok: true, json: async () => ticketState } as Response);
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+\/status$/) && method === 'PATCH') {
    if (failNextPatch === 'status') {
      failNextPatch = null;
      return Promise.resolve({ ok: false, status: 409, json: async () => ({ error: { code: 'ILLEGAL_TRANSITION', message: 'Illegal transition.' } }) } as Response);
    }
    const body = JSON.parse(String(init?.body));
    ticketState = { ...ticketState, status: body.status, permittedStatusTransitions: [] };
    return Promise.resolve({ ok: true, json: async () => ticketState } as Response);
  }
  if (urlStr.match(/\/api\/staff\/tickets\/\d+$/) && method === 'GET') {
    return Promise.resolve({ ok: true, json: async () => ticketState } as Response);
  }
  if (urlStr.match(/\/api\/tickets\/\d+\/comments$/) && method === 'GET') {
    return Promise.resolve({ ok: true, json: async () => comments } as Response);
  }
  if (urlStr.match(/\/api\/tickets\/\d+\/comments$/) && method === 'POST') {
    const body = JSON.parse(String(init?.body));
    const created = { id: comments.length + 1, ticketId: 1, authorId: 10, authorName: 'Sam Rivera', authorRole: 'IT_STAFF', body: body.body, createdAt: new Date().toISOString() };
    comments = [...comments, created];
    return Promise.resolve({ ok: true, json: async () => created } as Response);
  }
  if (urlStr.match(/\/api\/tickets\/\d+\/internal-notes$/) && method === 'GET') {
    return Promise.resolve({ ok: true, json: async () => notes } as Response);
  }
  if (urlStr.match(/\/api\/tickets\/\d+\/internal-notes$/) && method === 'POST') {
    const body = JSON.parse(String(init?.body));
    const created = { id: notes.length + 1, ticketId: 1, authorId: 10, authorName: 'Sam Rivera', authorRole: 'IT_STAFF', body: body.body, createdAt: new Date().toISOString() };
    notes = [...notes, created];
    return Promise.resolve({ ok: true, json: async () => created } as Response);
  }
  return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
}

function renderDetail(id = '1') {
  return render(
    <MemoryRouter initialEntries={[`/staff/tickets/${id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
          <Route path="/staff/queue" element={<div>Queue</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('IT Staff Ticket Detail (UI-06, UI-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ticketState = baseTicketDetail();
    comments = [];
    notes = [];
    failNextPatch = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetchImpl as typeof fetch);
  });

  it('renders read-only ticket info plus the Ownership/Priority/Status panels', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());
    expect(screen.getByText('The printer will not respond to print jobs.')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Jennifer Anderson')).toBeInTheDocument();
    expect(screen.getByText(/Ownership & Priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Change status to/i)).toBeInTheDocument();
  });

  it('Claim calls PATCH /owner with the acting user\'s own id', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    const claimButton = screen.getByRole('button', { name: /claim/i });
    fireEvent.click(claimButton);

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const ownerCall = calls.find((c) => String(c[0]).includes('/owner') && (c[1] as RequestInit)?.method === 'PATCH');
      expect(ownerCall).toBeDefined();
      expect(JSON.parse(String((ownerCall![1] as RequestInit).body))).toEqual({ ownerId: 10 });
    });
  });

  it('reassign dropdown selecting another staff member calls PATCH /owner with that id', async () => {
    ticketState = baseTicketDetail({ ownerId: 10, owner: { id: 10, name: 'Sam Rivera' } });
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    const ownerSelect = screen.getByLabelText(/^Owner$/i) as HTMLSelectElement;
    fireEvent.change(ownerSelect, { target: { value: '11' } });

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const ownerCall = calls.find((c) => String(c[0]).includes('/owner') && (c[1] as RequestInit)?.method === 'PATCH');
      expect(JSON.parse(String((ownerCall![1] as RequestInit).body))).toEqual({ ownerId: 11 });
    });
  });

  it('IT Priority change calls PATCH /it-priority independently of Requested Priority', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    const prioritySelect = screen.getByLabelText(/IT Priority/i) as HTMLSelectElement;
    fireEvent.change(prioritySelect, { target: { value: 'LOW' } });
    fireEvent.click(screen.getByRole('button', { name: /save it priority/i }));

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const call = calls.find((c) => String(c[0]).includes('/it-priority') && (c[1] as RequestInit)?.method === 'PATCH');
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ itPriority: 'LOW' });
    });
  });

  it('Status dropdown only offers the server-provided permitted transitions', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    const statusSelect = screen.getByLabelText(/Change status to/i) as HTMLSelectElement;
    const optionValues = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
    expect(optionValues.sort()).toEqual(['CANCELLED', 'IN_PROGRESS', 'OPEN'].sort());
    // Never offers an out-of-band transition not in permittedStatusTransitions.
    expect(optionValues).not.toContain('RESOLVED');
    expect(optionValues).not.toContain('CLOSED');
  });

  it('applying a legal status transition calls PATCH /status', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Change status to/i), { target: { value: 'OPEN' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const call = calls.find((c) => String(c[0]).includes('/status') && (c[1] as RequestInit)?.method === 'PATCH');
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ status: 'OPEN' });
    });
  });

  it('a terminal ticket (no permitted transitions) shows no status dropdown', async () => {
    ticketState = baseTicketDetail({ status: 'CANCELLED', permittedStatusTransitions: [] });
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());
    expect(screen.queryByLabelText(/Change status to/i)).not.toBeInTheDocument();
    expect(screen.getByText(/terminal status/i)).toBeInTheDocument();
  });

  it('a failed status change shows a safe failure banner, not raw error text', async () => {
    failNextPatch = 'status';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Change status to/i), { target: { value: 'OPEN' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => expect(screen.getByText('Illegal transition.')).toBeInTheDocument());
  });

  it('a failed owner update shows a safe failure banner', async () => {
    failNextPatch = 'owner';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Printer offline on 3rd floor')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /claim/i }));

    await waitFor(() => expect(screen.getByText('Owner update failed.')).toBeInTheDocument());
  });

  it('Public Comments panel renders existing comments and can post a new one', async () => {
    comments = [{ id: 1, ticketId: 1, authorId: 5, authorName: 'Jennifer Anderson', authorRole: 'REQUESTER', body: 'Any updates?', createdAt: '2026-09-01T12:00:00Z' }];
    renderDetail();
    await waitFor(() => expect(screen.getByText('Any updates?')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Add a comment/i), { target: { value: 'Looking into it now.' } });
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }));

    await waitFor(() => expect(screen.getByText('Looking into it now.')).toBeInTheDocument());
  });

  it('Internal Notes panel renders with distinct styling/label and can post a new note (UI-07)', async () => {
    notes = [{ id: 1, ticketId: 1, authorId: 10, authorName: 'Sam Rivera', authorRole: 'IT_STAFF', body: 'Checked router logs.', createdAt: '2026-09-01T13:00:00Z' }];
    renderDetail();
    await waitFor(() => expect(screen.getByText('Checked router logs.')).toBeInTheDocument());

    const panel = screen.getByTestId('internal-notes-panel');
    expect(panel).toHaveTextContent(/Internal — not visible to Requester/i);
    expect(panel.style.backgroundColor).toBe('var(--color-internal-note-bg)');

    fireEvent.change(screen.getByLabelText(/Add an internal note/i), { target: { value: 'Escalating to vendor.' } });
    fireEvent.click(screen.getByRole('button', { name: /post internal note/i }));

    await waitFor(() => expect(screen.getByText('Escalating to vendor.')).toBeInTheDocument());
  });
});
