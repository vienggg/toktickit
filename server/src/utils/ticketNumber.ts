/**
 * Generates an official unique Ticket Number formatted as TKT-YYYY-XXXXXX
 * e.g. TKT-2026-000001
 * 
 * @param sequence The sequential integer ID of the ticket
 * @param date Optional date to extract 4-digit year from (defaults to now)
 */
export function formatTicketNumber(sequence: number, date: Date = new Date()): string {
  const year = date.getFullYear();
  const paddedSequence = String(sequence).padStart(6, "0");
  return `TKT-${year}-${paddedSequence}`;
}

export function isValidTicketNumber(ticketNumber: string): boolean {
  return /^TKT-\d{4}-\d{6}$/.test(ticketNumber);
}
