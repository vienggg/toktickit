// Lab 4 Actions Taken rules (docs/lab-04/specification.md BR-06..BR-14, BR-19).
// Pure functions only (no Express, no database) so the rules can be unit
// tested directly (UNIT-01..UNIT-05) and shared by every route that enforces
// them, instead of each handler re-deriving them.

export const ACTION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type ActionStatusValue = (typeof ACTION_STATUSES)[number];

// BR-11: a new action may start PLANNED (default), IN_PROGRESS or COMPLETED, never CANCELLED.
export const INITIAL_ACTION_STATUSES: ActionStatusValue[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

// BR-11: COMPLETED and CANCELLED are terminal.
const ACTION_TRANSITIONS: Record<ActionStatusValue, ActionStatusValue[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isActionStatus(value: unknown): value is ActionStatusValue {
  return typeof value === "string" && (ACTION_STATUSES as readonly string[]).includes(value);
}

export function getPermittedActionTransitions(from: ActionStatusValue): ActionStatusValue[] {
  return ACTION_TRANSITIONS[from];
}

export function isLegalActionTransition(from: string, to: string): boolean {
  return isActionStatus(from) && isActionStatus(to) && ACTION_TRANSITIONS[from].includes(to);
}

export const DESCRIPTION_MAX = 2000;
export const RESULT_MAX = 2000;
export const FOLLOW_UP_NOTE_MAX = 1000;
export const ATTACHMENT_NOTES_MAX = 1000;
export const REASON_MAX = 500;
const FUTURE_TOLERANCE_MS = 5 * 60_000; // BR-06

/** BR-09: a note is required (1-1000 chars after trimming) when follow-up is required. Returns an error message or null. */
export function validateFollowUp(followUpRequired: boolean, followUpNote: string | null | undefined): string | null {
  if (!followUpRequired) return null;
  const note = (followUpNote ?? "").trim();
  if (note.length === 0) return "A follow-up note is required when follow-up is required.";
  if (note.length > FOLLOW_UP_NOTE_MAX) return `The follow-up note must be at most ${FOLLOW_UP_NOTE_MAX} characters.`;
  return null;
}

/** BR-08: a COMPLETED action needs a non-blank result (max 2000 chars); other statuses do not. */
export function validateCompletedResult(status: string, result: string | null | undefined): string | null {
  const text = (result ?? "").trim();
  if (status === "COMPLETED" && text.length === 0) return "A result is required when the action is completed.";
  if (text.length > RESULT_MAX) return `The result must be at most ${RESULT_MAX} characters.`;
  return null;
}

/** BR-06: not later than now + 5 minutes and not before the Ticket was created. */
export function validateActionAt(actionAt: Date, now: Date, ticketCreatedAt: Date): string | null {
  if (Number.isNaN(actionAt.getTime())) return "Action date/time must be a valid date.";
  if (actionAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return "Action date/time cannot be in the future.";
  if (actionAt.getTime() < ticketCreatedAt.getTime()) return "Action date/time cannot be before the ticket was created.";
  return null;
}

export type ResolutionBlocker = "NO_OWNER" | "NO_COMPLETED_ACTION" | "OPEN_ACTIONS";

export function hasOpenActions(actionStatuses: string[]): boolean {
  return actionStatuses.some((s) => s === "PLANNED" || s === "IN_PROGRESS");
}

/** BR-19 resolution gate: owner set, at least one COMPLETED action, no PLANNED/IN_PROGRESS action. */
export function getResolutionBlockers(input: { ownerId: number | null; actionStatuses: string[] }): ResolutionBlocker[] {
  const blockers: ResolutionBlocker[] = [];
  if (input.ownerId === null) blockers.push("NO_OWNER");
  if (!input.actionStatuses.some((s) => s === "COMPLETED")) blockers.push("NO_COMPLETED_ACTION");
  if (hasOpenActions(input.actionStatuses)) blockers.push("OPEN_ACTIONS");
  return blockers;
}

// BR-14: actions can only be created or edited while the Ticket is not RESOLVED, CLOSED or CANCELLED.
const LOCKED_TICKET_STATUSES = new Set<string>(["RESOLVED", "CLOSED", "CANCELLED"]);
export function isTicketLockedForActions(ticketStatus: string): boolean {
  return LOCKED_TICKET_STATUSES.has(ticketStatus);
}

export const BLOCKER_MESSAGES: Record<ResolutionBlocker, string> = {
  NO_OWNER: "The ticket needs an owner.",
  NO_COMPLETED_ACTION: "At least one action must be completed.",
  OPEN_ACTIONS: "Finish or cancel the planned and in-progress actions.",
};
