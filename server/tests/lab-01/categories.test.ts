import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginAsRegressionRequester } from "../helpers/testAuth.js";

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const agent = await loginAsRegressionRequester();
    const res = await agent.get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  it("rejects an unauthenticated request with 401 (I-4: reference data is no longer public)", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });
});
