import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/dev/requesters (API-01, API-02)", () => {
  it("API-01: returns HTTP 200 with list of active development requesters", async () => {
    const res = await request(app).get("/api/dev/requesters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    const firstUser = res.body[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("name");
    expect(firstUser).toHaveProperty("email");
    expect(firstUser).toHaveProperty("department");
    expect(firstUser.isActive).toBe(true);

    const jennifer = res.body.find((u: { email: string }) => u.email === "jennifer.anderson@toktick.internal");
    expect(jennifer).toBeDefined();
    expect(jennifer.name).toBe("Jennifer Anderson");
    expect(jennifer.department).toBe("Finance");
  });

  it("API-02: strictly excludes inactive requesters (Alex Taylor)", async () => {
    const res = await request(app).get("/api/dev/requesters");

    expect(res.status).toBe(200);
    const inactiveUser = res.body.find((u: { name: string }) => u.name === "Alex Taylor");
    expect(inactiveUser).toBeUndefined();

    // Verify all returned users have isActive === true
    const allActive = res.body.every((u: { isActive: boolean }) => u.isActive === true);
    expect(allActive).toBe(true);
  });
});
