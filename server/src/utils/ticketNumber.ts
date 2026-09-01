import crypto from 'crypto';

/**
 * Generates an official TokTickIT Ticket Number adhering to the format:
 * TKT-YYYY-XXXXXX (e.g. TKT-2026-000123)
 */
export function generateTicketNumber(sequenceOrRandom?: number): string {
  const year = new Date().getFullYear();
  let seqStr: string;

  if (typeof sequenceOrRandom === 'number' && Number.isFinite(sequenceOrRandom)) {
    seqStr = String(Math.abs(Math.floor(sequenceOrRandom))).padStart(6, '0').slice(-6);
  } else {
    // Generate cryptographically secure random 6-digit integer
    const randomNum = crypto.randomInt(100000, 1000000);
    seqStr = String(randomNum);
  }

  return `TKT-${year}-${seqStr}`;
}

export function isValidTicketNumber(ticketNumber: string): boolean {
  return /^TKT-\d{4}-\d{6}$/.test(ticketNumber);
}
