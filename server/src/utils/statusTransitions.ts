import { TicketStatus } from "@prisma/client";

// BR-19, specification.md §6.5: the single source of truth for which
// status transitions are legal. Exported as a plain data structure (not
// buried inside the PATCH route handler) so:
//   1. The PATCH /api/staff/tickets/:id/status route can validate against
//      it and report the exact permitted set on a 409.
//   2. GET /api/staff/tickets/:id can compute `permittedStatusTransitions`
//      server-side for the client to render its Status control from,
//      rather than the client keeping an independent copy of this matrix —
//      the same class of drift risk PR #66's review caught and fixed for
//      `canSignalResolution` (see serializeTicket in app.ts).
//   3. server/tests/lab-03/status-transitions.unit.test.ts (UNIT-03/UNIT-04)
//      can exercise the matrix directly with no Express app involved.
// CANCELLED has an explicit empty array — it is fully terminal, not just
// "unspecified" — so a lookup miss and a deliberate terminal state are
// never confused.
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.OPEN]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_REQUESTER,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  [TicketStatus.WAITING_FOR_REQUESTER]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.REOPENED],
  [TicketStatus.CLOSED]: [TicketStatus.REOPENED],
  [TicketStatus.REOPENED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_REQUESTER,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.CANCELLED]: [],
};

/** The set of statuses reachable in one step from `from`, per §6.5. */
export function getPermittedTransitions(from: TicketStatus): TicketStatus[] {
  return STATUS_TRANSITIONS[from];
}

/** Whether `from -> to` is a single legal step in the §6.5 matrix. */
export function isLegalTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
