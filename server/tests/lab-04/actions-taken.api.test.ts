import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRegressionStaff, loginAsRegressionAdmin, loginAsRegressionRequester, loginAsRegressionOtherRequester } from "../helpers/testAuth.js";
import { ensureLab4Users, loginAsSecondStaff, createTicket, createAction, validActionBody, type Lab4Users } from "../helpers/lab4.js";

// API-01..API-17 (docs/lab-04/tests.md). API-18 (database constraints) lives in
// actions-taken-constraints.api.test.ts.
describe("Actions Taken API (API-01..API-17)", () => {
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

  const post = (agent: SuperTestAgent, ticketId: number, body: object) => agent.post(`/api/staff/tickets/${ticketId}/actions`).send(body);
  const patch = (agent: SuperTestAgent, ticketId: number, actionId: number, body: object) =>
    agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`).send(body);
  const countActions = (ticketId: number) => getPrisma().actionTaken.count({ where: { ticketId } });

  it("API-01: creates a valid action under the correct Ticket with the authenticated creator and default assignee", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const res = await post(staffA, ticket.id, validActionBody({ result: "Link restored", attachmentNotes: "Photo is in the IT folder" }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      status: "PLANNED",
      followUpRequired: false,
      followUpNote: null,
      version: 1,
      createdBy: { id: u.staffAId },
      assignee: { id: u.staffAId },
      attachmentNotes: "Photo is in the IT folder",
    });
    const row = await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.ticketId).toBe(ticket.id);
    expect(row.createdById).toBe(u.staffAId);
  });

  it("API-01b: an Administrator can create actions too, and the Ticket's updatedAt is touched", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const before = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;
    await new Promise((r) => setTimeout(r, 15));
    const res = await post(admin, ticket.id, validActionBody());
    expect(res.status).toBe(201);
    expect(res.body.createdBy.id).toBe(u.adminId);
    const after = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("API-02: honours an explicit active assignee and ignores client-supplied creator, ticket and version fields", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const other = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const res = await post(staffA, ticket.id, validActionBody({ assigneeId: u.staffBId, createdById: u.adminId, ticketId: other.id, version: 99 }));
    expect(res.status).toBe(201);
    expect(res.body.assignee.id).toBe(u.staffBId);
    expect(res.body.createdBy.id).toBe(u.staffAId);
    expect(res.body.ticketId).toBe(ticket.id);
    expect(res.body.version).toBe(1);
    expect(await countActions(other.id)).toBe(0);
  });

  it("API-03: another staff member can record an action without changing the Ticket Owner (BR-02)", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const res = await post(staffB, ticket.id, validActionBody());
    expect(res.status).toBe(201);
    expect(res.body.createdBy.id).toBe(u.staffBId);
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.ownerId).toBe(u.staffAId);
  });

  it("API-04: rejects inactive, non-staff and unknown assignees with 422 and writes nothing", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    for (const assigneeId of [u.inactiveStaffId, u.requesterId, 2_000_000_000]) {
      const res = await post(staffA, ticket.id, validActionBody({ assigneeId }));
      expect(res.status, `assignee ${assigneeId}`).toBe(422);
      expect(res.body.error.code).toBe("INVALID_ASSIGNEE");
    }
    expect(await countActions(ticket.id)).toBe(0);
    const bad = await post(staffA, ticket.id, validActionBody({ assigneeId: "abc" }));
    expect(bad.status).toBe(400);
  });

  it("API-04b: reassigning to an inactive user on PATCH is rejected with 422", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const created = await post(staffA, ticket.id, validActionBody());
    const res = await patch(staffA, ticket.id, created.body.id, { expectedVersion: 1, assigneeId: u.inactiveStaffId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_ASSIGNEE");
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: created.body.id } })).assigneeId).toBe(u.staffAId);
  });

  it("API-05: follow-up required needs a non-blank note; a note is dropped when follow-up is false", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    for (const followUpNote of [undefined, "", "   "]) {
      const res = await post(staffA, ticket.id, validActionBody({ followUpRequired: true, followUpNote }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toContain("followUpNote");
    }
    const ok = await post(staffA, ticket.id, validActionBody({ followUpRequired: true, followUpNote: "Check again on Friday" }));
    expect(ok.status).toBe(201);
    expect(ok.body.followUpNote).toBe("Check again on Friday");
    const dropped = await post(staffA, ticket.id, validActionBody({ followUpRequired: false, followUpNote: "ignored" }));
    expect(dropped.status).toBe(201);
    expect(dropped.body.followUpNote).toBeNull();
  });

  it("API-06: a COMPLETED action requires a result on create and on PATCH", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const missing = await post(staffA, ticket.id, validActionBody({ status: "COMPLETED" }));
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toContain("result");

    const planned = await post(staffA, ticket.id, validActionBody());
    const noResult = await patch(staffA, ticket.id, planned.body.id, { expectedVersion: 1, status: "COMPLETED" });
    expect(noResult.status).toBe(400);
    expect(noResult.body.error.message).toContain("result");
    const done = await patch(staffA, ticket.id, planned.body.id, { expectedVersion: 1, status: "COMPLETED", result: "Fixed" });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).not.toBeNull();
  });

  it("API-07: validates description, attachment notes, action time and the initial status", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const cases: Array<[string, object]> = [
      ["description", validActionBody({ description: "   " })],
      ["description", validActionBody({ description: "x".repeat(2001) })],
      ["attachmentNotes", validActionBody({ attachmentNotes: "x".repeat(1001) })],
      ["status", validActionBody({ status: "CANCELLED" })],
      ["status", validActionBody({ status: "DONE" })],
      ["actionAt", validActionBody({ actionAt: new Date(Date.now() + 10 * 60_000).toISOString() })],
      ["actionAt", validActionBody({ actionAt: new Date(ticket.createdAt.getTime() - 60_000).toISOString() })],
      ["actionAt", validActionBody({ actionAt: "not-a-date" })],
      ["followUpRequired", validActionBody({ followUpRequired: "yes" })],
    ];
    for (const [field, body] of cases) {
      const res = await post(staffA, ticket.id, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toContain(field);
    }
    expect(await countActions(ticket.id)).toBe(0);
  });

  it("API-07b: unknown Ticket returns 404 and an invalid id returns 400", async () => {
    expect((await post(staffA, 2_000_000_000, validActionBody())).status).toBe(404);
    expect((await staffA.post("/api/staff/tickets/abc/actions").send(validActionBody())).status).toBe(400);
  });

  it("API-08: a Requester cannot create or update actions (403) and nothing is written", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const existing = await createAction({ ticketId: ticket.id, userId: u.staffAId });
    const created = await post(requester, ticket.id, validActionBody());
    expect(created.status).toBe(403);
    const updated = await patch(requester, ticket.id, existing.id, { expectedVersion: 1, description: "hacked" });
    expect(updated.status).toBe(403);
    expect(await countActions(ticket.id)).toBe(1);
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: existing.id } })).description).toBe("Fixture action");
  });

  it("API-09: a Requester sees every field of their own Ticket's actions (no version) and a 404 for another's", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    await post(staffA, ticket.id, validActionBody({ result: "r", followUpRequired: true, followUpNote: "n", attachmentNotes: "a", clientRequestId: "req-view-0001" }));
    const own = await requester.get(`/api/tickets/${ticket.id}/actions`);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(1);
    const item = own.body.items[0];
    expect(item).toMatchObject({ description: "Replaced the faulty network cable.", result: "r", followUpRequired: true, followUpNote: "n", attachmentNotes: "a" });
    expect(item.createdBy.name).toBeTruthy();
    expect(item).not.toHaveProperty("version");
    expect(item).not.toHaveProperty("clientRequestId");
    expect(item).not.toHaveProperty("updatedBy");

    const masked = await otherRequester.get(`/api/tickets/${ticket.id}/actions`);
    expect(masked.status).toBe(404);
    expect(masked.body.items).toBeUndefined();

    const staffView = await staffA.get(`/api/tickets/${ticket.id}/actions`);
    expect(staffView.status).toBe(200);
    expect(staffView.body.items[0].version).toBe(1);
  });

  it("API-10: unauthenticated access to every new actions endpoint returns 401", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const action = await createAction({ ticketId: ticket.id, userId: u.staffAId });
    expect((await request(app).get(`/api/tickets/${ticket.id}/actions`)).status).toBe(401);
    expect((await request(app).post(`/api/staff/tickets/${ticket.id}/actions`).send(validActionBody())).status).toBe(401);
    expect((await request(app).patch(`/api/staff/tickets/${ticket.id}/actions/${action.id}`).send({ expectedVersion: 1 })).status).toBe(401);
    expect((await request(app).get(`/api/tickets/${ticket.id}/history`)).status).toBe(401);
  });

  it("API-11: legal action status moves succeed, bump the version and record who edited", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const created = await post(staffA, ticket.id, validActionBody());
    const started = await patch(staffB, ticket.id, created.body.id, { expectedVersion: 1, status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ status: "IN_PROGRESS", version: 2, updatedBy: { id: u.staffBId } });
    expect(started.body.completedAt).toBeNull();
    const completed = await patch(staffA, ticket.id, created.body.id, { expectedVersion: 2, status: "COMPLETED", result: "Done" });
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ status: "COMPLETED", version: 3, result: "Done" });
    expect(completed.body.completedAt).not.toBeNull();

    const second = await post(staffA, ticket.id, validActionBody());
    const cancelled = await patch(staffA, ticket.id, second.body.id, { expectedVersion: 1, status: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("API-11b: a PATCH can edit fields without changing the status and requires expectedVersion", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const created = await post(staffA, ticket.id, validActionBody());
    const noVersion = await patch(staffA, ticket.id, created.body.id, { description: "edited" });
    expect(noVersion.status).toBe(400);
    expect(noVersion.body.error.message).toContain("expectedVersion");
    const badVersion = await patch(staffA, ticket.id, created.body.id, { expectedVersion: "x", description: "edited" });
    expect(badVersion.status).toBe(400);
    const edited = await patch(staffA, ticket.id, created.body.id, {
      expectedVersion: 1,
      description: "Edited description",
      followUpRequired: true,
      followUpNote: "Look again next week",
      attachmentNotes: "Screenshot in the shared folder",
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ description: "Edited description", status: "PLANNED", followUpNote: "Look again next week", version: 2 });
  });

  it("API-12: illegal action moves return 409 with the permitted set, and terminal actions are locked", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const inProgress = await post(staffA, ticket.id, validActionBody({ status: "IN_PROGRESS" }));
    const illegal = await patch(staffA, ticket.id, inProgress.body.id, { expectedVersion: 1, status: "PLANNED" });
    expect(illegal.status).toBe(409);
    expect(illegal.body.error.code).toBe("ILLEGAL_ACTION_TRANSITION");
    expect(illegal.body.error.permitted).toEqual(["COMPLETED", "CANCELLED"]);

    const done = await post(staffA, ticket.id, validActionBody({ status: "COMPLETED", result: "ok" }));
    const locked = await patch(staffA, ticket.id, done.body.id, { expectedVersion: 1, description: "change" });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("ACTION_LOCKED");
    const back = await patch(staffA, ticket.id, done.body.id, { expectedVersion: 1, status: "IN_PROGRESS" });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe("ACTION_LOCKED");
  });

  it("API-13: a stale expectedVersion is rejected with the current record and nothing is overwritten", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const created = await post(staffA, ticket.id, validActionBody());
    const first = await patch(staffA, ticket.id, created.body.id, { expectedVersion: 1, description: "Edit by A" });
    expect(first.status).toBe(200);
    const stale = await patch(staffB, ticket.id, created.body.id, { expectedVersion: 1, description: "Edit by B" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
    expect(stale.body.error.current).toMatchObject({ id: created.body.id, description: "Edit by A", version: 2 });
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: created.body.id } })).description).toBe("Edit by A");
  });

  it("API-13b: two simultaneous edits with the same version let exactly one win", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const created = await post(staffA, ticket.id, validActionBody());
    const [a, b] = await Promise.all([
      patch(staffA, ticket.id, created.body.id, { expectedVersion: 1, description: "A wins?" }),
      patch(staffB, ticket.id, created.body.id, { expectedVersion: 1, description: "B wins?" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: created.body.id } })).version).toBe(2);
  });

  it("API-14: repeating a create with the same clientRequestId returns the existing row (201 then 200)", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const body = validActionBody({ clientRequestId: `retry-${ticket.id}-0001` });
    const first = await post(staffA, ticket.id, body);
    const second = await post(staffA, ticket.id, body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await countActions(ticket.id)).toBe(1);
  });

  it("API-14b: concurrent retries with one clientRequestId create exactly one row", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const body = validActionBody({ clientRequestId: `race-${ticket.id}-0001` });
    const results = await Promise.all([post(staffA, ticket.id, body), post(staffA, ticket.id, body), post(staffA, ticket.id, body)]);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await countActions(ticket.id)).toBe(1);
  });

  it("API-15: RESOLVED, CLOSED and CANCELLED Tickets lock their actions; reopening unlocks them", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId, status });
      const action = await createAction({ ticketId: ticket.id, userId: u.staffAId });
      const created = await post(staffA, ticket.id, validActionBody());
      expect(created.status, status).toBe(409);
      expect(created.body.error.code).toBe("TICKET_LOCKED");
      const edited = await patch(staffA, ticket.id, action.id, { expectedVersion: 1, description: "x" });
      expect(edited.status, status).toBe(409);
      expect(edited.body.error.code).toBe("TICKET_LOCKED");
    }
    const resolved = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId, status: "RESOLVED" });
    await getPrisma().ticket.update({ where: { id: resolved.id }, data: { status: "REOPENED" } });
    expect((await post(staffA, resolved.id, validActionBody())).status).toBe(201);
  });

  it("API-16: actions are listed oldest first by actionAt, ties broken by id, stably", async () => {
    const ticket = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId, createdAt: new Date(Date.now() - 3 * 3600_000) });
    const t = (min: number) => new Date(Date.now() - min * 60_000);
    const late = await createAction({ ticketId: ticket.id, userId: u.staffAId, actionAt: t(10), description: "late" });
    const earlyA = await createAction({ ticketId: ticket.id, userId: u.staffAId, actionAt: t(60), description: "early-a" });
    const tie = t(30);
    const tieX = await createAction({ ticketId: ticket.id, userId: u.staffAId, actionAt: tie, description: "tie-x" });
    const tieY = await createAction({ ticketId: ticket.id, userId: u.staffAId, actionAt: tie, description: "tie-y" });
    const expected = [earlyA.id, tieX.id, tieY.id, late.id];
    for (let i = 0; i < 3; i++) {
      const res = await staffA.get(`/api/tickets/${ticket.id}/actions`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((x: { id: number }) => x.id)).toEqual(expected);
    }
    const empty = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    expect((await staffA.get(`/api/tickets/${empty.id}/actions`)).body).toEqual({ items: [], total: 0 });
  });

  it("API-17: an actionId from another Ticket is 404 and there is no DELETE route", async () => {
    const ticketA = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const ticketB = await createTicket({ requesterId: u.requesterId, ownerId: u.staffAId });
    const actionOfB = await createAction({ ticketId: ticketB.id, userId: u.staffAId });
    const wrong = await patch(staffA, ticketA.id, actionOfB.id, { expectedVersion: 1, description: "x" });
    expect(wrong.status).toBe(404);
    const del = await staffA.delete(`/api/staff/tickets/${ticketB.id}/actions/${actionOfB.id}`);
    expect(del.status).toBe(404);
    expect(await countActions(ticketB.id)).toBe(1);
  });
});
