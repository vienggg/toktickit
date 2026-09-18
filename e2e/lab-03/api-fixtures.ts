import { request as pwRequest, type APIRequestContext } from "@playwright/test";

/**
 * API-level fixture setup for Lab 3 E2E specs (I-9, Issue #58).
 *
 * These specs drive the real browser for the actual test flow, but still
 * need a few pieces of one-off setup data (a fresh isolated ticket, a
 * throwaway forced-password-change user) that would be flaky or slow to
 * create by clicking through the UI in every spec. Rather than importing
 * server-side Prisma directly into a Playwright spec (a real ESM/TS
 * resolution risk: the server's own source uses ESM ".js" import specifiers
 * that its own tsx/ts-node runtime rewrites to ".ts", which Playwright's
 * bundler is not guaranteed to also do), this file drives the same real
 * HTTP API the app itself uses, via Playwright's APIRequestContext. That
 * matches how `server/tests/lab-03/*.api.test.ts` already treats the API as
 * the seam for fixture setup — just over HTTP instead of supertest.
 *
 * All requests go through the client dev server's `/api` proxy (see
 * client/vite.config.ts) so a single baseURL (the Playwright config's
 * http://localhost:5173) works for both UI navigation and this fixture
 * setup.
 */

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

export const REGRESSION_REQUESTER_EMAIL = "regression-suite-requester@toktick.internal";
export const REGRESSION_REQUESTER_PASSWORD = "RegressionTest123";

export const REGRESSION_STAFF_EMAIL = "regression-suite-staff@toktick.internal";
export const REGRESSION_STAFF_PASSWORD = "RegressionTest789";

export const REGRESSION_ADMIN_EMAIL = "regression-suite-admin@toktick.internal";
export const REGRESSION_ADMIN_PASSWORD = "RegressionTest012";

/** Logs in as the given credentials via the real API and returns a cookie-carrying context for further fixture calls. */
export async function apiLogin(email: string, password: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  if (!res.ok()) {
    throw new Error(`apiLogin failed for ${email}: ${res.status()} ${await res.text()}`);
  }
  return ctx;
}

export async function firstCategoryId(ctx: APIRequestContext): Promise<number> {
  const res = await ctx.get("/api/categories");
  if (!res.ok()) throw new Error(`GET /api/categories failed: ${res.status()}`);
  const categories: Array<{ id: number; name: string }> = await res.json();
  if (categories.length === 0) throw new Error("No categories seeded — cannot create a fixture ticket.");
  return categories[0].id;
}

/** Creates a fresh, isolated ticket as the regression Requester fixture, so the staff-workflow spec never shares mutable ticket state with any other test. */
export async function createFreshTicketAsRequester(): Promise<{ id: number; ticketNumber: string; status: string }> {
  const ctx = await apiLogin(REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  try {
    const categoryId = await firstCategoryId(ctx);
    const res = await ctx.post("/api/tickets", {
      data: {
        summary: `E2E fixture ticket ${Date.now()}`,
        description: "Created by e2e/lab-03/staff-ticket-flow.spec.ts (I-9) for an isolated staff workflow run.",
        priority: "MEDIUM",
        categoryId: String(categoryId),
      },
    });
    if (res.status() !== 201) {
      throw new Error(`Failed to create fixture ticket: ${res.status()} ${await res.text()}`);
    }
    const ticket = await res.json();
    return { id: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Creates a throwaway Requester user via the real Admin "Create User" API
 * with a timestamped, clearly test-scoped email so repeated runs never
 * collide on BR-26's case-insensitive uniqueness constraint. Every user
 * created this way has mustChangePassword: true (server-enforced, per
 * server/src/app.ts's admin create-user handler), which is exactly the
 * forced-change fixture E2E-02 and E2E-04 need.
 */
export async function createForcedChangeUser(namePrefix = "E2E Fixture User"): Promise<{ email: string; password: string; id: number }> {
  const adminCtx = await apiLogin(REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  try {
    const stamp = Date.now();
    const email = `e2e-fixture-${stamp}@toktick.internal`;
    const password = "InitialPass123";
    const res = await adminCtx.post("/api/admin/users", {
      data: {
        name: `${namePrefix} ${stamp}`,
        email,
        role: "REQUESTER",
        isActive: true,
        initialPassword: password,
      },
    });
    if (res.status() !== 201) {
      throw new Error(`Failed to create forced-change fixture user: ${res.status()} ${await res.text()}`);
    }
    const created = await res.json();
    return { email, password, id: created.id };
  } finally {
    await adminCtx.dispose();
  }
}
