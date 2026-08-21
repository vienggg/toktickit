import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DevRequesterProvider } from '../../src/context/DevRequesterContext';
import { TicketDetail } from '../../src/components/TicketDetail';

const mockRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
];

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

describe('Ticket Detail Screen, Attachment Lifecycle, and In-Place Edit (UI-06..08)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/dev/requesters')) {
        return { ok: true, json: async () => mockRequesters } as Response;
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
        return { ok: true, json: async () => mockTicketData } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it('UI-06: renders ticket detail with metadata, requester box, and active attachments', async () => {
    render(
      <DevRequesterProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </DevRequesterProvider>
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
      <DevRequesterProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </DevRequesterProvider>
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
      <DevRequesterProvider>
        <TicketDetail ticketId={1} onBack={() => {}} />
      </DevRequesterProvider>
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
});
