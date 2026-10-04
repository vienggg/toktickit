import React from 'react';

export type TicketStatusCode =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

const STATUS_CLASS: Record<TicketStatusCode, string> = {
  NEW: 'open',
  OPEN: 'open',
  IN_PROGRESS: 'progress',
  WAITING_FOR_REQUESTER: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  CANCELLED: 'cancelled',
};

// Requester endpoints retain the Lab 2 status spelling for four states.
// Normalize only for palette selection; keep the supplied text visible.
const LEGACY_STATUS: Record<string, TicketStatusCode> = {
  New: 'NEW',
  In_Progress: 'IN_PROGRESS',
  'In Progress': 'IN_PROGRESS',
  Resolved: 'RESOLVED',
  Closed: 'CLOSED',
};

export function TicketStatusBadge({ status }: { status: string }) {
  const knownStatus = Object.prototype.hasOwnProperty.call(STATUS_CLASS, status)
    ? (status as TicketStatusCode)
    : Object.prototype.hasOwnProperty.call(LEGACY_STATUS, status)
      ? LEGACY_STATUS[status]
      : null;
  const colorClass = knownStatus ? `zen-badge-status-${STATUS_CLASS[knownStatus]}` : 'zen-badge-status-unknown';

  return (
    <span className={`badge ${colorClass}`} data-testid="status-badge" data-status={status}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
