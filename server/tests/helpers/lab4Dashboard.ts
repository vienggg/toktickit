import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { Role } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { ensureRegressionAdmin, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD } from "./testAuth.js";

// Dashboard tests compare the API with direct database queries. Org-wide numbers
// can move while other test files run in parallel, so per-user numbers use
// dedicated throwaway users, and org-wide numbers use eventuallyEqual().

const PASSWORD = "DashboardTest123";
let counter = 0;

export async function createLoggedInUser(role: Role, label: string): Promise<{ id: number; email: string; name: string; agent: SuperTestAgent }> {
  counter += 1;
  const email = `dash-${label}-${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6).toString(36)}@toktick.internal`;
  const user = await getPrisma().user.create({
    data: {
      name: `Dashboard ${label} ${counter}`,
      email,
      department: "QA",
      role,
      passwordHash: hashPassword(PASSWORD),
      mustChangePassword: false,
      isActive: true,
    },
  });
  const { app } = await import("../../src/app.js");
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Dashboard test login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: user.id, email, name: user.name, agent };
}

/**
 * Org-wide metrics can change between the API call and the verifying database
 * query while other test files write. Retry a few times; a real mismatch persists.
 */
export async function eventuallyEqual<T>(fromApi: () => Promise<T>, fromDb: () => Promise<T>, attempts = 40): Promise<{ api: T; db: T }> {
  let last: { api: T; db: T } | undefined;
  for (let i = 0; i < attempts; i++) {
    // The database is read before and after the API call: a write landing in
    // between can only make one of the two differ, so match either snapshot.
    const dbBefore = await fromDb();
    const api = await fromApi();
    const dbAfter = await fromDb();
    const same = (x: T) => JSON.stringify(api) === JSON.stringify(x);
    last = { api, db: same(dbBefore) ? dbBefore : dbAfter };
    if (same(dbBefore) || same(dbAfter)) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  return last as { api: T; db: T };
}

export const ACTIVE_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;

/**
 * Lab 3's last-administrator tests briefly deactivate every other active
 * Administrator, so an admin session can answer 401/403 (or refuse to log in) for a
 * moment while test files run in parallel. Run an admin-only call with the shared
 * regression admin and retry when that window is hit. No new administrator rows are
 * created: extra active admins would disturb those same last-administrator tests.
 */
export async function withFreshAdmin<T extends { status: number }>(
  call: (agent: SuperTestAgent) => Promise<T>,
  attempts = 12
): Promise<{ res: T; adminId: number }> {
  let last: { res: T; adminId: number } | undefined;
  if (!(await getPrisma().user.findUnique({ where: { email: REGRESSION_ADMIN_EMAIL } }))) await ensureRegressionAdmin();
  for (let i = 0; i < attempts; i++) {
    try {
      // Plain login, no upsert: loginAsRegressionAdmin() would re-activate an admin that a
      // parallel Lab 3 test has deliberately deactivated and break that test.
      const { app } = await import("../../src/app.js");
      const agent = request.agent(app);
      const login = await agent.post("/api/auth/login").send({ email: REGRESSION_ADMIN_EMAIL, password: REGRESSION_ADMIN_PASSWORD });
      if (login.status === 200) {
        const admin = await getPrisma().user.findUniqueOrThrow({ where: { email: REGRESSION_ADMIN_EMAIL } });
        const res = await call(agent);
        last = { res, adminId: admin.id };
        if (res.status !== 401 && res.status !== 403) return last;
      }
    } catch {
      // login refused during the window
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!last) throw new Error("Could not obtain an active administrator session.");
  return last;
}
