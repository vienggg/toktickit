import { describe, it, expect } from "vitest";
import { formatTicketNumber, isValidTicketNumber } from "../../src/utils/ticketNumber";

describe("UNIT-01: Ticket Number Generator Unit Tests", () => {
  it("formats ticket number correctly as TKT-YYYY-XXXXXX", () => {
    const fixedDate = new Date(2026, 7, 20); // August 20, 2026
    const ticketNo = formatTicketNumber(1, fixedDate);
    expect(ticketNo).toBe("TKT-2026-000001");
  });

  it("pads large sequence numbers correctly to 6 digits", () => {
    const fixedDate = new Date(2026, 0, 1);
    const ticketNo = formatTicketNumber(1234, fixedDate);
    expect(ticketNo).toBe("TKT-2026-001234");
  });

  it("validates ticket number format using isValidTicketNumber", () => {
    expect(isValidTicketNumber("TKT-2026-000001")).toBe(true);
    expect(isValidTicketNumber("TKT-2026-999999")).toBe(true);
    expect(isValidTicketNumber("TKT-26-000001")).toBe(false);
    expect(isValidTicketNumber("INC-2026-000001")).toBe(false);
    expect(isValidTicketNumber("TKT-2026-123")).toBe(false);
  });
});
