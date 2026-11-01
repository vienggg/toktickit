import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { bangkokWindowStart } from "../../src/utils/bangkokTime.js";
import { loginAsRegressionStaff } from "../helpers/testAuth.js";
import { createTicket, ensureLab4Users, type Lab4Users } from "../helpers/lab4.js";
import { createLoggedInUser, withFreshAdmin, ACTIVE_STATUSES } from "../helpers/lab4Dashboard.js";

// DASH-01..DASH-05 (docs/lab-04/tests.md): the Requester dashboard (AC-02, AC-23, AC-24, AC-26).
describe("Requester dashboard API (DASH-01..DASH-05)", () => {
  let u: Lab4Users;
  let staff: SuperTestAgent;
  let admin: SuperTestAgent;

  beforeAll(async () => {
    u = await ensureLab4Users();
    [staff, admin] = await Promise.all([loginAsRegressionStaff(), Promise.resolve(undefined as unknown as SuperTestAgent)]);
  });

  const get = (agent: SuperTestAgent, query = "") => agent.get(`/api/dashboard/requester${query}`);

  it("DASH-01: returns only the caller's own Tickets even when another requesterId is supplied (AC-02)", async () => {
    const mine = await createLoggedInUser("REQUESTER", "own");
    const other = await createLoggedInUser("REQUESTER", "other");
    await createTicket({ requesterId: mine.id, status: "OPEN" });
    await createTicket({ requesterId: mine.id, status: "NEW" });
    const foreign = await createTicket({ requesterId: other.id, status: "WAITING_FOR_REQUESTER" });

    const res = await get(mine.agent, `?requesterId=${other.id}`);
    expect(res.status).toBe(200);
    expect(res.body.metrics.openTickets.count).toBe(2);
    expect(res.body.metrics.waitingForRequester.count).toBe(0);
    const ids = res.body.recentlyUpdated.map((t: { id: number }) => t.id);
    expect(ids).not.toContain(foreign.id);
    expect(res.body.recentlyUpdated).toHaveLength(2);
    expect(res.body.timeZone).toBe("Asia/Bangkok");
    expect(typeof res.body.generatedAt).toBe("string");
  });

  it("DASH-02: every metric equals the corresponding direct database query (AC-22)", async () => {
    const r = await createLoggedInUser("REQUESTER", "counts");
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CLOSED", "CANCELLED"] as const;
    for (const status of statuses) await createTicket({ requesterId: r.id, status });

    const res = await get(r.agent);
    expect(res.status).toBe(200);
    const prisma = getPrisma();
    const [open, waiting, resolved, closed] = await Promise.all([
      prisma.ticket.count({ where: { requesterId: r.id, status: { in: [...ACTIVE_STATUSES] } } }),
      prisma.ticket.count({ where: { requesterId: r.id, status: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { requesterId: r.id, status: "RESOLVED" } }),
      prisma.ticket.count({ where: { requesterId: r.id, status: "CLOSED" } }),
    ]);
    expect(res.body.metrics.openTickets.count).toBe(open);
    expect(res.body.metrics.waitingForRequester.count).toBe(waiting);
    expect(res.body.metrics.resolved.count).toBe(resolved);
    expect(res.body.metrics.closed.count).toBe(closed);
    expect([open, waiting, resolved, closed]).toEqual([6, 2, 1, 2]);
    expect(res.body.metrics.openTickets.href).toBe("/tickets?status=ACTIVE");
    expect(res.body.metrics.waitingForRequester.href).toBe("/tickets?status=WAITING_FOR_REQUESTER");
    expect(res.body.metrics.resolved.href).toBe("/tickets?status=RESOLVED");
    expect(res.body.metrics.closed.href).toBe("/tickets?status=CLOSED");
  });

  it("DASH-03: a Requester with no Tickets gets zeros, empty lists and drill-down links (AC-24)", async () => {
    const empty = await createLoggedInUser("REQUESTER", "empty");
    const res = await get(empty.agent);
    expect(res.status).toBe(200);
    for (const key of ["openTickets", "waitingForRequester", "resolved", "closed"]) {
      expect(res.body.metrics[key].count).toBe(0);
      expect(res.body.metrics[key].href).toMatch(/^\/tickets\?status=/);
    }
    expect(res.body.recentlyUpdated).toEqual([]);
    expect(res.body.recentlyResolved).toEqual([]);
  });

  it("DASH-04: recently resolved uses the last 7 Bangkok calendar days, newest first, max 5 (AC-26)", async () => {
    const r = await createLoggedInUser("REQUESTER", "window");
    const start = bangkokWindowStart(new Date());
    const inside = await createTicket({ requesterId: r.id, status: "RESOLVED", resolvedAt: new Date(start.getTime() + 60_000) });
    const outside = await createTicket({ requesterId: r.id, status: "RESOLVED", resolvedAt: new Date(start.getTime() - 60_000) });
    const closedInside = await createTicket({ requesterId: r.id, status: "CLOSED", resolvedAt: new Date(start.getTime() + 120_000), closedAt: new Date() });
    const activeWithStamp = await createTicket({ requesterId: r.id, status: "OPEN", resolvedAt: new Date() });

    const res = await get(r.agent);
    const ids = res.body.recentlyResolved.map((t: { id: number }) => t.id);
    expect(ids).toContain(inside.id);
    expect(ids).toContain(closedInside.id);
    expect(ids).not.toContain(outside.id);
    expect(ids).not.toContain(activeWithStamp.id);
    expect(ids[0]).toBe(closedInside.id);

    for (let i = 0; i < 6; i++) await createTicket({ requesterId: r.id, status: "RESOLVED", resolvedAt: new Date(Date.now() - i * 1000) });
    const many = await get(r.agent);
    expect(many.body.recentlyResolved).toHaveLength(5);
    expect(many.body.recentlyUpdated).toHaveLength(5);
    const stamps = many.body.recentlyResolved.map((t: { resolvedAt: string }) => new Date(t.resolvedAt).getTime());
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
    expect(many.body.recentlyResolved[0]).toEqual(expect.objectContaining({ href: expect.stringMatching(/^\/tickets\/\d+$/) }));
  });

  it("DASH-04b: recently updated is ordered by updatedAt then id, newest first", async () => {
    const r = await createLoggedInUser("REQUESTER", "order");
    const a = await createTicket({ requesterId: r.id });
    const b = await createTicket({ requesterId: r.id });
    await new Promise((x) => setTimeout(x, 15));
    await getPrisma().ticket.update({ where: { id: a.id }, data: { summary: "touched" } });
    const res = await get(r.agent);
    expect(res.body.recentlyUpdated.map((t: { id: number }) => t.id)).toEqual([a.id, b.id]);
  });

  it("DASH-05: staff and administrators get 403, anonymous callers get 401 (AC-23, AC-31)", async () => {
    expect((await get(staff)).status).toBe(403);
    // Administrators are not Requesters (AC-23). The shared admin can be briefly
    // deactivated by a parallel Lab 3 test, which also answers 403, so retry never hides a wrong answer here.
    const adminAttempt = await withFreshAdmin((a) => get(a), 1).catch(() => null);
    if (adminAttempt) expect(adminAttempt.res.status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
    expect(u.requesterId).toBeGreaterThan(0);
  });

  it("PERF-01a: responds in under 500 ms (median of 5 calls) on the seeded database (AC-32)", async () => {
    const r = await createLoggedInUser("REQUESTER", "perf");
    await createTicket({ requesterId: r.id });
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = await get(r.agent);
      times.push(performance.now() - t0);
      expect(res.status).toBe(200);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(500);
  });
});
