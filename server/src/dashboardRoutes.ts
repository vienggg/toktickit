import type { Express, Request, Response } from "express";
import { Role, TicketStatus, Priority } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import { ACTIVE_TICKET_STATUSES } from "./utils/statusTransitions.js";
import { bangkokWindowStart } from "./utils/bangkokTime.js";

// Lab 4 (I-5): role dashboards. Spec: docs/lab-04/specification.md BR-27..BR-37,
// api-spec.md §3. Every number is computed here from the database at request time;
// the client never calculates a metric (BR-27), and lists are capped at 5 rows (BR-31).

const LIST_SIZE = 5;
const ALL_STATUSES = Object.values(TicketStatus);
// Most severe first, the order the dashboard strip shows them in.
const PRIORITIES_BY_SEVERITY: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const ACTIVE = { in: [...ACTIVE_TICKET_STATUSES] };

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function registerDashboardRoutes(app: Express) {
  // FR-14, BR-28: summarises only the authenticated Requester's own Tickets; any
  // requesterId in the request is ignored.
  app.get(
    "/api/dashboard/requester",
    requireAuth,
    requirePasswordChanged,
    requireRole(Role.REQUESTER),
    async (req: Request, res: Response) => {
      try {
        const me = req.authUser!.id;
        const prisma = getPrisma();
        const now = new Date();
        const windowStart = bangkokWindowStart(now);
        const summary = { id: true, ticketNumber: true, summary: true, status: true, updatedAt: true } as const;

        const [open, waiting, resolved, closed, recentlyUpdated, recentlyResolved] = await Promise.all([
          prisma.ticket.count({ where: { requesterId: me, status: ACTIVE } }),
          prisma.ticket.count({ where: { requesterId: me, status: TicketStatus.WAITING_FOR_REQUESTER } }),
          prisma.ticket.count({ where: { requesterId: me, status: TicketStatus.RESOLVED } }),
          prisma.ticket.count({ where: { requesterId: me, status: TicketStatus.CLOSED } }),
          prisma.ticket.findMany({ where: { requesterId: me }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: LIST_SIZE, select: summary }),
          prisma.ticket.findMany({
            where: { requesterId: me, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, resolvedAt: { gte: windowStart } },
            orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
            take: LIST_SIZE,
            select: { ...summary, resolvedAt: true },
          }),
        ]);

        return res.status(200).json({
          generatedAt: now.toISOString(),
          timeZone: "Asia/Bangkok",
          metrics: {
            openTickets: { count: open, href: "/tickets?status=ACTIVE" },
            waitingForRequester: { count: waiting, href: "/tickets?status=WAITING_FOR_REQUESTER" },
            resolved: { count: resolved, href: "/tickets?status=RESOLVED" },
            closed: { count: closed, href: "/tickets?status=CLOSED" },
          },
          recentlyUpdated: recentlyUpdated.map((t) => ({ ...t, href: `/tickets/${t.id}` })),
          recentlyResolved: recentlyResolved.map((t) => ({ ...t, href: `/tickets/${t.id}` })),
        });
      } catch (err) {
        console.error("Requester dashboard error:", err);
        return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load the dashboard." } });
      }
    }
  );

  // FR-15, FR-16: IT Staff and Administrators. Only Administrators also receive userCounts (BR-37).
  app.get(
    "/api/dashboard/staff",
    requireAuth,
    requirePasswordChanged,
    requireRole(Role.IT_STAFF, Role.ADMINISTRATOR),
    async (req: Request, res: Response) => {
      try {
        const me = req.authUser!;
        const isAdmin = me.role === Role.ADMINISTRATOR;
        const prisma = getPrisma();
        const openAction = { in: ["PLANNED", "IN_PROGRESS"] as Array<"PLANNED" | "IN_PROGRESS"> };
        const summary = { id: true, ticketNumber: true, summary: true, status: true, updatedAt: true } as const;

        const [
          unassigned,
          myOwned,
          myOpenActions,
          pendingFollowUps,
          waiting,
          statusGroups,
          priorityGroups,
          attention,
          myActionRows,
          recentlyUpdated,
          roleGroups,
          activeUsers,
          inactiveUsers,
        ] = await Promise.all([
          prisma.ticket.count({ where: { ownerId: null, status: ACTIVE } }),
          prisma.ticket.count({ where: { ownerId: me.id, status: ACTIVE } }),
          prisma.actionTaken.count({ where: { assigneeId: me.id, status: openAction } }),
          prisma.ticket.count({ where: { status: ACTIVE, actionsTaken: { some: { followUpRequired: true, status: { not: "CANCELLED" } } } } }),
          prisma.ticket.count({ where: { status: TicketStatus.WAITING_FOR_REQUESTER } }),
          prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.ticket.groupBy({ by: ["itPriority"], where: { status: ACTIVE }, _count: { _all: true } }),
          prisma.ticket.findMany({
            where: { status: ACTIVE, OR: [{ itPriority: { in: ["URGENT", "HIGH"] } }, { requesterResolvedAt: { not: null } }] },
            // Postgres sorts enums in declaration order (LOW < MEDIUM < HIGH < URGENT), so "desc" is most severe first.
            orderBy: [{ itPriority: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
            take: LIST_SIZE,
            select: { ...summary, itPriority: true, requesterResolvedAt: true },
          }),
          prisma.actionTaken.findMany({
            where: { assigneeId: me.id, status: openAction },
            orderBy: [{ actionAt: "asc" }, { id: "asc" }],
            take: LIST_SIZE,
            select: { id: true, ticketId: true, description: true, status: true, actionAt: true, ticket: { select: { ticketNumber: true } } },
          }),
          prisma.ticket.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: LIST_SIZE, select: summary }),
          isAdmin ? prisma.user.groupBy({ by: ["role"], _count: { _all: true } }) : Promise.resolve([]),
          isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),
          isAdmin ? prisma.user.count({ where: { isActive: false } }) : Promise.resolve(0),
        ]);

        const body: Record<string, unknown> = {
          generatedAt: new Date().toISOString(),
          timeZone: "Asia/Bangkok",
          metrics: {
            unassigned: { count: unassigned, href: "/staff/queue?ownerId=unassigned&status=ACTIVE" },
            myOwnedTickets: { count: myOwned, href: `/staff/queue?ownerId=${me.id}&status=ACTIVE` },
            myOpenActions: { count: myOpenActions, href: "#my-actions" },
            pendingFollowUps: { count: pendingFollowUps, href: "/staff/queue?followUp=true&status=ACTIVE" },
            waitingForRequester: { count: waiting, href: "/staff/queue?status=WAITING_FOR_REQUESTER" },
          },
          // All 8 statuses and all 4 priorities are always present, zeros included (BR-32, BR-35).
          byStatus: ALL_STATUSES.map((status) => ({
            status,
            count: statusGroups.find((g) => g.status === status)?._count._all ?? 0,
            href: `/staff/queue?status=${status}`,
          })),
          byItPriority: PRIORITIES_BY_SEVERITY.map((priority) => ({
            priority,
            count: priorityGroups.find((g) => g.itPriority === priority)?._count._all ?? 0,
            href: `/staff/queue?itPriority=${priority}&status=ACTIVE`,
          })),
          attention: attention.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            summary: t.summary,
            status: t.status,
            itPriority: t.itPriority,
            requesterSignalledResolved: t.requesterResolvedAt !== null,
            updatedAt: t.updatedAt,
            href: `/staff/tickets/${t.id}`,
          })),
          myOpenActionsList: myActionRows.map((a) => ({
            actionId: a.id,
            ticketId: a.ticketId,
            ticketNumber: a.ticket.ticketNumber,
            description: truncate(a.description, 120),
            status: a.status,
            actionAt: a.actionAt,
            href: `/staff/tickets/${a.ticketId}#actions`,
          })),
          recentlyUpdated: recentlyUpdated.map((t) => ({ ...t, href: `/staff/tickets/${t.id}` })),
        };

        if (isAdmin) {
          const byRole: Record<string, number> = { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 0 };
          for (const g of roleGroups as Array<{ role: Role; _count: { _all: number } }>) byRole[g.role] = g._count._all;
          body.userCounts = { byRole, active: activeUsers, inactive: inactiveUsers, href: "/admin/users" };
        }
        return res.status(200).json(body);
      } catch (err) {
        console.error("Staff dashboard error:", err);
        return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load the dashboard." } });
      }
    }
  );
}
