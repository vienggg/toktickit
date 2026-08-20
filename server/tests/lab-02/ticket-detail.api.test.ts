import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("API-09, API-10, API-11: Ticket Detail, Attachment & Edit Integration Tests", () => {
  const prisma = getPrisma();
  let requesterId: number;
  let otherRequesterId: number;
  let categoryId: number;
  let systemId: number;
  let ticketId: number;
  let attachmentId: number;
  let dummyStoredFileName: string;

  beforeAll(async () => {
    const req = await prisma.requesterUser.upsert({
      where: { email: "detail.test@toktickit.local" },
      update: { isActive: true },
      create: { name: "Detail Test User", email: "detail.test@toktickit.local", isActive: true }
    });
    requesterId = req.id;

    const otherReq = await prisma.requesterUser.upsert({
      where: { email: "other.detail@toktickit.local" },
      update: { isActive: true },
      create: { name: "Other User", email: "other.detail@toktickit.local", isActive: true }
    });
    otherRequesterId = otherReq.id;

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

    // Create dummy physical attachment file
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    dummyStoredFileName = `test-${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadsDir, dummyStoredFileName), "Sample PDF Attachment Data");

    // Create test ticket with attachment
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-990001",
        summary: "Display flickering on docking station",
        description: "Whenever HDMI cable is plugged in, screen turns black.",
        requestedPriority: "HIGH",
        currentStatus: "New",
        requesterId,
        categoryId,
        relatedSystemId: systemId,
        attachments: {
          create: {
            fileName: "dock-error.pdf",
            storedFileName: dummyStoredFileName,
            fileSize: 1024,
            mimeType: "application/pdf"
          }
        }
      },
      include: { attachments: true }
    });

    ticketId = ticket.id;
    attachmentId = ticket.attachments[0].id;
  });

  afterAll(async () => {
    // Delete created tickets and test files
    await prisma.ticket.deleteMany({
      where: { requesterId: { in: [requesterId, otherRequesterId] } }
    });
    await prisma.requesterUser.deleteMany({
      where: { id: { in: [requesterId, otherRequesterId] } }
    });
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, dummyStoredFileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  it("API-09: fetches ticket detail and downloads attachment file", async () => {
    const detailRes = await request(app).get(`/api/tickets/${ticketId}?requesterId=${requesterId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(ticketId);
    expect(detailRes.body.ticketNumber).toBe("TKT-2026-990001");
    expect(detailRes.body.attachments.length).toBe(1);

    // Download attachment
    const dlRes = await request(app).get(`/api/attachments/${attachmentId}/download`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.header["content-disposition"]).toContain("dock-error.pdf");
    expect(dlRes.header["content-type"]).toBe("application/pdf");
  });

  it("API-10: soft-deletes attachment setting isRemoved=true while ticket status is New", async () => {
    const delRes = await request(app).delete(`/api/attachments/${attachmentId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isRemoved).toBe(true);

    // Verify detail API no longer returns the soft-deleted attachment
    const detailRes = await request(app).get(`/api/tickets/${ticketId}?requesterId=${requesterId}`);
    expect(detailRes.body.attachments.length).toBe(0);
  });

  it("API-11: updates ticket details when in New status with valid payload", async () => {
    const updateRes = await request(app)
      .put(`/api/tickets/${ticketId}`)
      .send({
        summary: "Display flickering updated summary",
        description: "Detailed updated description text for docking station issue.",
        categoryId,
        relatedSystemId: systemId,
        requestedPriority: "URGENT",
        requesterId
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.summary).toBe("Display flickering updated summary");
    expect(updateRes.body.requestedPriority).toBe("URGENT");
  });

  it("API-11: rejects unauthorized update from different requester", async () => {
    const updateRes = await request(app)
      .put(`/api/tickets/${ticketId}`)
      .send({
        summary: "Unauthorized modification attempt",
        description: "Should fail with HTTP 403 Forbidden.",
        categoryId,
        relatedSystemId: systemId,
        requestedPriority: "LOW",
        requesterId: otherRequesterId
      });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.error.code).toBe("FORBIDDEN");
  });
});
