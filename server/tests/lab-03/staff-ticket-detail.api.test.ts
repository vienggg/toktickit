import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  loginAsRegressionRequester,
  loginAsRegressionStaff,
  loginAsRegressionAdmin,
  ensureRegressionStaff,
  ensureRegressionAdmin,
} from "../helpers/testAuth.js";

// I-7 (Issue #56): PATCH /owner, /it-priority, /status, and
// GET /api/staff/tickets/:id. Test IDs API-15, API-16, API-17 per
// docs/lab-03/tests.md.
describe("IT Staff Ticket Detail (API-15, API-16, API-17)", () => {
  let staffAgent: SuperTestAgent;
  let adminAgent: SuperTestAgent;
  let requesterAgent: SuperTestAgent;
  let staffUserId: number;
  let adminUserId: number;
  let inactiveStaffId: number;
  let requesterUserId: number;

  async function createFreshTicket(status: string = "NEW") {
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow();
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-STD${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
        summary: "Staff ticket detail fixture",
        description: "Created for staff-ticket-detail.api.test.ts.",
        requestedPriority: "MEDIUM",
        status: status as never,
        categoryId: category.id,
        requesterId: requesterUserId,
      },
    });
    return ticket;
  }

  beforeAll(async () => {
    const prisma = getPrisma();
    staffAgent = await loginAsRegressionStaff();
    adminAgent = await loginAsRegressionAdmin();
    requesterAgent = await loginAsRegressionRequester();

    const staffUser = await ensureRegressionStaff();
    const adminUser = await ensureRegressionAdmin();
    staffUserId = staffUser.id;
    adminUserId = adminUser.id;

    const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER" } });
    requesterUserId = requester.id;

    const inactiveStaff = await prisma.user.upsert({
      where: { email: "regression-suite-inactive-staff@toktick.internal" },
      update: { isActive: false, role: "IT_STAFF" },
      create: {
        name: "Regression Suite Inactive Staff",
        email: "regression-suite-inactive-staff@toktick.internal",
        department: "IT",
        role: "IT_STAFF",
        passwordHash: staffUser.passwordHash,
        mustChangePassword: false,
        isActive: false,
      },
    });
    inactiveStaffId = inactiveStaff.id;
  });

  describe("GET /api/staff/tickets/:id", () => {
    it("200 with full detail for staff", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.get(`/api/staff/tickets/${ticket.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ticket.id);
      expect(res.body.itPriority).toBeDefined();
      expect(res.body.status).toBe("NEW");
      expect(res.body.permittedStatusTransitions).toEqual(expect.arrayContaining(["OPEN", "IN_PROGRESS", "CANCELLED"]));
      expect(res.body.requester).toBeDefined();
    });

    it("SEC-01: never includes the requester's passwordHash (found while capturing Part 7 curl evidence — `include: { requester: true }` was fetching the full User row, including its hash, into every ticket response)", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.get(`/api/staff/tickets/${ticket.id}`);
      expect(res.status).toBe(200);
      expect(res.body.requester.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it("403 for Requester", async () => {
      const ticket = await createFreshTicket();
      const res = await requesterAgent.get(`/api/staff/tickets/${ticket.id}`);
      expect(res.status).toBe(403);
    });

    it("401 unauthenticated", async () => {
      const ticket = await createFreshTicket();
      const res = await request(app).get(`/api/staff/tickets/${ticket.id}`);
      expect(res.status).toBe(401);
    });

    it("404 for a nonexistent ticket", async () => {
      const res = await staffAgent.get(`/api/staff/tickets/99999999`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/staff/tickets/:id/owner (API-15)", () => {
    it("claim sets the owner to the acting staff user", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: staffUserId });
      expect(res.status).toBe(200);
      expect(res.body.ownerId).toBe(staffUserId);
    });

    it("reassign to another active staff/admin works", async () => {
      const ticket = await createFreshTicket();
      await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: staffUserId });
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: adminUserId });
      expect(res.status).toBe(200);
      expect(res.body.ownerId).toBe(adminUserId);
    });

    it("unassign with ownerId: null works", async () => {
      const ticket = await createFreshTicket();
      await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: staffUserId });
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: null });
      expect(res.status).toBe(200);
      expect(res.body.ownerId).toBeNull();
    });

    it("rejects an inactive staff ownerId with 400", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: inactiveStaffId });
      expect(res.status).toBe(400);
    });

    it("rejects a Requester-role ownerId with 400", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: requesterUserId });
      expect(res.status).toBe(400);
    });

    it("Requester cannot call this route (403)", async () => {
      const ticket = await createFreshTicket();
      const res = await requesterAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: staffUserId });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/staff/tickets/:id/it-priority (API-16)", () => {
    it("updates IT Priority independently of Requested Priority", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "URGENT" });
      expect(res.status).toBe(200);
      expect(res.body.itPriority).toBe("URGENT");
      expect(res.body.requestedPriority).toBe("MEDIUM"); // unchanged
    });

    it("rejects an invalid priority value with 400", async () => {
      const ticket = await createFreshTicket();
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "SUPER_URGENT" });
      expect(res.status).toBe(400);
    });

    it("403 for Requester", async () => {
      const ticket = await createFreshTicket();
      const res = await requesterAgent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "HIGH" });
      expect(res.status).toBe(403);
    });

    it("401 unauthenticated", async () => {
      const ticket = await createFreshTicket();
      const res = await request(app).patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "HIGH" });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/staff/tickets/:id/status (API-17)", () => {
    it("a legal transition succeeds", async () => {
      const ticket = await createFreshTicket("NEW");
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "OPEN" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("OPEN");
    });

    it("an illegal transition returns 409 with the permitted set", async () => {
      const ticket = await createFreshTicket("NEW");
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "CLOSED" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ILLEGAL_TRANSITION");
      expect(res.body.error.permitted).toEqual(expect.arrayContaining(["OPEN", "IN_PROGRESS", "CANCELLED"]));
    });

    it("entering IN_PROGRESS while unassigned is blocked with 409, even though IN_PROGRESS is otherwise legal from NEW", async () => {
      const ticket = await createFreshTicket("NEW");
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "IN_PROGRESS" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ILLEGAL_TRANSITION");
    });

    it("entering IN_PROGRESS succeeds once the ticket has an owner", async () => {
      const ticket = await createFreshTicket("NEW");
      await staffAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: staffUserId });
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "IN_PROGRESS" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("IN_PROGRESS");
    });

    it("CANCELLED is terminal: no outbound transition succeeds", async () => {
      const ticket = await createFreshTicket("CANCELLED");
      const res = await staffAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "OPEN" });
      expect(res.status).toBe(409);
      expect(res.body.error.permitted).toEqual([]);
    });

    it("403 for Requester", async () => {
      const ticket = await createFreshTicket();
      const res = await requesterAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "OPEN" });
      expect(res.status).toBe(403);
    });

    it("401 unauthenticated", async () => {
      const ticket = await createFreshTicket();
      const res = await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "OPEN" });
      expect(res.status).toBe(401);
    });
  });
});
