import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requirePasswordChanged, requireRole } from "../../src/auth.js";
import {
  loginAsRegressionRequester,
  loginAsRegressionStaff,
  loginAsRegressionAdmin,
  ensureRegressionStaff,
} from "../helpers/testAuth.js";

// This file covers what I-3 (auth foundation) can test in isolation: the
// middleware functions themselves, and the one real protected route that
// exists at this stage (/api/auth/me). Ownership masking (AC-03, AC-17),
// the Internal Notes rejection (AC-04), and role-gated business routes are
// exercised against real endpoints once those endpoints exist — I-4, I-6,
// and I-7 extend this same file with additional describe blocks rather
// than duplicating it, per docs/lab-03/tests.md.

function mockReqRes(overrides: Partial<Request> = {}) {
  const req = { path: "/api/some-protected-route", ...overrides } as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = vi.fn();
  return { req, res, status, json, next };
}

describe("Authorization — unauthenticated access (FR-07)", () => {
  it("API-15: GET /api/auth/me without a session returns 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("API-16: an invalid/garbage session cookie returns 401, not a server error", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "toktickit_session=not-a-real-jwt");
    expect(res.status).toBe(401);
  });
});

describe("Authorization — requirePasswordChanged middleware (D-12, AC-02)", () => {
  it("API-17: allows the request through when mustChangePassword is false", () => {
    const { req, res, next } = mockReqRes({
      authUser: { id: 1, name: "X", email: "x@x.com", role: "REQUESTER", isActive: true, mustChangePassword: false },
    } as Partial<Request>);
    requirePasswordChanged(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("API-18: blocks a non-allowlisted route with 403 when mustChangePassword is true", () => {
    const { req, res, status, json, next } = mockReqRes({
      path: "/api/tickets",
      authUser: { id: 1, name: "X", email: "x@x.com", role: "REQUESTER", isActive: true, mustChangePassword: true },
    } as Partial<Request>);
    requirePasswordChanged(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "PASSWORD_CHANGE_REQUIRED" }) })
    );
  });

  it.each(["/api/auth/me", "/api/auth/change-password", "/api/auth/logout"])(
    "API-19: allows the allowlisted route %s through even when mustChangePassword is true",
    (path) => {
      const { req, res, next } = mockReqRes({
        path,
        authUser: { id: 1, name: "X", email: "x@x.com", role: "REQUESTER", isActive: true, mustChangePassword: true },
      } as Partial<Request>);
      requirePasswordChanged(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  );

  it("API-20: returns 401 rather than throwing if requireAuth was somehow skipped", () => {
    const { req, res, status, next } = mockReqRes();
    requirePasswordChanged(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});

describe("Authorization — requireRole middleware (FR-07, §6 authorization matrix)", () => {
  it("API-21: allows a permitted role through", () => {
    const { req, res, next } = mockReqRes({
      authUser: { id: 1, name: "X", email: "x@x.com", role: "IT_STAFF", isActive: true, mustChangePassword: false },
    } as Partial<Request>);
    requireRole("IT_STAFF", "ADMINISTRATOR")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("API-22: rejects a role outside the permitted set with 403", () => {
    const { req, res, status, json, next } = mockReqRes({
      authUser: { id: 1, name: "X", email: "x@x.com", role: "REQUESTER", isActive: true, mustChangePassword: false },
    } as Partial<Request>);
    requireRole("IT_STAFF", "ADMINISTRATOR")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "FORBIDDEN" }) }));
  });

  it("API-23: returns 401 if called without an authenticated user", () => {
    const { req, res, status, next } = mockReqRes();
    requireRole("ADMINISTRATOR")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});

describe("Authorization — deactivation takes effect immediately, not at token expiry", () => {
  const email = "authz-suite-deactivation@toktick.internal";

  it("API-24: a valid, unexpired session is rejected with 403 the moment the account is deactivated", async () => {
    const prisma = getPrisma();
    const hash = bcrypt.hashSync("TempPass123", 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, isActive: true },
      create: { name: "Deactivation Test", email, department: "QA", role: "REQUESTER", passwordHash: hash, isActive: true },
    });

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: "TempPass123" });
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    await prisma.user.update({ where: { email }, data: { isActive: false } });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");

    // Restore for repeatable local runs.
    await prisma.user.update({ where: { email }, data: { isActive: true } });
  });
});

// API-12: the full role x endpoint authorization grid from specification.md
// §6, extended incrementally as each Issue's routes land (I-4, I-6, now
// I-7). AC-18/I-8's admin routes are still pending, so this grid is not yet
// "complete" per §6 — only the rows this Issue's routes actually cover.
describe("Authorization — API-12: full role x endpoint grid (I-6/I-7 routes)", () => {
  let requesterAgent: SuperTestAgent;
  let staffAgent: SuperTestAgent;
  let adminAgent: SuperTestAgent;
  let requesterId: number;

  async function createFixtureTicket() {
    const prisma = getPrisma();
    const category = await prisma.category.findFirstOrThrow();
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-AUZ${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
        summary: "Authorization grid fixture",
        description: "Created for authorization.api.test.ts API-12 grid.",
        requestedPriority: "MEDIUM",
        status: "NEW",
        categoryId: category.id,
        requesterId,
      },
    });
    return ticket.id;
  }

  // Every scenario below (Requester / Staff / Admin / unauthenticated) gets
  // its own fresh ticket, rather than sharing one across the four passes —
  // the status/owner PATCH routes mutate ticket state, and a shared ticket
  // would make a later pass's "legal from NEW" transition illegal once an
  // earlier pass had already moved it (e.g. OPEN -> OPEN is not itself a
  // legal §6.5 transition).
  function routesFor(ticketId: number): { method: "get" | "patch" | "post"; path: () => string; body?: Record<string, unknown> }[] {
    return [
      { method: "get", path: () => `/api/staff/tickets/${ticketId}` },
      { method: "patch", path: () => `/api/staff/tickets/${ticketId}/owner`, body: { ownerId: null } },
      { method: "patch", path: () => `/api/staff/tickets/${ticketId}/it-priority`, body: { itPriority: "LOW" } },
      { method: "patch", path: () => `/api/staff/tickets/${ticketId}/status`, body: { status: "OPEN" } },
      { method: "get", path: () => `/api/staff/tickets` },
      { method: "get", path: () => `/api/staff/members` },
      { method: "get", path: () => `/api/tickets/${ticketId}/internal-notes` },
      { method: "post", path: () => `/api/tickets/${ticketId}/internal-notes`, body: { body: "grid check" } },
    ];
  }

  beforeAll(async () => {
    const prisma = getPrisma();
    requesterAgent = await loginAsRegressionRequester();
    staffAgent = await loginAsRegressionStaff();
    adminAgent = await loginAsRegressionAdmin();
    await ensureRegressionStaff();
    const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER" } });
    requesterId = requester.id;
  });

  it("Requester is forbidden (403) from every I-6/I-7 route", async () => {
    const ticketId = await createFixtureTicket();
    for (const { method, path, body } of routesFor(ticketId)) {
      const res = await requesterAgent[method](path()).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path()}`).toBe(403);
    }
  });

  it("IT Staff is permitted on every I-6/I-7 route", async () => {
    const ticketId = await createFixtureTicket();
    for (const { method, path, body } of routesFor(ticketId)) {
      const res = await staffAgent[method](path()).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path()}`).toBeLessThan(400);
    }
  });

  it("Administrator is permitted on every I-6/I-7 route", async () => {
    const ticketId = await createFixtureTicket();
    for (const { method, path, body } of routesFor(ticketId)) {
      const res = await adminAgent[method](path()).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path()}`).toBeLessThan(400);
    }
  });

  it("unauthenticated is rejected (401) on every I-6/I-7 route", async () => {
    const ticketId = await createFixtureTicket();
    for (const { method, path, body } of routesFor(ticketId)) {
      const res = await request(app)[method](path()).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path()}`).toBe(401);
    }
  });
});
