import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { Role, TicketStatus } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { ensureRegressionRequester, ensureRegressionOtherRequester, ensureRegressionStaff, ensureRegressionAdmin } from "./testAuth.js";

// Shared fixtures for the Lab 4 API tests. Dedicated accounts (mustChangePassword
// already false) so the suites never depend on, or disturb, the real seed data.

export const SECOND_STAFF_EMAIL = "regression-suite-staff-b@toktick.internal";
export const SECOND_STAFF_PASSWORD = "RegressionTestB345";
export const INACTIVE_STAFF_EMAIL = "regression-suite-inactive-staff@toktick.internal";

export async function ensureSecondStaff() {
  return getPrisma().user.upsert({
    where: { email: SECOND_STAFF_EMAIL },
    update: { isActive: true, mustChangePassword: false, role: Role.IT_STAFF, passwordHash: hashPassword(SECOND_STAFF_PASSWORD) },
    create: {
      name: "Regression Suite Staff B",
      email: SECOND_STAFF_EMAIL,
      department: "IT",
      role: Role.IT_STAFF,
      passwordHash: hashPassword(SECOND_STAFF_PASSWORD),
      mustChangePassword: false,
      isActive: true,
    },
  });
}

export async function ensureInactiveStaff() {
  return getPrisma().user.upsert({
    where: { email: INACTIVE_STAFF_EMAIL },
    update: { isActive: false, role: Role.IT_STAFF },
    create: {
      name: "Regression Suite Inactive Staff",
      email: INACTIVE_STAFF_EMAIL,
      department: "IT",
      role: Role.IT_STAFF,
      passwordHash: hashPassword("RegressionTestInactive1"),
      mustChangePassword: false,
      isActive: false,
    },
  });
}

export async function loginAsSecondStaff(): Promise<SuperTestAgent> {
  await ensureSecondStaff();
  const { app } = await import("../../src/app.js");
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email: SECOND_STAFF_EMAIL, password: SECOND_STAFF_PASSWORD });
  if (res.status !== 200) throw new Error(`Second staff login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export interface Lab4Users {
  requesterId: number;
  otherRequesterId: number;
  staffAId: number;
  staffBId: number;
  adminId: number;
  inactiveStaffId: number;
}

export async function ensureLab4Users(): Promise<Lab4Users> {
  const [requester, other, staffA, staffB, admin, inactive] = await Promise.all([
    ensureRegressionRequester(),
    ensureRegressionOtherRequester(),
    ensureRegressionStaff(),
    ensureSecondStaff(),
    getPrisma().user.findUnique({ where: { email: "regression-suite-admin@toktick.internal" } }).then((a) => a ?? ensureRegressionAdmin()),
    ensureInactiveStaff(),
  ]);
  return {
    requesterId: requester.id,
    otherRequesterId: other.id,
    staffAId: staffA.id,
    staffBId: staffB.id,
    adminId: admin.id,
    inactiveStaffId: inactive.id,
  };
}

let counter = 0;

/** Creates a Ticket directly in the database in the given state. */
export async function createTicket(opts: {
  requesterId: number;
  status?: TicketStatus;
  ownerId?: number | null;
  createdAt?: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  itPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requesterResolvedAt?: Date | null;
}) {
  const prisma = getPrisma();
  const category = await prisma.category.findFirstOrThrow();
  counter += 1;
  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-L4-${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase(),
      summary: "Lab 4 API test fixture",
      description: "Created by a Lab 4 API test.",
      requestedPriority: "MEDIUM",
      status: opts.status ?? TicketStatus.OPEN,
      categoryId: category.id,
      requesterId: opts.requesterId,
      ownerId: opts.ownerId ?? null,
      createdAt: opts.createdAt,
      resolvedAt: opts.resolvedAt ?? null,
      closedAt: opts.closedAt ?? null,
      itPriority: opts.itPriority ?? "MEDIUM",
      requesterResolvedAt: opts.requesterResolvedAt ?? null,
    },
  });
}

/** Inserts an Action Taken straight into the database (bypassing the API). */
export async function createAction(opts: {
  ticketId: number;
  userId: number;
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  actionAt?: Date;
  assigneeId?: number;
  description?: string;
}) {
  const status = opts.status ?? "PLANNED";
  return getPrisma().actionTaken.create({
    data: {
      ticketId: opts.ticketId,
      actionAt: opts.actionAt ?? new Date(),
      description: opts.description ?? "Fixture action",
      status,
      result: status === "COMPLETED" ? "Fixture result" : null,
      completedAt: status === "COMPLETED" ? new Date() : null,
      createdById: opts.userId,
      assigneeId: opts.assigneeId ?? opts.userId,
    },
  });
}

export function validActionBody(overrides: Record<string, unknown> = {}) {
  return { description: "Replaced the faulty network cable.", ...overrides };
}
