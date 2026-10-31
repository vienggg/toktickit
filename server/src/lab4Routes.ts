import type { Express, Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import {
  ATTACHMENT_NOTES_MAX,
  DESCRIPTION_MAX,
  FOLLOW_UP_NOTE_MAX,
  INITIAL_ACTION_STATUSES,
  RESULT_MAX,
  getPermittedActionTransitions,
  isActionStatus,
  isLegalActionTransition,
  isTicketLockedForActions,
  validateActionAt,
  validateCompletedResult,
  validateFollowUp,
  type ActionStatusValue,
} from "./utils/actionRules.js";

// Lab 4 routes for Actions Taken (I-3) and the Ticket status history.
// Spec: docs/lab-04/specification.md (BR-01..BR-15, BR-24..BR-26), api-spec.md §1-§2.
// Helpers that live in app.ts are injected rather than imported to avoid a circular import.

interface Deps {
  parseStrictId(raw: string | undefined): number | null;
  fetchAuthorizedTicketOr404<T extends { requesterId: number }>(
    res: Response,
    fetchTicket: () => Promise<T | null>,
    isAuthorized: (ticket: T) => boolean
  ): Promise<T | null>;
}

const USER_REF = { select: { id: true, name: true } } as const;
const ACTION_INCLUDE = { createdBy: USER_REF, assignee: USER_REF, updatedBy: USER_REF } satisfies Prisma.ActionTakenInclude;
type ActionRow = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_INCLUDE }>;

function validationError(field: string, message: string) {
  return { error: { code: "VALIDATION_ERROR", message: `Invalid '${field}': ${message}`, field } };
}

/** BR-04, api-spec §1: Requesters get the same fields minus version and updatedBy; clientRequestId is never returned. */
export function serializeAction(a: ActionRow, view: "staff" | "requester") {
  const base = {
    id: a.id,
    ticketId: a.ticketId,
    actionAt: a.actionAt,
    description: a.description,
    result: a.result,
    status: a.status,
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote,
    attachmentNotes: a.attachmentNotes,
    createdBy: a.createdBy,
    assignee: a.assignee,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    completedAt: a.completedAt,
  };
  return view === "staff" ? { ...base, updatedBy: a.updatedBy, version: a.version } : base;
}

interface ParsedAction {
  actionAt?: Date;
  description?: string;
  result?: string | null;
  status?: ActionStatusValue;
  assigneeId?: number;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}
type FieldError = { field: string; message: string };

function optionalText(value: unknown, field: string, max: number): { value: string | null } | FieldError {
  if (value === null) return { value: null };
  if (typeof value !== "string") return { field, message: "must be a string or null." };
  const trimmed = value.trim();
  if (trimmed.length > max) return { field, message: `must be at most ${max} characters.` };
  return { value: trimmed.length === 0 ? null : trimmed };
}

/** Shape and length validation of the writable fields (BR-06..BR-10); cross-field rules are checked by the caller. */
function parseActionBody(body: unknown, mode: "create" | "patch"): { error: FieldError } | { data: ParsedAction } {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: ParsedAction = {};

  if (b.description !== undefined || mode === "create") {
    if (typeof b.description !== "string" || b.description.trim().length === 0) {
      return { error: { field: "description", message: `is required (1-${DESCRIPTION_MAX} characters).` } };
    }
    if (b.description.trim().length > DESCRIPTION_MAX) {
      return { error: { field: "description", message: `must be at most ${DESCRIPTION_MAX} characters.` } };
    }
    data.description = b.description.trim();
  }
  for (const [field, max] of [["result", RESULT_MAX], ["followUpNote", FOLLOW_UP_NOTE_MAX], ["attachmentNotes", ATTACHMENT_NOTES_MAX]] as const) {
    if (b[field] === undefined) continue;
    const parsed = optionalText(b[field], field, max);
    if ("field" in parsed) return { error: parsed };
    data[field] = parsed.value;
  }
  if (b.status !== undefined) {
    const allowed = mode === "create" ? INITIAL_ACTION_STATUSES : undefined;
    if (!isActionStatus(b.status) || (allowed && !allowed.includes(b.status))) {
      const list = (allowed ?? ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).join(", ");
      return { error: { field: "status", message: `must be one of ${list}.` } };
    }
    data.status = b.status;
  }
  if (b.assigneeId !== undefined) {
    if (!Number.isInteger(b.assigneeId)) return { error: { field: "assigneeId", message: "must be an integer." } };
    data.assigneeId = b.assigneeId as number;
  }
  if (b.followUpRequired !== undefined) {
    if (typeof b.followUpRequired !== "boolean") return { error: { field: "followUpRequired", message: "must be true or false." } };
    data.followUpRequired = b.followUpRequired;
  }
  if (b.actionAt !== undefined) {
    const when = typeof b.actionAt === "string" || typeof b.actionAt === "number" ? new Date(b.actionAt) : new Date(NaN);
    if (Number.isNaN(when.getTime())) return { error: { field: "actionAt", message: "must be a valid date/time." } };
    data.actionAt = when;
  }
  return { data };
}

function crossFieldError(m: { status: string; result: string | null; followUpRequired: boolean; followUpNote: string | null }): FieldError | null {
  const note = validateFollowUp(m.followUpRequired, m.followUpNote);
  if (note) return { field: "followUpNote", message: note };
  const result = validateCompletedResult(m.status, m.result);
  if (result) return { field: "result", message: result };
  return null;
}

/** BR-05: the assignee must be an active IT Staff or Administrator user. */
async function isValidAssignee(assigneeId: number): Promise<boolean> {
  const user = await getPrisma().user.findUnique({ where: { id: assigneeId }, select: { isActive: true, role: true } });
  return !!user && user.isActive && (user.role === Role.IT_STAFF || user.role === Role.ADMINISTRATOR);
}

const INVALID_ASSIGNEE = {
  error: { code: "INVALID_ASSIGNEE", message: "The assignee must be an active IT Staff or Administrator user." },
};

/** Row lock on the Ticket so action writes and status changes (the resolution gate, BR-19) never interleave. */
async function lockTicket(tx: Prisma.TransactionClient, ticketId: number) {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
}

const staffOnly = [requireAuth, requirePasswordChanged, requireRole(Role.IT_STAFF, Role.ADMINISTRATOR)];

export function registerLab4Routes(app: Express, deps: Deps) {
  // FR-01, FR-06: staff see every action; a Requester sees their own Ticket's actions read-only.
  app.get("/api/tickets/:id/actions", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
    try {
      const id = deps.parseStrictId(req.params.id);
      if (id === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID." } });
      const user = req.authUser!;
      const isStaff = user.role === Role.IT_STAFF || user.role === Role.ADMINISTRATOR;
      const ticket = await deps.fetchAuthorizedTicketOr404(
        res,
        () => getPrisma().ticket.findUnique({ where: { id }, select: { id: true, requesterId: true } }),
        (t) => isStaff || t.requesterId === user.id
      );
      if (!ticket) return;
      const rows = await getPrisma().actionTaken.findMany({
        where: { ticketId: id },
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        include: ACTION_INCLUDE,
      });
      return res.status(200).json({ items: rows.map((r) => serializeAction(r, isStaff ? "staff" : "requester")), total: rows.length });
    } catch (err) {
      console.error("List actions error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch actions." } });
    }
  });

  app.post("/api/staff/tickets/:id/actions", ...staffOnly, async (req: Request, res: Response) => {
    try {
      const id = deps.parseStrictId(req.params.id);
      if (id === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID." } });
      const ticket = await deps.fetchAuthorizedTicketOr404(
        res,
        () => getPrisma().ticket.findUnique({ where: { id }, select: { id: true, requesterId: true, createdAt: true } }),
        () => true
      );
      if (!ticket) return;

      const parsed = parseActionBody(req.body, "create");
      if ("error" in parsed) return res.status(400).json(validationError(parsed.error.field, parsed.error.message));
      const d = parsed.data;

      const clientRequestId = (req.body ?? {}).clientRequestId;
      if (clientRequestId !== undefined && (typeof clientRequestId !== "string" || clientRequestId.length < 8 || clientRequestId.length > 64)) {
        return res.status(400).json(validationError("clientRequestId", "must be a string of 8-64 characters."));
      }

      const user = req.authUser!;
      const now = new Date();
      const status = d.status ?? "PLANNED";
      const actionAt = d.actionAt ?? now;
      const followUpRequired = d.followUpRequired ?? false;
      const followUpNote = followUpRequired ? d.followUpNote ?? null : null;
      const result = d.result ?? null;

      const timeError = validateActionAt(actionAt, now, ticket.createdAt);
      if (timeError) return res.status(400).json(validationError("actionAt", timeError));
      const mixed = crossFieldError({ status, result, followUpRequired, followUpNote });
      if (mixed) return res.status(400).json(validationError(mixed.field, mixed.message));

      const assigneeId = d.assigneeId ?? user.id;
      if (assigneeId !== user.id && !(await isValidAssignee(assigneeId))) return res.status(422).json(INVALID_ASSIGNEE);

      const outcome = await getPrisma().$transaction(async (tx) => {
        await lockTicket(tx, id);
        if (clientRequestId !== undefined) {
          const existing = await tx.actionTaken.findUnique({
            where: { ticketId_clientRequestId: { ticketId: id, clientRequestId } },
            include: ACTION_INCLUDE,
          });
          if (existing) return { kind: "replay" as const, action: existing };
        }
        const fresh = await tx.ticket.findUniqueOrThrow({ where: { id }, select: { status: true } });
        if (isTicketLockedForActions(fresh.status)) return { kind: "locked" as const };
        const created = await tx.actionTaken.create({
          data: {
            ticketId: id,
            actionAt,
            description: d.description as string,
            result,
            status,
            followUpRequired,
            followUpNote,
            attachmentNotes: d.attachmentNotes ?? null,
            createdById: user.id,
            assigneeId,
            clientRequestId: clientRequestId ?? null,
            completedAt: status === "COMPLETED" ? now : null,
          },
          include: ACTION_INCLUDE,
        });
        await tx.ticket.update({ where: { id }, data: { updatedAt: now } });
        return { kind: "created" as const, action: created };
      });

      if (outcome.kind === "locked") return res.status(409).json(ticketLocked());
      return res.status(outcome.kind === "created" ? 201 : 200).json(serializeAction(outcome.action, "staff"));
    } catch (err) {
      console.error("Create action error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create the action." } });
    }
  });

  app.patch("/api/staff/tickets/:id/actions/:actionId", ...staffOnly, async (req: Request, res: Response) => {
    try {
      const id = deps.parseStrictId(req.params.id);
      const actionId = deps.parseStrictId(req.params.actionId);
      if (id === null || actionId === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ID." } });

      const expectedVersion = (req.body ?? {}).expectedVersion;
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return res.status(400).json(validationError("expectedVersion", "is required and must be a positive integer."));
      }
      const parsed = parseActionBody(req.body, "patch");
      if ("error" in parsed) return res.status(400).json(validationError(parsed.error.field, parsed.error.message));
      const d = parsed.data;

      const ticket = await deps.fetchAuthorizedTicketOr404(
        res,
        () => getPrisma().ticket.findUnique({ where: { id }, select: { id: true, requesterId: true, createdAt: true } }),
        () => true
      );
      if (!ticket) return;

      const user = req.authUser!;
      const now = new Date();
      if (d.actionAt) {
        const timeError = validateActionAt(d.actionAt, now, ticket.createdAt);
        if (timeError) return res.status(400).json(validationError("actionAt", timeError));
      }
      if (d.assigneeId !== undefined && !(await isValidAssignee(d.assigneeId))) return res.status(422).json(INVALID_ASSIGNEE);

      const outcome = await getPrisma().$transaction(async (tx) => {
        await lockTicket(tx, id);
        const current = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId: id }, include: ACTION_INCLUDE });
        if (!current) return { kind: "notFound" as const };
        const fresh = await tx.ticket.findUniqueOrThrow({ where: { id }, select: { status: true } });
        if (isTicketLockedForActions(fresh.status)) return { kind: "ticketLocked" as const };
        if (current.version !== expectedVersion) return { kind: "stale" as const, current };
        if (current.status === "COMPLETED" || current.status === "CANCELLED") return { kind: "actionLocked" as const };

        const status = d.status ?? current.status;
        if (status !== current.status && !isLegalActionTransition(current.status, status)) {
          return { kind: "illegal" as const, permitted: getPermittedActionTransitions(current.status) };
        }
        const followUpRequired = d.followUpRequired ?? current.followUpRequired;
        const followUpNote = followUpRequired ? (d.followUpNote !== undefined ? d.followUpNote : current.followUpNote) : null;
        const result = d.result !== undefined ? d.result : current.result;
        const invalid = crossFieldError({ status, result, followUpRequired, followUpNote });
        if (invalid) return { kind: "invalid" as const, error: invalid };

        const updated = await tx.actionTaken.update({
          where: { id: actionId },
          data: {
            ...(d.description !== undefined && { description: d.description }),
            ...(d.actionAt !== undefined && { actionAt: d.actionAt }),
            ...(d.assigneeId !== undefined && { assigneeId: d.assigneeId }),
            ...(d.attachmentNotes !== undefined && { attachmentNotes: d.attachmentNotes }),
            status,
            result,
            followUpRequired,
            followUpNote,
            // current is PLANNED or IN_PROGRESS here (terminal actions returned ACTION_LOCKED above).
            completedAt: status === "COMPLETED" ? now : current.completedAt,
            updatedById: user.id,
            version: { increment: 1 },
          },
          include: ACTION_INCLUDE,
        });
        await tx.ticket.update({ where: { id }, data: { updatedAt: now } });
        return { kind: "updated" as const, action: updated };
      });

      switch (outcome.kind) {
        case "notFound":
          return res.status(404).json({ error: { code: "NOT_FOUND", message: "Action not found." } });
        case "ticketLocked":
          return res.status(409).json(ticketLocked());
        case "stale":
          return res.status(409).json({
            error: { code: "STALE_UPDATE", message: "This action was changed by someone else. Reload the latest version.", current: serializeAction(outcome.current, "staff") },
          });
        case "actionLocked":
          return res.status(409).json({ error: { code: "ACTION_LOCKED", message: "Completed and cancelled actions cannot be changed. Record a new action instead." } });
        case "illegal":
          return res.status(409).json({ error: { code: "ILLEGAL_ACTION_TRANSITION", message: "That status change is not allowed.", permitted: outcome.permitted } });
        case "invalid":
          return res.status(400).json(validationError(outcome.error.field, outcome.error.message));
        default:
          return res.status(200).json(serializeAction(outcome.action, "staff"));
      }
    } catch (err) {
      console.error("Update action error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update the action." } });
    }
  });

  // BR-24: append-only status history. Requesters (own Tickets only) never receive the staff-entered reason.
  app.get("/api/tickets/:id/history", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
    try {
      const id = deps.parseStrictId(req.params.id);
      if (id === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID." } });
      const user = req.authUser!;
      const isStaff = user.role === Role.IT_STAFF || user.role === Role.ADMINISTRATOR;
      const ticket = await deps.fetchAuthorizedTicketOr404(
        res,
        () => getPrisma().ticket.findUnique({ where: { id }, select: { id: true, requesterId: true } }),
        (t) => isStaff || t.requesterId === user.id
      );
      if (!ticket) return;
      const rows = await getPrisma().ticketStatusHistory.findMany({
        where: { ticketId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { changedBy: USER_REF },
      });
      return res.status(200).json({
        items: rows.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          changedBy: h.changedBy,
          createdAt: h.createdAt,
          ...(isStaff && { reason: h.reason }),
        })),
      });
    } catch (err) {
      console.error("Ticket history error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch the status history." } });
    }
  });
}

function ticketLocked() {
  return {
    error: {
      code: "TICKET_LOCKED",
      message: "Actions cannot be added or changed while the ticket is Resolved, Closed or Cancelled. Reopen it first.",
    },
  };
}
