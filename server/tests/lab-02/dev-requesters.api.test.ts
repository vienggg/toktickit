import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("API-01 & API-02: GET /api/dev/requesters Integration Tests", () => {
  const prisma = getPrisma();

  beforeAll(async () => {
    // Seed active & inactive requesters for testing
    await prisma.requesterUser.upsert({
      where: { email: "test.active@toktickit.local" },
      update: { isActive: true },
      create: { name: "Test Active", email: "test.active@toktickit.local", isActive: true }
    });
    await prisma.requesterUser.upsert({
      where: { email: "test.inactive@toktickit.local" },
      update: { isActive: false },
      create: { name: "Test Inactive", email: "test.inactive@toktickit.local", isActive: false }
    });
  });

  afterAll(async () => {
    await prisma.requesterUser.deleteMany({
      where: { email: { in: ["test.active@toktickit.local", "test.inactive@toktickit.local"] } }
    });
  });

  it("API-01: returns HTTP 200 and an array of active development requesters", async () => {
    const res = await request(app).get("/api/dev/requesters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const activeUser = res.body.find((u: { email: string }) => u.email === "test.active@toktickit.local");
    expect(activeUser).toBeDefined();
    expect(activeUser.isActive).toBe(true);
    expect(activeUser).toHaveProperty("id");
    expect(activeUser).toHaveProperty("name");
  });

  it("API-02: strictly excludes inactive requesters from the response", async () => {
    const res = await request(app).get("/api/dev/requesters");
    expect(res.status).toBe(200);

    const inactiveUser = res.body.find((u: { email: string }) => u.email === "test.inactive@toktickit.local");
    expect(inactiveUser).toBeUndefined();

    // Verify all returned users have isActive === true
    res.body.forEach((u: { isActive: boolean }) => {
      expect(u.isActive).toBe(true);
    });
  });
});
