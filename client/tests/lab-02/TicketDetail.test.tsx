import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { TicketDetail } from '../../src/components/TicketDetail';

const mockUser = {
  id: 1,
  name: 'Jennifer Anderson',
  email: 'jennifer.anderson@toktick.internal',
  department: 'Finance',
  role: 'REQUESTER',
  mustChangePassword: false,
};

const mockTicketData = {
  id: 1,
  ticketNumber: 'TKT-2026-000101',
  summary: 'VPN Disconnects on Financial Close',
  description: 'VPN drops every 30 mins during heavy Excel reconciliation.',
  priority: 'High',
  status: 'In Progress',
  categoryId: 4,
  category: { id: 4, name: 'Network' },
  relatedSystemId: 1,
  relatedSystem: { id: 1, name: 'GlobalProtect VPN' },
  requesterId: 1,
  requester: { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance' },
  attachments: [
    {
      id: 101,
      fileName: 'vpn_error.png',
      fileUrl: '/uploads/vpn_error.png',
      fileSize: 102400,
      mimeType: 'image/png',
      isRemoved: false,
      uploadedAt: '2026-08-20T10:00:00Z',
    },
  ],
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

let mockComments: Array<{ id: number; ticketId: number; authorId: number; authorName: string; authorRole: string; body: string; createdAt: string }> = [];
let resolutionSignalCalled = false;

describe('Ticket Detail Screen, Attachment Lifecycle, and In-Place Edit (UI-06..08)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockComments = [
      {
        id: 1,
        ticketId: 1,
        authorId: 1,
        authorName: 'Jennifer Anderson',
        authorRole: 'REQUESTER',
        body: 'Any update on this?',
        createdAt: '2026-08-21T09:00:00Z',
      },
    ];
    resolutionSignalCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL, options?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return { ok: true, json: async () => ({ user: mockUser }) } as Response;
      }
      if (urlStr.includes('/api/categories')) {
        return { ok: true, json: async () => [{ id: 4, name: 'Network' }] } as Response;
      }
      if (urlStr.includes('/api/systems')) {
        return { ok: true, json: async () => [{ id: 1, name: 'GlobalProtect VPN' }] } as Response;
      }
      if (urlStr.includes('/api/tickets/1/attachments/101') && options?.method === 'DELETE') {
        return { ok: true, json: async () => ({ message: 'Attachment soft-removed successfully' }) } as Response;
      }
      if (urlStr.includes('/api/tickets/1/comments') && options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        const created = {
          id: mockComments.length + 1,
          ticketId: 1,
          authorId: 1,
          authorName: 'Jennifer Anderson',
          authorRole: 'REQUESTER',
          body: body.body,
          createdAt: new Date().toISOString(),
        };
        mockComments = [...mockComments, created];
        return { ok: true, json: async () => created } as Response;
      }
      if (urlStr.includes('/api/tickets/1/comments')) {
        return { ok: true, json: async () => mockComments } as Response;
      }
      if (urlStr.includes('/api/tickets/1/resolution-signal') && options?.method === 'POST') {
        resolutionSignalCalled = true;
        return { ok: true, json: async () => ({ id: 1, requesterResolvedAt: '2026-08-22T10:00:00Z' }) } as Response;
      }
      if (urlStr.includes('/api/tickets/1') && options?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            ...mockTicketData,
            summary: 'Updated VPN Summary After Edit',
            priority: 'Urgent',
          }),
        } as Response;
      }
      if (urlStr.includes('/api/tickets/1')) {
        return {
          ok: true,
          json: async () => ({
            ...mockTicketData,
            requesterResolvedAt: resolutionSignalCalled ? '2026-08-22T10:00:00Z' : null,
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it('UI-06: renders ticket detail with metadata, requester box, and active attachments', async () => {
    render(
      <AuthProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000101')).toBeInTheDocument();
      expect(screen.getByText('VPN Disconnects on Financial Close')).toBeInTheDocument();
      expect(screen.getByText('vpn_error.png')).toBeInTheDocument();
      expect(screen.getByText('Network')).toBeInTheDocument();
    });
  });

  it('UI-07: enters in-place edit mode, saves changes, and renders updated summary', async () => {
    render(
      <AuthProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit Ticket/i })).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Ticket/i }));
    expect(screen.getByText(/In-Place Edit Mode/i)).toBeInTheDocument();

    // Edit summary
    const summaryInput = screen.getByDisplayValue('VPN Disconnects on Financial Close');
    fireEvent.change(summaryInput, { target: { value: 'Updated VPN Summary After Edit' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Updated VPN Summary After Edit')).toBeInTheDocument();
    });
  });

  it('UI-08: triggers attachment soft-removal confirmation modal and confirms deletion', async () => {
    render(
      <AuthProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('vpn_error.png')).toBeInTheDocument();
    });

    // Click remove button
    fireEvent.click(screen.getByRole('button', { name: /Remove/i }));

    await waitFor(() => {
      expect(screen.getByText('🗑️ Confirm Attachment Removal')).toBeInTheDocument();
    });

    // Confirm removal
    fireEvent.click(screen.getByRole('button', { name: /Confirm Removal/i }));

    await waitFor(() => {
      expect(screen.queryByText('🗑️ Confirm Attachment Removal')).not.toBeInTheDocument();
    });
  });

  it('UI-09: renders existing Public Comments and posts a new one (I-5, BR-04)', async () => {
    render(
      <AuthProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Any update on this?')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/add a comment/i), { target: { value: 'Still waiting on parts.' } });
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }));

    await waitFor(() => {
      expect(screen.getByText('Still waiting on parts.')).toBeInTheDocument();
    });
  });

  it('UI-10: shows the "Problem Appears Resolved" button and records the signal without changing the visible status (I-5, BR-05)', async () => {
    render(
      <AuthProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /problem appears resolved/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /problem appears resolved/i }));

    await waitFor(() => {
      expect(screen.getByText(/you indicated this problem appears resolved/i)).toBeInTheDocument();
      // The status badge is unaffected — still "In Progress", never becomes Resolved via this action.
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });
});
