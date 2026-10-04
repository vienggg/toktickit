import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketStatusBadge } from '../../src/components/TicketStatusBadge';

describe('TicketStatusBadge', () => {
  it.each([
    ['NEW', 'open'],
    ['OPEN', 'open'],
    ['IN_PROGRESS', 'progress'],
    ['WAITING_FOR_REQUESTER', 'waiting'],
    ['RESOLVED', 'resolved'],
    ['CLOSED', 'closed'],
    ['REOPENED', 'reopened'],
    ['CANCELLED', 'cancelled'],
    ['New', 'open'],
    ['In_Progress', 'progress'],
    ['In Progress', 'progress'],
    ['Resolved', 'resolved'],
    ['Closed', 'closed'],
  ])('uses the %s status palette and preserves the original data-status', (status, color) => {
    render(<TicketStatusBadge status={status} />);

    expect(screen.getByTestId('status-badge')).toHaveClass(`zen-badge-status-${color}`);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', status);
    expect(screen.getByTestId('status-badge')).toHaveTextContent(status.replace(/_/g, ' '));
  });

  it('uses the fallback palette for unknown and prototype property values', () => {
    const { rerender } = render(<TicketStatusBadge status="UNKNOWN" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('zen-badge-status-unknown');

    rerender(<TicketStatusBadge status="toString" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('zen-badge-status-unknown');
  });
});
