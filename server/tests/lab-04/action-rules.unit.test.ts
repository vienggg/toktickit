import { describe, it, expect } from "vitest";
import { TicketStatus } from "@prisma/client";
import {
  ACTION_STATUSES,
  INITIAL_ACTION_STATUSES,
  isLegalActionTransition,
  getPermittedActionTransitions,
  validateFollowUp,
  validateCompletedResult,
  validateActionAt,
  getResolutionBlockers,
  isTicketLockedForActions,
  hasOpenActions,
} from "../../src/utils/actionRules.js";
import { getPermittedTransitionsForTicket, STATUS_TRANSITIONS } from "../../src/utils/statusTransitions.js";
import { bangkokWindowStart } from "../../src/utils/bangkokTime.js";

// UNIT-01..UNIT-05 (docs/lab-04/tests.md). Pure functions only: no Express, no database.

describe("Action status matrix (UNIT-01, BR-11)", () => {
  const legal: Array<[string, string]> = [
    ["PLANNED", "IN_PROGRESS"],
    ["PLANNED", "COMPLETED"],
    ["PLANNED", "CANCELLED"],
    ["IN_PROGRESS", "COMPLETED"],
    ["IN_PROGRESS", "CANCELLED"],
  ];

  it("allows exactly the documented edges and rejects every other pair", () => {
    for (const from of ACTION_STATUSES) {
      for (const to of ACTION_STATUSES) {
        const expected = legal.some(([f, t]) => f === from && t === to);
        expect(isLegalActionTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(getPermittedActionTransitions("COMPLETED")).toEqual([]);
    expect(getPermittedActionTransitions("CANCELLED")).toEqual([]);
    expect(getPermittedActionTransitions("PLANNED")).toEqual(["IN_PROGRESS", "COMPLETED", "CANCELLED"]);
  });

  it("never allows CANCELLED as an initial status", () => {
    expect(INITIAL_ACTION_STATUSES).toEqual(["PLANNED", "IN_PROGRESS", "COMPLETED"]);
  });
});

describe("Follow-up and result validators (UNIT-02, BR-08, BR-09)", () => {
  it("requires a non-blank note when follow-up is required", () => {
    expect(validateFollowUp(true, undefined)).toMatch(/follow-up note/i);
    expect(validateFollowUp(true, null)).toMatch(/follow-up note/i);
    expect(validateFollowUp(true, "   ")).toMatch(/follow-up note/i);
    expect(validateFollowUp(true, "Check again on Friday")).toBeNull();
  });

  it("enforces the 1000 character limit on the note", () => {
    expect(validateFollowUp(true, "x".repeat(1000))).toBeNull();
    expect(validateFollowUp(true, "x".repeat(1001))).toMatch(/1000/);
  });

  it("does not require a note when follow-up is not required", () => {
    expect(validateFollowUp(false, undefined)).toBeNull();
    expect(validateFollowUp(false, "")).toBeNull();
  });

  it("requires a non-blank result only for COMPLETED, max 2000 characters", () => {
    expect(validateCompletedResult("COMPLETED", undefined)).toMatch(/result/i);
    expect(validateCompletedResult("COMPLETED", "  ")).toMatch(/result/i);
    expect(validateCompletedResult("COMPLETED", "Fixed")).toBeNull();
    expect(validateCompletedResult("COMPLETED", "x".repeat(2001))).toMatch(/2000/);
    expect(validateCompletedResult("PLANNED", undefined)).toBeNull();
    expect(validateCompletedResult("IN_PROGRESS", "")).toBeNull();
  });
});

describe("Action date/time bounds (UNIT-05, BR-06)", () => {
  const ticketCreatedAt = new Date("2026-11-01T00:00:00.000Z");
  const now = new Date("2026-11-02T00:00:00.000Z");

  it("accepts a time between ticket creation and now + 5 minutes", () => {
    expect(validateActionAt(new Date("2026-11-01T12:00:00.000Z"), now, ticketCreatedAt)).toBeNull();
    expect(validateActionAt(new Date(now.getTime() + 5 * 60_000), now, ticketCreatedAt)).toBeNull();
  });

  it("rejects a time later than now + 5 minutes", () => {
    expect(validateActionAt(new Date(now.getTime() + 5 * 60_000 + 1), now, ticketCreatedAt)).toMatch(/future/i);
  });

  it("rejects a time earlier than the ticket was created", () => {
    expect(validateActionAt(new Date(ticketCreatedAt.getTime() - 1), now, ticketCreatedAt)).toMatch(/before/i);
  });

  it("rejects an invalid date", () => {
    expect(validateActionAt(new Date("not a date"), now, ticketCreatedAt)).toMatch(/valid/i);
  });
});

describe("Resolution blockers (UNIT-03, BR-19)", () => {
  it("reports every blocker that applies", () => {
    expect(getResolutionBlockers({ ownerId: null, actionStatuses: [] })).toEqual(["NO_OWNER", "NO_COMPLETED_ACTION"]);
    expect(getResolutionBlockers({ ownerId: 1, actionStatuses: [] })).toEqual(["NO_COMPLETED_ACTION"]);
    expect(getResolutionBlockers({ ownerId: 1, actionStatuses: ["COMPLETED", "PLANNED"] })).toEqual(["OPEN_ACTIONS"]);
    expect(getResolutionBlockers({ ownerId: null, actionStatuses: ["IN_PROGRESS"] })).toEqual([
      "NO_OWNER",
      "NO_COMPLETED_ACTION",
      "OPEN_ACTIONS",
    ]);
  });

  it("is empty when there is an owner, a completed action and no open action", () => {
    expect(getResolutionBlockers({ ownerId: 7, actionStatuses: ["COMPLETED"] })).toEqual([]);
    expect(getResolutionBlockers({ ownerId: 7, actionStatuses: ["COMPLETED", "CANCELLED", "COMPLETED"] })).toEqual([]);
  });

  it("detects open actions (PLANNED or IN_PROGRESS) for the cancel gate", () => {
    expect(hasOpenActions(["PLANNED"])).toBe(true);
    expect(hasOpenActions(["COMPLETED", "IN_PROGRESS"])).toBe(true);
    expect(hasOpenActions(["COMPLETED", "CANCELLED"])).toBe(false);
    expect(hasOpenActions([])).toBe(false);
  });
});

describe("Ticket lock for actions (BR-14)", () => {
  it("locks RESOLVED, CLOSED and CANCELLED Tickets only", () => {
    const locked = Object.values(TicketStatus).filter((s) => isTicketLockedForActions(s));
    expect(locked.sort()).toEqual(["CANCELLED", "CLOSED", "RESOLVED"]);
  });
});

describe("Permitted transitions with Lab 4 gates (UNIT-04, BR-17..BR-19)", () => {
  it("leaves the Lab 3 matrix cells unchanged", () => {
    expect(STATUS_TRANSITIONS.NEW).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
    expect(STATUS_TRANSITIONS.RESOLVED).toEqual(["CLOSED", "REOPENED"]);
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("hides IN_PROGRESS without an owner and RESOLVED while blockers exist", () => {
    expect(getPermittedTransitionsForTicket("OPEN", null, ["NO_OWNER", "NO_COMPLETED_ACTION"])).toEqual([
      "WAITING_FOR_REQUESTER",
      "CANCELLED",
    ]);
    expect(getPermittedTransitionsForTicket("OPEN", 5, ["NO_COMPLETED_ACTION"])).toEqual([
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "CANCELLED",
    ]);
  });

  it("offers RESOLVED once the gate is satisfied", () => {
    expect(getPermittedTransitionsForTicket("IN_PROGRESS", 5, [])).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
  });

  it("keeps the two-argument Lab 3 behaviour when no blockers are passed", () => {
    expect(getPermittedTransitionsForTicket("OPEN", null)).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
  });
});

describe("Bangkok window helper (UNIT-06, BR-30)", () => {
  // Asia/Bangkok is UTC+7 with no daylight saving time.
  it("starts at 00:00 Bangkok time six days before the current Bangkok date", () => {
    // 2026-11-02 17:00 in Bangkok -> window opens 2026-10-27 00:00 Bangkok = 2026-10-26T17:00Z
    expect(bangkokWindowStart(new Date("2026-11-02T10:00:00.000Z")).toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });

  it("is unchanged just before Bangkok midnight and moves forward one day at Bangkok midnight", () => {
    expect(bangkokWindowStart(new Date("2026-11-02T16:59:59.999Z")).toISOString()).toBe("2026-10-26T17:00:00.000Z");
    expect(bangkokWindowStart(new Date("2026-11-02T17:00:00.000Z")).toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });

  it("supports a different look-back and crosses month and year boundaries", () => {
    expect(bangkokWindowStart(new Date("2026-01-03T05:00:00.000Z"), 6).toISOString()).toBe("2025-12-27T17:00:00.000Z");
    expect(bangkokWindowStart(new Date("2026-11-02T10:00:00.000Z"), 0).toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });
});
