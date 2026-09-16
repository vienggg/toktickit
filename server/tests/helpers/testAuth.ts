import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { Role } from "@prisma/client";

// Shared test-fixture accounts for the Lab 1/2 regression suites, which
// need a real, logged-in, mustChangePassword=false Requester to exercise
// the now-session-scoped Ticket/Attachment routes (I-4). Kept separate
// from the real seed data in prisma/seed.ts so re-running tests never
// depends on, or perturbs, that data's mustChangePassword/password state.
export const REGRESSION_REQUESTER_EMAIL = "regression-suite-requester@toktick.internal";
export const REGRESSION_REQUESTER_PASSWORD = "RegressionTest123";

export async function ensureRegressionRequester() {
  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { email: REGRESSION_REQUESTER_EMAIL },
    update: { isActive: true, mustChangePassword: false, passwordHash: hashPassword(REGRESSION_REQUESTER_PASSWORD) },
    create: {
      name: "Regression Suite Requester",
      email: REGRESSION_REQUESTER_EMAIL,
      department: "QA",
      role: Role.REQUESTER,
      passwordHash: hashPassword(REGRESSION_REQUESTER_PASSWORD),
      mustChangePassword: false,
      isActive: true,
    },
  });
  return user;
}

/** Returns a supertest agent already logged in as the regression requester. */
export async function loginAsRegressionRequester() {
  await ensureRegressionRequester();
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({
    email: REGRESSION_REQUESTER_EMAIL,
    password: REGRESSION_REQUESTER_PASSWORD,
  });
  if (res.status !== 200) {
    throw new Error(`Failed to log in as regression requester: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

// A second, entirely separate fixture account for "some other Requester"
// scenarios (cross-requester 404 masking tests). Fixed in review: an
// earlier version of this had those tests pick a random real seeded
// REQUESTER and temporarily flip its mustChangePassword flag, which could
// race with another test file doing the same thing to the same account
// (e.g. Jennifer Anderson) under Vitest's default cross-file parallelism —
// one test's mid-request restore could flip the flag while another test's
// request was in flight, producing an intermittent 403 instead of the
// asserted 404. A dedicated fixture with mustChangePassword already false
// removes the shared mutable state entirely, not just the race window.
export const REGRESSION_OTHER_REQUESTER_EMAIL = "regression-suite-other-requester@toktick.internal";
export const REGRESSION_OTHER_REQUESTER_PASSWORD = "RegressionTest456";

export async function ensureRegressionOtherRequester() {
  const prisma = getPrisma();
  return prisma.user.upsert({
    where: { email: REGRESSION_OTHER_REQUESTER_EMAIL },
    update: { isActive: true, mustChangePassword: false, passwordHash: hashPassword(REGRESSION_OTHER_REQUESTER_PASSWORD) },
    create: {
      name: "Regression Suite Other Requester",
      email: REGRESSION_OTHER_REQUESTER_EMAIL,
      department: "QA",
      role: Role.REQUESTER,
      passwordHash: hashPassword(REGRESSION_OTHER_REQUESTER_PASSWORD),
      mustChangePassword: false,
      isActive: true,
    },
  });
}

/** Returns a supertest agent already logged in as the "someone else" fixture requester. */
export async function loginAsRegressionOtherRequester() {
  await ensureRegressionOtherRequester();
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({
    email: REGRESSION_OTHER_REQUESTER_EMAIL,
    password: REGRESSION_OTHER_REQUESTER_PASSWORD,
  });
  if (res.status !== 200) {
    throw new Error(`Failed to log in as regression other requester: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
