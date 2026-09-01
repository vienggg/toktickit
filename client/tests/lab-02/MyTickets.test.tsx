import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DevRequesterProvider } from '../../src/context/DevRequesterContext';
import { MyTickets } from '../../src/components/MyTickets';

const mockRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
];

const mockTicketsResponse = {
  tickets: [
    {
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
      attachments: [{ id: 1, fileName: 'vpn_log.png' }],
      createdAt: '2026-08-20T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z',
    },
    {
      id: 2,
      ticketNumber: 'TKT-2026-000102',
      summary: 'Monitor Second Display Flicker',
      description: 'Dell 27-inch monitor intermittently goes black.',
      priority: 'Low',
      status: 'New',
      categoryId: 2,
      category: { id: 2, name: 'Hardware' },
      relatedSystemId: null,
      relatedSystem: null,
      attachments: [],
      createdAt: '2026-08-19T14:30:00Z',
      updatedAt: '2026-08-19T14:30:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    totalItems: 12,
    totalPages: 2,
    hasNext: true,
    hasPrev: false,
  },
};

describe('My Tickets Screen with Search, Filters, and Pagination (UI-04, UI-05)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/dev/requesters')) {
        return { ok: true, json: async () => mockRequesters } as Response;
      }
      if (urlStr.includes('/api/categories')) {
        return { ok: true, json: async () => [{ id: 2, name: 'Hardware' }, { id: 4, name: 'Network' }] } as Response;
      }
      if (urlStr.includes('/api/tickets')) {
        return { ok: true, json: async () => mockTicketsResponse } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it('UI-04: renders ticket table with ticket numbers, status badges, priority badges, and pagination', async () => {
    render(
      <DevRequesterProvider>
        <MyTickets />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000101')).toBeInTheDocument();
      expect(screen.getByText('VPN Disconnects on Financial Close')).toBeInTheDocument();
      expect(screen.getByText('TKT-2026-000102')).toBeInTheDocument();
      expect(screen.getByText(/12 total tickets/i)).toBeInTheDocument();
    });
  });

  it('UI-05: updates search query and triggers fetch with filter parameters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <DevRequesterProvider>
        <MyTickets />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000101')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by summary or TKT-YYYY/i);
    fireEvent.change(searchInput, { target: { value: 'VPN' } });

    await waitFor(
      () => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('search=VPN'),
          expect.anything()
        );
      },
      { timeout: 2000 }
    );
  });
});
