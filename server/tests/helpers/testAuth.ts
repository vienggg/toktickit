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
