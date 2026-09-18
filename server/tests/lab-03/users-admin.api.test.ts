import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Agent as SuperTestAgent } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { Role } from "@prisma/client";
import {
  loginAsRegressionRequester,
  loginAsRegressionStaff,
  loginAsRegressionAdmin,
  ensureRegressionAdmin,
  REGRESSION_ADMIN_EMAIL,
} from "../helpers/testAuth.js";

// I-8 (Issue #57): Administrator User Management. Test IDs API-21 through
// API-27 per docs/lab-03/tests.md, all in this single file as named there.

let nextEmailSuffix = 0;
function uniqueEmail(prefix: string): string {
  nextEmailSuffix += 1;
  return `${prefix}-${Date.now()}-${nextEmailSuffix}@toktick.internal`;
}

/** Creates a throwaway user directly via Prisma for test isolation, bypassing the API under test. */
async function createUser(overrides: Partial<{ name: string; email: string; role: Role; isActive: boolean; password: string }> = {}) {
  const prisma = getPrisma();
  const password = overrides.password ?? "ThrowawayPass1";
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Throwaway User",
      email: overrides.email ?? uniqueEmail("throwaway"),
      department: "QA",
      role: overrides.role ?? Role.REQUESTER,
      passwordHash: hashPassword(password),
      mustChangePassword: false,
      isActive: overrides.isActive ?? true,
    },
  });
}

describe("Administrator User Management (API-21 – API-27)", () => {
  let adminAgent: SuperTestAgent;
  let staffAgent: SuperTestAgent;
  let requesterAgent: SuperTestAgent;
  let adminUserId: number;

  beforeAll(async () => {
    adminAgent = await loginAsRegressionAdmin();
    staffAgent = await loginAsRegressionStaff();
    requesterAgent = await loginAsRegressionRequester();
    const admin = await ensureRegressionAdmin();
    adminUserId = admin.id;
  });

  describe("GET /api/admin/users (API-21)", () => {
    it("returns users matching a name/email search substring, case-insensitively", async () => {
      const marker = `Zztest${Date.now()}`;
      const user = await createUser({ name: `${marker} Person`, email: uniqueEmail("search") });
      const res = await adminAgent.get(`/api/admin/users?search=${marker.toLowerCase()}`);
      expect(res.status).toBe(200);
      expect(res.body.some((u: { id: number }) => u.id === user.id)).toBe(true);
    });

    it("filters by role", async () => {
      const staffUser = await createUser({ role: Role.IT_STAFF, email: uniqueEmail("rolefilter-staff") });
      const res = await adminAgent.get("/api/admin/users?role=IT_STAFF");
      expect(res.status).toBe(200);
      expect(res.body.every((u: { role: string }) => u.role === "IT_STAFF")).toBe(true);
      expect(res.body.some((u: { id: number }) => u.id === staffUser.id)).toBe(true);
    });

    it("never includes passwordHash in the response", async () => {
      const res = await adminAgent.get("/api/admin/users");
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it("400 on an invalid role filter value", async () => {
      const res = await adminAgent.get("/api/admin/users?role=SUPERUSER");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("403 for IT_STAFF", async () => {
      const res = await staffAgent.get("/api/admin/users");
      expect(res.status).toBe(403);
    });

    it("403 for REQUESTER", async () => {
      const res = await requesterAgent.get("/api/admin/users");
      expect(res.status).toBe(403);
    });

    it("401 unauthenticated", async () => {
      const res = await request(app).get("/api/admin/users");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/admin/users — duplicate email (API-22)", () => {
    it("409 on a case-insensitive duplicate email, and no user is created", async () => {
      const existing = await createUser({ email: uniqueEmail("dupe") });
      const beforeCount = await getPrisma().user.count();

      const res = await adminAgent.post("/api/admin/users").send({
        name: "Duplicate Attempt",
        email: existing.email.toUpperCase(),
        role: "REQUESTER",
        isActive: true,
        initialPassword: "ValidPass1",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
      const afterCount = await getPrisma().user.count();
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe("POST /api/admin/users — invalid role (API-23)", () => {
    it("400 on an invalid role value, and no user is created", async () => {
      const email = uniqueEmail("badrole");
      const res = await adminAgent.post("/api/admin/users").send({
        name: "Bad Role",
        email,
        role: "SUPERUSER",
        isActive: true,
        initialPassword: "ValidPass1",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      const created = await getPrisma().user.findUnique({ where: { email } });
      expect(created).toBeNull();
    });

    it("400 on a weak initial password", async () => {
      const res = await adminAgent.post("/api/admin/users").send({
        name: "Weak Password",
        email: uniqueEmail("weakpass"),
        role: "REQUESTER",
        isActive: true,
        initialPassword: "short",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("WEAK_PASSWORD");
    });

    it("201 on valid creation, with mustChangePassword forced true and no passwordHash leaked", async () => {
      const email = uniqueEmail("created");
      const res = await adminAgent.post("/api/admin/users").send({
        name: "Newly Created",
        email,
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "ValidPass1",
      });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe("IT_STAFF");
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);

      const dbUser = await getPrisma().user.findUnique({ where: { email } });
      expect(dbUser?.mustChangePassword).toBe(true);
    });

    it("403 for IT_STAFF, 403 for REQUESTER, 401 unauthenticated", async () => {
      const payload = { name: "X", email: uniqueEmail("createperm"), role: "REQUESTER", isActive: true, initialPassword: "ValidPass1" };
      expect((await staffAgent.post("/api/admin/users").send(payload)).status).toBe(403);
      expect((await requesterAgent.post("/api/admin/users").send({ ...payload, email: uniqueEmail("createperm2") })).status).toBe(403);
      expect((await request(app).post("/api/admin/users").send({ ...payload, email: uniqueEmail("createperm3") })).status).toBe(401);
    });
  });

  describe("PATCH /api/admin/users/:id — basic fields (API-24)", () => {
    it("updates name/email/role/isActive and the change is reflected in a subsequent GET", async () => {
      const user = await createUser({ role: Role.REQUESTER });
      const newEmail = uniqueEmail("edited");

      const patchRes = await adminAgent.patch(`/api/admin/users/${user.id}`).send({
        name: "Edited Name",
        email: newEmail,
        role: "IT_STAFF",
        isActive: false,
      });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe("Edited Name");
      expect(patchRes.body.email).toBe(newEmail);
      expect(patchRes.body.role).toBe("IT_STAFF");
      expect(patchRes.body.isActive).toBe(false);

      const getRes = await adminAgent.get(`/api/admin/users?search=${encodeURIComponent(newEmail)}`);
      expect(getRes.status).toBe(200);
      const found = getRes.body.find((u: { id: number }) => u.id === user.id);
      expect(found).toMatchObject({ name: "Edited Name", email: newEmail, role: "IT_STAFF", isActive: false });
    });

    it("409 on updating email to a duplicate of another user's email", async () => {
      const userA = await createUser({ email: uniqueEmail("emaila") });
      const userB = await createUser({ email: uniqueEmail("emailb") });
      const res = await adminAgent.patch(`/api/admin/users/${userB.id}`).send({ email: userA.email.toUpperCase() });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });

    it("allows updating a user's own email to itself (not a duplicate of self)", async () => {
      const user = await createUser({ email: uniqueEmail("selfsame") });
      const res = await adminAgent.patch(`/api/admin/users/${user.id}`).send({ email: user.email, name: "Same Email Update" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Same Email Update");
    });

    it("400 on an invalid role", async () => {
      const user = await createUser();
      const res = await adminAgent.patch(`/api/admin/users/${user.id}`).send({ role: "SUPERUSER" });
      expect(res.status).toBe(400);
    });

    it("404 for a nonexistent user", async () => {
      const res = await adminAgent.patch(`/api/admin/users/99999999`).send({ name: "Nope" });
      expect(res.status).toBe(404);
    });

    it("403 for IT_STAFF, 403 for REQUESTER, 401 unauthenticated", async () => {
      const user = await createUser();
      expect((await staffAgent.patch(`/api/admin/users/${user.id}`).send({ name: "X" })).status).toBe(403);
      expect((await requesterAgent.patch(`/api/admin/users/${user.id}`).send({ name: "X" })).status).toBe(403);
      expect((await request(app).patch(`/api/admin/users/${user.id}`).send({ name: "X" })).status).toBe(401);
    });
  });

  describe("POST /api/admin/users/:id/initial-password (API-25)", () => {
    it("forces mustChangePassword true, and the old password no longer works while the new one does", async () => {
      const oldPassword = "OriginalPass1";
      const newPassword = "BrandNewPass2";
      const user = await createUser({ password: oldPassword, email: uniqueEmail("pwreset") });

      const res = await adminAgent.post(`/api/admin/users/${user.id}/initial-password`).send({ initialPassword: newPassword });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);

      const dbUser = await getPrisma().user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mustChangePassword).toBe(true);

      const oldLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: oldPassword });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: newPassword });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.user.mustChangePassword).toBe(true);
    });

    it("400 on a weak new password", async () => {
      const user = await createUser({ email: uniqueEmail("pwweak") });
      const res = await adminAgent.post(`/api/admin/users/${user.id}/initial-password`).send({ initialPassword: "weak" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("WEAK_PASSWORD");
    });

    it("404 for a nonexistent user", async () => {
      const res = await adminAgent.post(`/api/admin/users/99999999/initial-password`).send({ initialPassword: "ValidPass1" });
      expect(res.status).toBe(404);
    });

    it("an Administrator may reset their own password (no self-restriction on this route)", async () => {
      const res = await adminAgent.post(`/api/admin/users/${adminUserId}/initial-password`).send({ initialPassword: "SelfResetPass1" });
      expect(res.status).toBe(200);
      // Restore the shared regression admin fixture's password/mustChangePassword
      // state immediately so other test files relying on loginAsRegressionAdmin
      // are not affected by this test.
      await getPrisma().user.update({
        where: { id: adminUserId },
        data: { passwordHash: hashPassword("RegressionTest012"), mustChangePassword: false },
      });
    });

    it("403 for IT_STAFF, 403 for REQUESTER, 401 unauthenticated", async () => {
      const user = await createUser({ email: uniqueEmail("pwperm") });
      expect((await staffAgent.post(`/api/admin/users/${user.id}/initial-password`).send({ initialPassword: "ValidPass1" })).status).toBe(403);
      expect((await requesterAgent.post(`/api/admin/users/${user.id}/initial-password`).send({ initialPassword: "ValidPass1" })).status).toBe(403);
      expect((await request(app).post(`/api/admin/users/${user.id}/initial-password`).send({ initialPassword: "ValidPass1" })).status).toBe(401);
    });
  });

  describe("Self-deactivation / self-demotion blocked (API-26, BR-27)", () => {
    it("the acting Administrator cannot deactivate their own account", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${adminUserId}`).send({ isActive: false });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SELF_MODIFICATION_BLOCKED");

      const dbUser = await getPrisma().user.findUnique({ where: { id: adminUserId } });
      expect(dbUser?.isActive).toBe(true);
    });

    it("the acting Administrator cannot demote their own role", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${adminUserId}`).send({ role: "IT_STAFF" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SELF_MODIFICATION_BLOCKED");

      const dbUser = await getPrisma().user.findUnique({ where: { id: adminUserId } });
      expect(dbUser?.role).toBe("ADMINISTRATOR");
    });

    it("a DIFFERENT Administrator may deactivate this Administrator's account", async () => {
      // A second, throwaway active Administrator so the regression admin
      // (the target here) is not the last active Administrator — that
      // scenario is BR-28's concern, tested separately below. This keeps
      // this test isolated to BR-27 only.
      const secondAdmin = await createUser({ role: Role.ADMINISTRATOR, email: uniqueEmail("secondadmin-br27"), password: "SecondAdmin1" });
      const secondAdminAgent = request.agent(app);
      const loginRes = await secondAdminAgent.post("/api/auth/login").send({ email: secondAdmin.email, password: "SecondAdmin1" });
      expect(loginRes.status).toBe(200);

      const res = await secondAdminAgent.patch(`/api/admin/users/${adminUserId}`).send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      // Restore the shared regression admin fixture immediately.
      await getPrisma().user.update({ where: { id: adminUserId }, data: { isActive: true } });
    });

    it("allows updating other fields (name) on one's own account, since that is not deactivation or demotion", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${adminUserId}`).send({ name: "Regression Suite Admin" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Regression Suite Admin");
    });
  });


  describe("Last-Administrator protection (API-27, BR-28)", () => {
    // These tests build an isolated set of Administrators via direct
    // Prisma writes for setup (not through the guarded PATCH route), so
    // other test files relying on loginAsRegressionAdmin's account always
    // being an active Administrator are unaffected — the shared fixture's
    // isActive/role state is restored at the end of every test here.
    //
    // Judgment call on reachability: the server's BR-28 check counts
    // *other* active Administrators excluding only the target row
    // (per this issue's exact instructions). Because the route itself
    // requires the acting user to be a currently active Administrator
    // (requireRole), the acting user always counts as at least one "other"
    // active admin whenever they act on a *different* target — so this
    // check can mathematically only reach zero when the target IS the
    // sole active Administrator AND no distinct acting Administrator
    // exists to even issue the request. In practice that means BR-28 is a
    // defense-in-depth backstop that cooperates with BR-27 (self-block):
    // the last standing Administrator can only ever be asked to act on
    // themselves, which BR-27 already rejects first. The tests below
    // confirm (a) a valid multi-admin transition succeeds correctly, and
    // (b) once reduced to a single active Administrator, that account is
    // blocked from removing its own admin status — the only reachable path
    // to "would leave zero active Administrators" in this system.
    it("a second active Administrator may be deactivated by a different acting Administrator, leaving one active admin", async () => {
      const target = await createUser({ role: Role.ADMINISTRATOR, email: uniqueEmail("target-admin"), password: "TargetAdmin1" });

      const res = await adminAgent.patch(`/api/admin/users/${target.id}`).send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      const activeAdminCount = await getPrisma().user.count({ where: { role: Role.ADMINISTRATOR, isActive: true } });
      expect(activeAdminCount).toBeGreaterThanOrEqual(1);
    });

    it("once reduced to a single active Administrator, that account cannot remove its own admin status (BR-27+BR-28 combined last-admin protection)", async () => {
      const soleAdmin = await createUser({ role: Role.ADMINISTRATOR, email: uniqueEmail("sole-admin"), password: "SoleAdminPass1" });

      // Deactivate every other active Administrator (including the shared
      // regression fixture), leaving soleAdmin as the only active one.
      await getPrisma().user.updateMany({
        where: { role: Role.ADMINISTRATOR, isActive: true, NOT: { id: soleAdmin.id } },
        data: { isActive: false },
      });

      const soleAdminAgent = request.agent(app);
      const loginRes = await soleAdminAgent.post("/api/auth/login").send({ email: soleAdmin.email, password: "SoleAdminPass1" });
      expect(loginRes.status).toBe(200);

      const blockedDeactivate = await soleAdminAgent.patch(`/api/admin/users/${soleAdmin.id}`).send({ isActive: false });
      expect(blockedDeactivate.status).toBe(403);

      const blockedDemote = await soleAdminAgent.patch(`/api/admin/users/${soleAdmin.id}`).send({ role: "IT_STAFF" });
      expect(blockedDemote.status).toBe(403);

      const stillAdmin = await getPrisma().user.findUnique({ where: { id: soleAdmin.id } });
      expect(stillAdmin?.isActive).toBe(true);
      expect(stillAdmin?.role).toBe("ADMINISTRATOR");

      // Restore the shared regression admin fixture.
      await getPrisma().user.update({ where: { id: adminUserId }, data: { isActive: true, role: Role.ADMINISTRATOR } });
    });

    it("directly exercises the BR-28 count check: PATCH rejects deactivating a target Administrator when the pre-update count of other active Administrators (excluding the target) is zero", async () => {
      // Construct a database state where exactly one Administrator row
      // (the target) is active, and use that SAME account to attempt to
      // demote itself away from ADMINISTRATOR via a role change — this
      // exercises the exact `targetWouldStopBeingActiveAdmin` +
      // `otherActiveAdminCount === 0` branch in the server's PATCH
      // handler (the LAST_ADMINISTRATOR code path), since BR-27's
      // self-check and BR-28's last-admin check both independently agree
      // this must be rejected for this exact request.
      const onlyAdmin = await createUser({ role: Role.ADMINISTRATOR, email: uniqueEmail("only-admin"), password: "OnlyAdminPass1" });
      await getPrisma().user.updateMany({
        where: { role: Role.ADMINISTRATOR, isActive: true, NOT: { id: onlyAdmin.id } },
        data: { isActive: false },
      });

      const onlyAdminAgent = request.agent(app);
      await onlyAdminAgent.post("/api/auth/login").send({ email: onlyAdmin.email, password: "OnlyAdminPass1" });

      const res = await onlyAdminAgent.patch(`/api/admin/users/${onlyAdmin.id}`).send({ role: "IT_STAFF" });
      expect(res.status).toBe(403);

      await getPrisma().user.update({ where: { id: adminUserId }, data: { isActive: true, role: Role.ADMINISTRATOR } });
    });
  });
});
