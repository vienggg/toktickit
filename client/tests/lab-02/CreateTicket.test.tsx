import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DevRequesterProvider } from '../../src/context/DevRequesterContext';
import { CreateTicket } from '../../src/components/CreateTicket';

const mockRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
];

const mockCategories = [
  { id: 1, name: 'Hardware' },
  { id: 2, name: 'Software' },
];

const mockSystems = [
  { id: 1, name: 'ERP Core', description: 'Financial ledger' },
];

describe('Create Ticket Screen & Zen Green Form UI (UI-02, UI-03)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/dev/requesters')) {
        return { ok: true, json: async () => mockRequesters } as Response;
      }
      if (urlStr.includes('/api/categories')) {
        return { ok: true, json: async () => mockCategories } as Response;
      }
      if (urlStr.includes('/api/systems')) {
        return { ok: true, json: async () => mockSystems } as Response;
      }
      if (urlStr.includes('/api/tickets')) {
        return {
          ok: true,
          json: async () => ({
            id: 10,
            ticketNumber: 'TKT-2026-000999',
            summary: 'New Hardware Issue',
            description: 'Monitor does not power on.',
            priority: 'Medium',
            status: 'New',
            category: { name: 'Hardware' },
            attachments: [],
            createdAt: new Date().toISOString(),
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  it('UI-02: pre-populates locked requester and loads category/system dropdowns', async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jennifer Anderson')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Hardware')).toBeInTheDocument();
      expect(screen.getByText('ERP Core')).toBeInTheDocument();
    });
  });

  it('UI-03: renders field-level validation errors on empty submission, and displays success banner on submit', async () => {
    render(
      <DevRequesterProvider>
        <CreateTicket />
      </DevRequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jennifer Anderson')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Submit Ticket/i });

    // Submit without filling required fields
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Summary is required.')).toBeInTheDocument();
      expect(screen.getByText('Description is required.')).toBeInTheDocument();
    });

    // Fill in valid data
    const summaryInput = screen.getByPlaceholderText(/e\.g\. ERP Core/i);
    const descInput = screen.getByPlaceholderText(/Provide detailed information/i);

    fireEvent.change(summaryInput, { target: { value: 'New Hardware Issue' } });
    fireEvent.change(descInput, { target: { value: 'Monitor does not power on.' } });

    // Submit form
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ticket Created Successfully!/i)).toBeInTheDocument();
      expect(screen.getByText('TKT-2026-000999')).toBeInTheDocument();
    });
  });
});
