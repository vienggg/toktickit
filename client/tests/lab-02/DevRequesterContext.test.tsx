import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DevRequesterProvider, useDevRequester } from '../../src/context/DevRequesterContext';
import { DevRequesterModal } from '../../src/components/DevRequesterModal';

const mockRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktick.internal', department: 'Finance', isActive: true },
  { id: 2, name: 'Michael Brown', email: 'michael.brown@toktick.internal', department: 'Operations', isActive: true },
  { id: 3, name: 'Emily Davis', email: 'emily.davis@toktick.internal', department: 'Marketing', isActive: true },
  { id: 4, name: 'David Wilson', email: 'david.wilson@toktick.internal', department: 'Engineering', isActive: true },
];

function TestConsumer() {
  const { currentRequester, setIsModalOpen } = useDevRequester();
  return (
    <div>
      <div data-testid="current-user-name">{currentRequester?.name}</div>
      <div data-testid="current-user-dept">{currentRequester?.department}</div>
      <button onClick={() => setIsModalOpen(true)}>Open Modal</button>
      <DevRequesterModal />
    </div>
  );
}

describe('Development Requester Context & Simulated Login (UI-01)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('UI-01: fetches active users, defaults to Jennifer Anderson, and allows context switching', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockRequesters,
    } as Response);

    render(
      <DevRequesterProvider>
        <TestConsumer />
      </DevRequesterProvider>
    );

    // Initial state: defaults to first user (Jennifer Anderson)
    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('Jennifer Anderson');
      expect(screen.getByTestId('current-user-dept')).toHaveTextContent('Finance');
    });
    expect(localStorage.getItem('toktick_dev_requester_id')).toBe('1');

    // Open modal
    fireEvent.click(screen.getByText('Open Modal'));
    expect(screen.getByText('👤 Simulated Requester Login')).toBeInTheDocument();
    expect(screen.getByText('Michael Brown')).toBeInTheDocument();

    // Switch to Michael Brown
    fireEvent.click(screen.getByText('Michael Brown'));

    // Verified context updated
    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('Michael Brown');
      expect(screen.getByTestId('current-user-dept')).toHaveTextContent('Operations');
    });
    expect(localStorage.getItem('toktick_dev_requester_id')).toBe('2');
  });
});
