import { describe, it, expect } from 'vitest';
import { generateTicketNumber, isValidTicketNumber } from '../../src/utils/ticketNumber';

describe('Ticket Number Generator Utility (UNIT-01, UNIT-02)', () => {
  it('UNIT-01: generates official ticket number matching TKT-YYYY-XXXXXX format', () => {
    const currentYear = new Date().getFullYear();
    const ticketNumber = generateTicketNumber();

    expect(ticketNumber).toBeDefined();
    expect(ticketNumber).toMatch(new RegExp(`^TKT-${currentYear}-\\d{6}$`));
    expect(isValidTicketNumber(ticketNumber)).toBe(true);
  });

  it('UNIT-02: formats sequential numbers with zero padding and handles distinct numbers', () => {
    const currentYear = new Date().getFullYear();
    const ticket1 = generateTicketNumber(1);
    const ticket42 = generateTicketNumber(42);
    const ticket999999 = generateTicketNumber(999999);

    expect(ticket1).toBe(`TKT-${currentYear}-000001`);
    expect(ticket42).toBe(`TKT-${currentYear}-000042`);
    expect(ticket999999).toBe(`TKT-${currentYear}-999999`);

    const random1 = generateTicketNumber();
    const random2 = generateTicketNumber();
    expect(isValidTicketNumber(random1)).toBe(true);
    expect(isValidTicketNumber(random2)).toBe(true);
  });

  it('validates invalid ticket number patterns correctly', () => {
    expect(isValidTicketNumber('INVALID-123')).toBe(false);
    expect(isValidTicketNumber('TKT-2026-123')).toBe(false); // too short
    expect(isValidTicketNumber('TKT-2026-1234567')).toBe(false); // too long
    expect(isValidTicketNumber('tkt-2026-123456')).toBe(false); // lowercase
  });
});
