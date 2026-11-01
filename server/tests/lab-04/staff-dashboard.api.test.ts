import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRegressionRequester, loginAsRegressionStaff } from "../helpers/testAuth.js";
import { createTicket, createAction, ensureLab4Users, type Lab4Users } from "../helpers/lab4.js";
import { createLoggedInUser, eventuallyEqual, withFreshAdmin, ACTIVE_STATUSES } from "../helpers/lab4Dashboard.js";

// Org-wide comparisons wait out heavy writers in other test files (e.g. the 64-ticket matrix test), so allow time.
vi.setConfig({ testTimeout: 60_000 });

// DASH-06..DASH-11, PERF-01 (docs/lab-04/tests.md): the staff/admin dashboard (AC-22..AC-25, AC-32).
const ALL_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

describe("Staff dashboard API (DASH-06..DASH-11)", () => {
  let u: Lab4Users;
  let requester: SuperTestAgent;
  let staff: SuperTestAgent;
  let admin: SuperTestAgent;

  beforeAll(async () => {
    u = await ensureLab4Users();
    [requester, staff, admin] = await Promise.all([loginAsRegressionRequester(), loginAsRegressionStaff(), Promise.resolve(undefined as unknown as SuperTestAgent)]);
  });

  const dash = (agent: SuperTestAgent) => agent.get("/api/dashboard/staff");
  const adminDash = async () => (await withFreshAdmin((a) => dash(a))).res;
  const prisma = () => getPrisma();
  const active = { in: [...ACTIVE_STATUSES] };

  it("DASH-06a: per-user metrics for a dedicated staff user equal their direct queries", async () => {
    const me = await createLoggedInUser("IT_STAFF", "metrics");
    const t1 = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: me.id });
    const t2 = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: me.id });
    await createTicket({ requesterId: u.requesterId, status: "CLOSED", ownerId: me.id });
    await createAction({ ticketId: t1.id, userId: u.staffAId, assigneeId: me.id, status: "PLANNED" });
    await createAction({ ticketId: t2.id, userId: u.staffAId, assigneeId: me.id, status: "IN_PROGRESS" });
    await createAction({ ticketId: t2.id, userId: u.staffAId, assigneeId: me.id, status: "COMPLETED" });
    await createAction({ ticketId: t2.id, userId: u.staffAId, assigneeId: me.id, status: "CANCELLED" });

    const res = await dash(me.agent);
    expect(res.status).toBe(200);
    expect(res.body.metrics.myOwnedTickets.count).toBe(await prisma().ticket.count({ where: { ownerId: me.id, status: active } }));
    expect(res.body.metrics.myOwnedTickets.count).toBe(2);
    expect(res.body.metrics.myOpenActions.count).toBe(
      await prisma().actionTaken.count({ where: { assigneeId: me.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } })
    );
    expect(res.body.metrics.myOpenActions.count).toBe(2);
    expect(res.body.metrics.myOwnedTickets.href).toBe(`/staff/queue?ownerId=${me.id}&status=ACTIVE`);
    expect(res.body.metrics.myOpenActions.href).toBe("#my-actions");
    expect(res.body.myOpenActionsList.map((a: { actionId: number }) => a.actionId)).toHaveLength(2);
    expect(res.body.myOpenActionsList[0]).toMatchObject({ ticketId: expect.any(Number), ticketNumber: expect.any(String), status: expect.stringMatching(/PLANNED|IN_PROGRESS/) });
    expect(res.body.myOpenActionsList[0].href).toMatch(/^\/staff\/tickets\/\d+#actions$/);
  });

  it("DASH-06b: org-wide metrics, status counts and priority counts equal the direct SQL/Prisma queries", async () => {
    const orgWide = async () => {
      const res = await dash(staff);
      expect(res.status).toBe(200);
      return {
        unassigned: res.body.metrics.unassigned.count,
        waiting: res.body.metrics.waitingForRequester.count,
        followUps: res.body.metrics.pendingFollowUps.count,
        byStatus: Object.fromEntries(res.body.byStatus.map((s: { status: string; count: number }) => [s.status, s.count])),
        byPriority: Object.fromEntries(res.body.byItPriority.map((p: { priority: string; count: number }) => [p.priority, p.count])),
      };
    };
    const fromDb = async () => {
      const grouped = await prisma().ticket.groupBy({ by: ["status"], _count: { _all: true } });
      const prio = await prisma().ticket.groupBy({ by: ["itPriority"], where: { status: active }, _count: { _all: true } });
      return {
        unassigned: await prisma().ticket.count({ where: { ownerId: null, status: active } }),
        waiting: await prisma().ticket.count({ where: { status: "WAITING_FOR_REQUESTER" } }),
        followUps: await prisma().ticket.count({
          where: { status: active, actionsTaken: { some: { followUpRequired: true, status: { not: "CANCELLED" } } } },
        }),
        byStatus: Object.fromEntries(ALL_STATUSES.map((s) => [s, grouped.find((g) => g.status === s)?._count._all ?? 0])),
        byPriority: Object.fromEntries(PRIORITIES.map((p) => [p, prio.find((g) => g.itPriority === p)?._count._all ?? 0])),
      };
    };
    const { api, db } = await eventuallyEqual(orgWide, fromDb);
    expect(api).toEqual(db);

    const res = await dash(staff);
    expect(res.body.byStatus.map((s: { status: string }) => s.status)).toEqual(ALL_STATUSES);
    // Most severe first, all four priorities always present (zeros included).
    expect(res.body.byItPriority.map((p: { priority: string }) => p.priority)).toEqual(["URGENT", "HIGH", "MEDIUM", "LOW"]);
    expect(res.body.metrics.unassigned.href).toBe("/staff/queue?ownerId=unassigned&status=ACTIVE");
    expect(res.body.metrics.pendingFollowUps.href).toBe("/staff/queue?followUp=true&status=ACTIVE");
    expect(res.body.metrics.waitingForRequester.href).toBe("/staff/queue?status=WAITING_FOR_REQUESTER");
  });

  it("DASH-06c: pending follow-ups count distinct active Tickets with a non-cancelled follow-up action", async () => {
    const before = (await dash(staff)).body.metrics.pendingFollowUps.count as number;
    const ticket = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: u.staffAId });
    for (let i = 0; i < 2; i++) {
      await prisma().actionTaken.create({
        data: { ticketId: ticket.id, actionAt: new Date(), description: "follow", followUpRequired: true, followUpNote: "later", createdById: u.staffAId, assigneeId: u.staffAId },
      });
    }
    const cancelledOnly = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: u.staffAId });
    await prisma().actionTaken.create({
      data: { ticketId: cancelledOnly.id, actionAt: new Date(), description: "x", status: "CANCELLED", followUpRequired: true, followUpNote: "n", createdById: u.staffAId, assigneeId: u.staffAId },
    });
    const closed = await createTicket({ requesterId: u.requesterId, status: "CLOSED", ownerId: u.staffAId });
    await prisma().actionTaken.create({
      data: { ticketId: closed.id, actionAt: new Date(), description: "x", followUpRequired: true, followUpNote: "n", createdById: u.staffAId, assigneeId: u.staffAId },
    });
    const { api, db } = await eventuallyEqual(
      async () => (await dash(staff)).body.metrics.pendingFollowUps.count as number,
      () => prisma().ticket.count({ where: { status: active, actionsTaken: { some: { followUpRequired: true, status: { not: "CANCELLED" } } } } })
    );
    expect(api).toBe(db);
    expect(api).toBeGreaterThanOrEqual(before - 5);
    const filtered = await staff.get("/api/staff/tickets?followUp=true&status=ACTIVE&pageSize=50");
    const numbers = filtered.body.data.map((t: { id: number }) => t.id);
    expect(numbers).toContain(ticket.id);
    expect(numbers).not.toContain(cancelledOnly.id);
    expect(numbers).not.toContain(closed.id);
  });

  it("DASH-07: every filter-based drill-down link opens a list whose total equals the card", async () => {
    const me = await createLoggedInUser("IT_STAFF", "drill");
    await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: me.id });
    await createTicket({ requesterId: u.requesterId, status: "WAITING_FOR_REQUESTER", ownerId: me.id });

    const toApi = (href: string) => href.replace("/staff/queue", "/api/staff/tickets") + (href.includes("?") ? "&" : "?") + "pageSize=1";
    const cards: Array<{ name: string; href: string; count: () => Promise<number> }> = [];
    const first = (await dash(me.agent)).body;
    for (const [name, metric] of Object.entries(first.metrics) as Array<[string, { count: number; href: string }]>) {
      if (metric.href.startsWith("#")) continue;
      cards.push({ name, href: metric.href, count: async () => (await dash(me.agent)).body.metrics[name].count });
    }
    expect(cards.map((c) => c.name).sort()).toEqual(["myOwnedTickets", "pendingFollowUps", "unassigned", "waitingForRequester"]);
    for (const card of cards) {
      const { api, db } = await eventuallyEqual(card.count, async () => (await me.agent.get(toApi(card.href))).body.pagination.total as number);
      expect(api, card.name).toBe(db);
    }
    for (const row of [...first.byStatus, ...first.byItPriority] as Array<{ count: number; href: string }>) {
      expect(row.href).toMatch(/^\/staff\/queue\?(status|itPriority)=/);
    }
    const urgent = first.byItPriority.find((p: { priority: string }) => p.priority === "URGENT");
    expect(urgent.href).toBe("/staff/queue?itPriority=URGENT&status=ACTIVE");
    const { api, db } = await eventuallyEqual(
      async () => ((await dash(me.agent)).body.byItPriority.find((p: { priority: string }) => p.priority === "URGENT").count as number),
      async () => (await me.agent.get(toApi(urgent.href))).body.pagination.total as number
    );
    expect(api).toBe(db);
  });

  it("DASH-08: a staff user with nothing owned or assigned sees zero personal metrics (AC-24)", async () => {
    const idle = await createLoggedInUser("IT_STAFF", "idle");
    const res = await dash(idle.agent);
    expect(res.status).toBe(200);
    expect(res.body.metrics.myOwnedTickets.count).toBe(0);
    expect(res.body.metrics.myOpenActions.count).toBe(0);
    expect(res.body.myOpenActionsList).toEqual([]);
    expect(res.body).not.toHaveProperty("userCounts");
  });

  it("DASH-09: only Administrators receive user-account counts, equal to the User table (AC-25)", async () => {
    expect((await dash(staff)).body).not.toHaveProperty("userCounts");
    const read = async () => {
      const body = (await adminDash()).body;
      expect(body.userCounts.href).toBe("/admin/users");
      return { byRole: body.userCounts.byRole, active: body.userCounts.active, inactive: body.userCounts.inactive };
    };
    const fromDb = async () => {
      const byRole = { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 0 } as Record<string, number>;
      for (const g of await prisma().user.groupBy({ by: ["role"], _count: { _all: true } })) byRole[g.role] = g._count._all;
      return {
        byRole,
        active: await prisma().user.count({ where: { isActive: true } }),
        inactive: await prisma().user.count({ where: { isActive: false } }),
      };
    };
    const { api, db } = await eventuallyEqual(read, fromDb);
    expect(api).toEqual(db);
  });

  it("DASH-10: the attention list holds only active urgent/high or requester-signalled Tickets, most severe first, max 5", async () => {
    await createTicket({ requesterId: u.requesterId, status: "OPEN", itPriority: "URGENT" });
    await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", itPriority: "LOW", requesterResolvedAt: new Date() });
    const closedUrgent = await createTicket({ requesterId: u.requesterId, status: "CLOSED", itPriority: "URGENT" });
    const lowActive = await createTicket({ requesterId: u.requesterId, status: "OPEN", itPriority: "LOW" });

    const res = await dash(staff);
    const rows = res.body.attention as Array<{ id: number; status: string; itPriority: string; requesterSignalledResolved: boolean; updatedAt: string; href: string }>;
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(ACTIVE_STATUSES as readonly string[]).toContain(r.status);
      expect(r.itPriority === "URGENT" || r.itPriority === "HIGH" || r.requesterSignalledResolved).toBe(true);
      expect(r.href).toBe(`/staff/tickets/${r.id}`);
    }
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(closedUrgent.id);
    expect(ids).not.toContain(lowActive.id);
    const rank = (p: string) => PRIORITIES.indexOf(p);
    for (let i = 1; i < rows.length; i++) expect(rank(rows[i - 1].itPriority)).toBeGreaterThanOrEqual(rank(rows[i].itPriority));
  });

  it("DASH-10b: recently updated lists the 5 newest Tickets by updatedAt", async () => {
    const touched = await createTicket({ requesterId: u.requesterId, status: "OPEN" });
    const res = await dash(staff);
    expect(res.body.recentlyUpdated).toHaveLength(5);
    const stamps = res.body.recentlyUpdated.map((t: { updatedAt: string }) => new Date(t.updatedAt).getTime());
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
    expect(res.body.recentlyUpdated.map((t: { id: number }) => t.id)).toContain(touched.id);
  });

  it("DASH-11: the ACTIVE status filter and followUp validation", async () => {
    await createTicket({ requesterId: u.requesterId, status: "CLOSED" });
    const list = await staff.get("/api/staff/tickets?status=ACTIVE&pageSize=50");
    expect(list.status).toBe(200);
    for (const t of list.body.data) expect(ACTIVE_STATUSES as readonly string[]).toContain(t.status);
    expect((await staff.get("/api/staff/tickets?status=Bogus")).status).toBe(400);
    const bad = await staff.get("/api/staff/tickets?followUp=maybe");
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toContain("followUp");
    const mine = await requester.get("/api/tickets?status=ACTIVE&limit=50");
    expect(mine.status).toBe(200);
    for (const t of mine.body.tickets) expect(["New", "Open", "In Progress", "In_Progress", "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]).toContain(t.status);
  });

  it("DASH-12: Requesters get 403, anonymous callers get 401 (AC-23, AC-31)", async () => {
    expect((await dash(requester)).status).toBe(403);
    expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
  });

  it("PERF-01b: responds in under 500 ms (median of 5 calls) on the seeded database (AC-32)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      // Time only the dashboard request itself, not the retry waits of withFreshAdmin.
      let ms = 0;
      const { res } = await withFreshAdmin(async (a) => {
        const t0 = performance.now();
        const r = await dash(a);
        ms = performance.now() - t0;
        return r;
      });
      times.push(ms);
      expect(res.status).toBe(200);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(500);
  });
});
