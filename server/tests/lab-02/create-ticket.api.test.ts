import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("API-03, API-04, API-05: POST /api/tickets Integration Tests", () => {
  const prisma = getPrisma();
  let requesterId: number;
  let categoryId: number;
  let systemId: number;

  beforeAll(async () => {
    // Ensure test requester, category, and system exist
    const req = await prisma.requesterUser.upsert({
      where: { email: "jennifer.anderson@toktickit.local" },
      update: { isActive: true },
      create: { name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.local", isActive: true }
    });
    requesterId = req.id;

    const cat = await prisma.category.upsert({
      where: { name: "Hardware" },
      update: {},
      create: { name: "Hardware" }
    });
    categoryId = cat.id;

    const sys = await prisma.relatedSystem.upsert({
      where: { name: "Corporate Laptop" },
      update: { isActive: true },
      create: { name: "Corporate Laptop", isActive: true }
    });
    systemId = sys.id;
  });

  afterAll(async () => {
    // Cleanup created test tickets
    await prisma.ticket.deleteMany({
      where: { requesterId }
    });
  });

  it("API-03: creates a ticket (HTTP 201) with unique number, status New, and matching requesterId", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("summary", "MacBook trackpad is unresponsive")
      .field("description", "The trackpad stopped clicking after recent OS update.")
      .field("requestedPriority", "HIGH")
      .field("categoryId", categoryId)
      .field("relatedSystemId", systemId)
      .field("requesterId", requesterId)
      .attach("attachments", Buffer.from("sample log content"), "system.log.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.currentStatus).toBe("New");
    expect(res.body.requesterId).toBe(requesterId);
    expect(res.body.summary).toBe("MacBook trackpad is unresponsive");
    expect(res.body.requestedPriority).toBe("HIGH");
    expect(res.body.attachments.length).toBe(1);
    expect(res.body.attachments[0].fileName).toBe("system.log.pdf");
    expect(res.body.attachments[0].isRemoved).toBe(false);
  });

  it("API-04: rejects ticket submission (HTTP 400) when summary or description is invalid", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("summary", "Abc") // < 5 chars
      .field("description", "Short") // < 10 chars
      .field("requestedPriority", "LOW")
      .field("categoryId", categoryId)
      .field("relatedSystemId", systemId)
      .field("requesterId", requesterId);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it("API-05: rejects ticket submission (HTTP 400) with unsupported file type", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("summary", "Virus detected on machine")
      .field("description", "Suspicious program executable found in downloads folder.")
      .field("requestedPriority", "URGENT")
      .field("categoryId", categoryId)
      .field("relatedSystemId", systemId)
      .field("requesterId", requesterId)
      .attach("attachments", Buffer.from("MZ binary content"), "malware.exe");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
  });
});
