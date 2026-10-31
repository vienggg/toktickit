import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { STATUS_TRANSITIONS } from "../../src/utils/statusTransitions.js";
import { loginAsRegressionStaff, loginAsRegressionAdmin, loginAsRegressionRequester, loginAsRegressionOtherRequester } from "../helpers/testAuth.js";
import { ensureLab4Users, loginAsSecondStaff, createTicket, createAction, validActionBody, type Lab4Users } from "../helpers/lab4.js";

// WF-01..WF-11 (docs/lab-04/tests.md): resolution gate, cancel/reopen rules,
// append-only history, stale updates and the permitted-transition fields.
describe("Ticket workflow API (WF-01..WF-11)", () => {
  let staffA: SuperTestAgent;
  let staffB: SuperTestAgent;
  let admin: SuperTestAgent;
  let requester: SuperTestAgent;
  let otherRequester: SuperTestAgent;
  let u: Lab4Users;

  beforeAll(async () => {
    u = await ensureLab4Users();
    [staffA, staffB, admin, requester, otherRequester] = await Promise.all([
      loginAsRegressionStaff(),
      loginAsSecondStaff(),
      loginAsRegressionAdmin(),
      loginAsRegressionRequester(),
      loginAsRegressionOtherRequester(),
    ]);
  });

  const setStatus = (agent: SuperTestAgent, id: number, body: object) => agent.patch(`/api/staff/tickets/${id}/status`).send(body);
  const reload = (id: number) => getPrisma().ticket.findUniqueOrThrow({ where: { id } });
  const history = (ticketId: number) => getPrisma().ticketStatusHistory.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

  it("WF-01: Resolve is blocked (409 RESOLUTION_BLOCKED) with every applicable blocker, and the status is unchanged", async () => {
    const noOwner = await createTicket({ requesterId: u.requesterId, status: "OPEN" });
    const a = await setStatus(staffA, noOwner.id, { status: "RESOLVED" });
    expect(a.status).toBe(409);
    expect(a.body.error.code).toBe("RESOLUTION_BLOCKED");
    expect(a.body.error.blockers).toEqual(["NO_OWNER", "NO_COMPLETED_ACTION"]);
    expect((await reload(noOwner.id)).status).toBe("OPEN");

    const open = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
    await createAction({ ticketId: open.id, userId: u.staffAId, status: "PLANNED" });
    const b = await setStatus(staffA, open.id, { status: "RESOLVED" });
    expect(b.status).toBe(409);
    expect(b.body.error.blockers).toEqual(["NO_COMPLETED_ACTION", "OPEN_ACTIONS"]);

    await createAction({ ticketId: open.id, userId: u.staffAId, status: "COMPLETED" });
    const c = await setStatus(staffA, open.id, { status: "RESOLVED" });
    expect(c.status).toBe(409);
    expect(c.body.error.blockers).toEqual(["OPEN_ACTIONS"]);
    expect((await reload(open.id)).status).toBe("IN_PROGRESS");
    expect(await history(open.id)).toHaveLength(0);
  });

  it("WF-02: Resolve succeeds when the gate is satisfied, setting resolvedAt, the version and exactly one history row", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
    await createAction({ ticketId: ticket.id, userId: u.staffBId, status: "COMPLETED" });
    await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "CANCELLED" });
    const res = await setStatus(staffA, ticket.id, { status: "RESOLVED", expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "RESOLVED", version: 2 });
    expect(res.body.resolvedAt).not.toBeNull();
    expect(res.body.closedAt).toBeNull();
    const rows = await history(ticket.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", changedById: u.staffAId });
  });

  it("WF-03: creating an action while the Ticket is being resolved never leaves a RESOLVED Ticket with an open action", async () => {
    for (let i = 0; i < 6; i++) {
      const ticket = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
      await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "COMPLETED" });
      await Promise.all([
        staffB.post(`/api/staff/tickets/${ticket.id}/actions`).send(validActionBody({ status: "PLANNED" })),
        setStatus(staffA, ticket.id, { status: "RESOLVED" }),
      ]);
      const after = await reload(ticket.id);
      const open = await getPrisma().actionTaken.count({ where: { ticketId: ticket.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } });
      expect(after.status === "RESOLVED" && open > 0, `iteration ${i}`).toBe(false);
    }
  });

  it("WF-04: a Requester can never change status; the resolution signal only sets a flag", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
    const denied = await setStatus(requester, ticket.id, { status: "RESOLVED" });
    expect(denied.status).toBe(403);
    const signal = await requester.post(`/api/tickets/${ticket.id}/resolution-signal`).send({});
    expect(signal.status).toBe(200);
    const after = await reload(ticket.id);
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.requesterResolvedAt).not.toBeNull();
    expect(await history(ticket.id)).toHaveLength(0);
    expect((await setStatus(request(app) as unknown as SuperTestAgent, ticket.id, { status: "RESOLVED" })).status).toBe(401);
  });

  it("WF-05: Cancel needs a reason and no open actions; CANCELLED is terminal", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
    const open = await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "IN_PROGRESS" });
    const noReason = await setStatus(staffA, ticket.id, { status: "CANCELLED" });
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.message).toContain("reason");
    const blank = await setStatus(staffA, ticket.id, { status: "CANCELLED", reason: "   " });
    expect(blank.status).toBe(400);
    const tooLong = await setStatus(staffA, ticket.id, { status: "CANCELLED", reason: "x".repeat(501) });
    expect(tooLong.status).toBe(400);

    const blocked = await setStatus(staffA, ticket.id, { status: "CANCELLED", reason: "Duplicate request" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("OPEN_ACTIONS_BLOCK_CANCEL");
    expect(blocked.body.error.blockers).toEqual(["OPEN_ACTIONS"]);

    await getPrisma().actionTaken.update({ where: { id: open.id }, data: { status: "CANCELLED" } });
    const ok = await setStatus(staffA, ticket.id, { status: "CANCELLED", reason: "Duplicate request" });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("CANCELLED");
    expect((await history(ticket.id))[0].reason).toBe("Duplicate request");

    const after = await setStatus(staffA, ticket.id, { status: "OPEN" });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe("ILLEGAL_TRANSITION");
    expect(after.body.error.permitted).toEqual([]);
  });

  it("WF-06: Reopen needs a reason and clears resolvedAt and closedAt", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "IN_PROGRESS", ownerId: u.staffAId });
    await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "COMPLETED" });
    expect((await setStatus(staffA, ticket.id, { status: "RESOLVED" })).status).toBe(200);
    expect((await setStatus(staffA, ticket.id, { status: "CLOSED" })).status).toBe(200);
    const closed = await reload(ticket.id);
    expect(closed.resolvedAt).not.toBeNull();
    expect(closed.closedAt).not.toBeNull();

    const noReason = await setStatus(staffA, ticket.id, { status: "REOPENED" });
    expect(noReason.status).toBe(400);
    const ok = await setStatus(staffA, ticket.id, { status: "REOPENED", reason: "Problem came back" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: "REOPENED", resolvedAt: null, closedAt: null });

    const resolvedOnly = await createTicket({ requesterId: u.requesterId, status: "RESOLVED", ownerId: u.staffAId });
    expect((await setStatus(staffA, resolvedOnly.id, { status: "REOPENED" })).status).toBe(400);
    expect((await setStatus(admin, resolvedOnly.id, { status: "REOPENED", reason: "Not actually fixed" })).status).toBe(200);
  });

  it("WF-07: every cell of the 8x8 transition matrix behaves as documented", async () => {
    const all = Object.values(TicketStatus);
    for (const from of all) {
      for (const to of all) {
        const ticket = await createTicket({ requesterId: u.requesterId, status: from, ownerId: u.staffAId });
        await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "COMPLETED" });
        const res = await setStatus(staffA, ticket.id, { status: to, reason: "Matrix check" });
        const legal = STATUS_TRANSITIONS[from].includes(to);
        expect(res.status, `${from} -> ${to}`).toBe(legal ? 200 : 409);
        if (!legal) expect(res.body.error.code, `${from} -> ${to}`).toBe("ILLEGAL_TRANSITION");
        if (legal) expect(res.body.status).toBe(to);
      }
    }
  }, 120_000);

  it("WF-08: history is ordered and append-only; Requesters never see reasons and cannot write it", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: u.staffAId });
    await setStatus(staffA, ticket.id, { status: "IN_PROGRESS" });
    await setStatus(staffB, ticket.id, { status: "WAITING_FOR_REQUESTER", reason: "Waiting for logs" });
    await setStatus(staffA, ticket.id, { status: "IN_PROGRESS" });

    const staffView = await staffA.get(`/api/tickets/${ticket.id}/history`);
    expect(staffView.status).toBe(200);
    expect(staffView.body.items.map((h: { toStatus: string }) => h.toStatus)).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "IN_PROGRESS"]);
    expect(staffView.body.items[1]).toMatchObject({ fromStatus: "IN_PROGRESS", reason: "Waiting for logs", changedBy: { id: u.staffBId } });

    const own = await requester.get(`/api/tickets/${ticket.id}/history`);
    expect(own.status).toBe(200);
    expect(own.body.items).toHaveLength(3);
    for (const item of own.body.items) expect(item).not.toHaveProperty("reason");
    expect(JSON.stringify(own.body)).not.toContain("Waiting for logs");

    expect((await otherRequester.get(`/api/tickets/${ticket.id}/history`)).status).toBe(404);
    expect((await staffA.post(`/api/tickets/${ticket.id}/history`).send({})).status).toBe(404);
    expect((await staffA.patch(`/api/tickets/${ticket.id}/history/1`).send({})).status).toBe(404);
    expect((await staffA.delete(`/api/tickets/${ticket.id}/history/1`)).status).toBe(404);
    const legacy = await createTicket({ requesterId: u.requesterId, status: "CLOSED" });
    expect((await staffA.get(`/api/tickets/${legacy.id}/history`)).body).toEqual({ items: [] });
  });

  it("WF-09: stale expectedVersion on status, owner and IT priority returns 409 STALE_UPDATE and changes nothing", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: u.staffAId });
    const moved = await setStatus(staffA, ticket.id, { status: "IN_PROGRESS", expectedVersion: 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.version).toBe(2);

    const staleStatus = await setStatus(staffB, ticket.id, { status: "WAITING_FOR_REQUESTER", expectedVersion: 1 });
    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body.error.code).toBe("STALE_UPDATE");
    expect(staleStatus.body.error.current).toMatchObject({ id: ticket.id, status: "IN_PROGRESS", version: 2 });

    const staleOwner = await staffB.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: u.staffBId, expectedVersion: 1 });
    expect(staleOwner.status).toBe(409);
    expect(staleOwner.body.error.code).toBe("STALE_UPDATE");
    const stalePriority = await staffB.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "URGENT", expectedVersion: 1 });
    expect(stalePriority.status).toBe(409);

    const after = await reload(ticket.id);
    expect(after).toMatchObject({ status: "IN_PROGRESS", ownerId: u.staffAId, itPriority: "MEDIUM", version: 2 });

    const owner = await staffB.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: u.staffBId, expectedVersion: 2 });
    expect(owner.status).toBe(200);
    expect(owner.body.version).toBe(3);
    const priority = await staffB.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "HIGH", expectedVersion: 3 });
    expect(priority.status).toBe(200);
    expect(priority.body.version).toBe(4);

    // Lab 3 callers that send no expectedVersion keep working (BR-25) and still bump the version.
    const legacy = await staffB.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "LOW" });
    expect(legacy.status).toBe(200);
    expect(legacy.body.version).toBe(5);
    expect((await setStatus(staffB, ticket.id, { status: "WAITING_FOR_REQUESTER", expectedVersion: "abc" })).status).toBe(400);
  });

  it("WF-10: submitting the same transition twice at once applies it exactly once", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "OPEN", ownerId: u.staffAId });
    const [a, b] = await Promise.all([
      setStatus(staffA, ticket.id, { status: "IN_PROGRESS", expectedVersion: 1 }),
      setStatus(staffA, ticket.id, { status: "IN_PROGRESS", expectedVersion: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await history(ticket.id)).toHaveLength(1);
    expect((await reload(ticket.id)).version).toBe(2);
  });

  it("WF-11: the staff detail exposes version, blockers, action counts and gate-aware permitted transitions", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, status: "OPEN" });
    const first = await staffA.get(`/api/staff/tickets/${ticket.id}`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      version: 1,
      resolvedAt: null,
      closedAt: null,
      resolutionBlockers: ["NO_OWNER", "NO_COMPLETED_ACTION"],
      actionsSummary: { total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0 },
    });
    expect(first.body.permittedStatusTransitions).not.toContain("RESOLVED");
    expect(first.body.permittedStatusTransitions).not.toContain("IN_PROGRESS");

    await staffA.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: u.staffAId });
    await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "COMPLETED" });
    await createAction({ ticketId: ticket.id, userId: u.staffAId, status: "PLANNED" });
    const mid = await staffA.get(`/api/staff/tickets/${ticket.id}`);
    expect(mid.body.resolutionBlockers).toEqual(["OPEN_ACTIONS"]);
    expect(mid.body.actionsSummary).toEqual({ total: 2, planned: 1, inProgress: 0, completed: 1, cancelled: 0 });
    expect(mid.body.permittedStatusTransitions).not.toContain("RESOLVED");

    await getPrisma().actionTaken.updateMany({ where: { ticketId: ticket.id, status: "PLANNED" }, data: { status: "CANCELLED" } });
    const ready = await staffA.get(`/api/staff/tickets/${ticket.id}`);
    expect(ready.body.resolutionBlockers).toEqual([]);
    expect(ready.body.permittedStatusTransitions).toContain("RESOLVED");
    expect((await setStatus(staffA, ticket.id, { status: "RESOLVED", expectedVersion: ready.body.version })).status).toBe(200);
  });
});
