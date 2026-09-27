import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketStatusBadge } from '../../src/components/TicketStatusBadge';

describe('TicketStatusBadge', () => {
  it('uses the matching palette for a known status', () => {
    render(<TicketStatusBadge status="IN_PROGRESS" />);

    expect(screen.getByTestId('status-badge')).toHaveClass('zen-badge-status-progress');
    expect(screen.getByTestId('status-badge')).toHaveTextContent('IN PROGRESS');
  });

  it('uses the fallback palette for unknown and prototype property values', () => {
    const { rerender } = render(<TicketStatusBadge status="UNKNOWN" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('zen-badge-status-unknown');

    rerender(<TicketStatusBadge status="toString" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('zen-badge-status-unknown');
  });
});
