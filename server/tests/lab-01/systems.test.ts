import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginAsRegressionRequester } from "../helpers/testAuth.js";

// No test file existed for GET /api/systems at all before this — flagged
// in review of PR #65 (docs/lab-03/tests.md claimed 401 coverage "across
// ... systems" with nothing actually testing it).
describe("GET /api/systems", () => {
  it("returns the seeded active related systems", async () => {
    const agent = await loginAsRegressionRequester();
    const res = await agent.get("/api/systems");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(7);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
  });

  it("rejects an unauthenticated request with 401 (I-4: reference data is no longer public)", async () => {
    const res = await request(app).get("/api/systems");
    expect(res.status).toBe(401);
  });
});
