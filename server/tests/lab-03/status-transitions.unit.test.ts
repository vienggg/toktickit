import { describe, it, expect } from "vitest";
import { TicketStatus } from "@prisma/client";
import {
  STATUS_TRANSITIONS,
  getPermittedTransitions,
  getPermittedTransitionsForTicket,
  isLegalTransition,
} from "../../src/utils/statusTransitions.js";

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

  // Added in review of PR #68 (item 1): PATCH /status applied a BR-17
  // filter (no IN_PROGRESS while unassigned) that GET's
  // permittedStatusTransitions did not, so the two could disagree about
  // what's legal for the same ticket. getPermittedTransitionsForTicket is
  // the single helper both call sites now share.
  describe("getPermittedTransitionsForTicket (BR-17)", () => {
    it("excludes IN_PROGRESS for an unassigned ticket even when otherwise legal", () => {
      expect(getPermittedTransitionsForTicket(TicketStatus.NEW, null)).not.toContain(TicketStatus.IN_PROGRESS);
      expect(getPermittedTransitionsForTicket(TicketStatus.NEW, null)).toEqual(
        expect.arrayContaining([TicketStatus.OPEN, TicketStatus.CANCELLED])
      );
    });

    it("includes IN_PROGRESS once the ticket has an owner", () => {
      expect(getPermittedTransitionsForTicket(TicketStatus.NEW, 42)).toContain(TicketStatus.IN_PROGRESS);
    });

    it("does not otherwise alter the permitted set from statuses where IN_PROGRESS isn't a candidate", () => {
      expect(getPermittedTransitionsForTicket(TicketStatus.RESOLVED, null)).toEqual(getPermittedTransitions(TicketStatus.RESOLVED));
    });
  });
});
