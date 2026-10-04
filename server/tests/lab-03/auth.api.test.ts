import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// A dedicated, disposable test account so this suite never depends on (or
// mutates) the shared seed data's mustChangePassword/password state, which
// other suites and manual testing also rely on.
const TEST_EMAIL = "auth-suite-test-user@toktick.internal";
const TEST_INITIAL_PASSWORD = "TestPass123";
const TEST_INACTIVE_EMAIL = "auth-suite-inactive-user@toktick.internal";

describe("Authentication (AC-01, AC-02, AC-05, AC-06, AC-07)", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    const hash = bcrypt.hashSync(TEST_INITIAL_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: { passwordHash: hash, mustChangePassword: true, isActive: true },
      create: {
        name: "Auth Suite Test User",
        email: TEST_EMAIL,
        department: "QA",
        role: "REQUESTER",
        passwordHash: hash,
        mustChangePassword: true,
        isActive: true,
      },
    });
    await prisma.user.upsert({
      where: { email: TEST_INACTIVE_EMAIL },
      update: { passwordHash: hash, isActive: false },
      create: {
        name: "Auth Suite Inactive User",
        email: TEST_INACTIVE_EMAIL,
        department: "QA",
        role: "REQUESTER",
        passwordHash: hash,
        mustChangePassword: true,
        isActive: false,
      },
    });
  });

  it("API-01: valid credentials log in, set a session cookie, and return safe user data (AC-01)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.role).toBe("REQUESTER");
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("API-02: an unknown email returns the generic invalid-credentials response (BR-06, AC-05)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "does-not-exist@toktick.internal", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("API-03: a wrong password returns the identical generic response as an unknown email (BR-06)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("API-04: email comparison is case-insensitive (BR-01)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL.toUpperCase(), password: TEST_INITIAL_PASSWORD });

    expect(res.status).toBe(200);
  });

  it("API-05: a correct password against an inactive account returns 403, not 401 (BR-07, AC-06)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_INACTIVE_EMAIL, password: TEST_INITIAL_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("API-06: missing email or password returns 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: TEST_EMAIL });
    expect(res.status).toBe(400);
  });

  it("API-07: GET /api/auth/me requires a session (401 without one)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("API-08: GET /api/auth/me returns the authenticated identity when logged in (AC-01)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("API-09: change-password rejects the current password re-typed as the new one (BR-10)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    const res = await agent.post("/api/auth/change-password").send({
      currentPassword: TEST_INITIAL_PASSWORD,
      newPassword: TEST_INITIAL_PASSWORD,
      confirmPassword: TEST_INITIAL_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PASSWORD_UNCHANGED");
  });

  it("API-10: change-password rejects a mismatched confirmation (BR-11)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    const res = await agent.post("/api/auth/change-password").send({
      currentPassword: TEST_INITIAL_PASSWORD,
      newPassword: "NewPass123",
      confirmPassword: "Different123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PASSWORD_MISMATCH");
  });

  it("API-11: change-password rejects a policy-violating password (BR-09)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    const res = await agent.post("/api/auth/change-password").send({
      currentPassword: TEST_INITIAL_PASSWORD,
      newPassword: "short1",
      confirmPassword: "short1",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("WEAK_PASSWORD");
  });

  it("API-12: a successful change clears mustChangePassword and the new password logs in afterward (AC-02, BR-02)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });

    const changeRes = await agent.post("/api/auth/change-password").send({
      currentPassword: TEST_INITIAL_PASSWORD,
      newPassword: "BrandNewPass123",
      confirmPassword: "BrandNewPass123",
    });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.user.mustChangePassword).toBe(false);

    const reloginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "BrandNewPass123" });
    expect(reloginRes.status).toBe(200);
    expect(reloginRes.body.user.mustChangePassword).toBe(false);

    // Restore fixture state for repeatable local test runs.
    await getPrisma().user.update({
      where: { email: TEST_EMAIL },
      data: { passwordHash: bcrypt.hashSync(TEST_INITIAL_PASSWORD, 10), mustChangePassword: true },
    });
  });

  it("API-13: logout clears the session and a subsequent /api/auth/me returns 401 (AC-07, BR-08)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: TEST_EMAIL, password: TEST_INITIAL_PASSWORD });
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(204);

    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("API-14: logout is idempotent — calling it again with no session still succeeds (BR-08)", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
  });
});
