import { describe, it, expect } from "vitest";
import { TicketStatus } from "@prisma/client";
import { STATUS_TRANSITIONS, getPermittedTransitions, isLegalTransition } from "../../src/utils/statusTransitions.js";

// UNIT-03/UNIT-04 (docs/lab-03/tests.md): exercises the §6.5 Status
// Transition Matrix helper directly, without spinning up the Express app.
// The matrix itself (STATUS_TRANSITIONS) is transcribed here as the exact
// table from specification.md §6.5 so a mismatch between this test and the
// production matrix in server/src/utils/statusTransitions.ts is caught
// rather than the test merely re-asserting the module's own data back at
// itself.
const ALL_STATUSES = Object.values(TicketStatus);

// The exact §6.5 table, transcribed independently of STATUS_TRANSITIONS.
const EXPECTED_MATRIX: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  IN_PROGRESS: [TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  WAITING_FOR_REQUESTER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED],
  CLOSED: [TicketStatus.REOPENED],
  REOPENED: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_REQUESTER, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  CANCELLED: [],
};

describe("Status Transition Matrix (UNIT-03, UNIT-04 — BR-19, specification.md §6.5)", () => {
  describe("UNIT-03: every legal (✅) cell returns permitted=true", () => {
    for (const from of ALL_STATUSES) {
      for (const to of EXPECTED_MATRIX[from]) {
        it(`${from} -> ${to} is legal`, () => {
          expect(isLegalTransition(from, to)).toBe(true);
          expect(getPermittedTransitions(from)).toContain(to);
        });
      }
    }
  });

  describe("UNIT-04: every non-✅ cell (including CANCELLED's fully-terminal row) returns permitted=false with the correct permitted-set", () => {
    for (const from of ALL_STATUSES) {
      const legalDestinations = new Set(EXPECTED_MATRIX[from]);
      for (const to of ALL_STATUSES) {
        if (legalDestinations.has(to)) continue;
        it(`${from} -> ${to} is illegal`, () => {
          expect(isLegalTransition(from, to)).toBe(false);
        });
      }

      it(`${from}'s permitted set matches the §6.5 row exactly`, () => {
        expect(new Set(getPermittedTransitions(from))).toEqual(legalDestinations);
      });
    }

    it("CANCELLED is terminal: no outbound transitions at all", () => {
      expect(getPermittedTransitions(TicketStatus.CANCELLED)).toEqual([]);
      for (const to of ALL_STATUSES) {
        expect(isLegalTransition(TicketStatus.CANCELLED, to)).toBe(false);
      }
    });
  });

  it("STATUS_TRANSITIONS covers every TicketStatus value with no missing rows", () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });
});
