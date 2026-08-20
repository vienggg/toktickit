import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("API-06, API-07, API-08: GET /api/tickets Integration Tests", () => {
  const prisma = getPrisma();
  let userAId: number;
  let userBId: number;
  let categoryHardwareId: number;
  let categorySoftwareId: number;
  let systemId: number;

  beforeAll(async () => {
    // Setup 2 distinct users
    const userA = await prisma.requesterUser.upsert({
      where: { email: "isolation.userA@toktickit.local" },
      update: { isActive: true },
      create: { name: "User A", email: "isolation.userA@toktickit.local", isActive: true }
    });
    userAId = userA.id;

    const userB = await prisma.requesterUser.upsert({
      where: { email: "isolation.userB@toktickit.local" },
      update: { isActive: true },
      create: { name: "User B", email: "isolation.userB@toktickit.local", isActive: true }
    });
    userBId = userB.id;

    const catH = await prisma.category.upsert({
      where: { name: "Hardware" },
      update: {},
      create: { name: "Hardware" }
    });
    categoryHardwareId = catH.id;

    const catS = await prisma.category.upsert({
      where: { name: "Software" },
      update: {},
      create: { name: "Software" }
    });
    categorySoftwareId = catS.id;

    const sys = await prisma.relatedSystem.upsert({
      where: { name: "Corporate Laptop" },
      update: { isActive: true },
      create: { name: "Corporate Laptop", isActive: true }
    });
    systemId = sys.id;

    // Create 3 tickets for User A
    await prisma.ticket.createMany({
      data: [
        {
          ticketNumber: "TKT-2026-900001",
          summary: "Monitor screen flickering",
          description: "External monitor flickers constantly.",
          requestedPriority: "LOW",
          currentStatus: "New",
          requesterId: userAId,
          categoryId: categoryHardwareId,
          relatedSystemId: systemId
        },
        {
          ticketNumber: "TKT-2026-900002",
          summary: "VSCode extension crash",
          description: "Extension host terminates on startup.",
          requestedPriority: "HIGH",
          currentStatus: "New",
          requesterId: userAId,
          categoryId: categorySoftwareId,
          relatedSystemId: systemId
        },
        {
          ticketNumber: "TKT-2026-900003",
          summary: "Keyboard key stuck",
          description: "Spacebar is mechanically stuck.",
          requestedPriority: "MEDIUM",
          currentStatus: "New",
          requesterId: userAId,
          categoryId: categoryHardwareId,
          relatedSystemId: systemId
        }
      ]
    });

    // Create 1 ticket for User B
    await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-900004",
        summary: "User B secret ticket",
        description: "Confidential hardware issue.",
        requestedPriority: "URGENT",
        currentStatus: "New",
        requesterId: userBId,
        categoryId: categoryHardwareId,
        relatedSystemId: systemId
      }
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { requesterId: { in: [userAId, userBId] } }
    });
    await prisma.requesterUser.deleteMany({
      where: { id: { in: [userAId, userBId] } }
    });
  });

  it("API-06: strictly returns only tickets owned by requesterId (data isolation)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${userAId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    
    // Ensure none of User B's tickets appear
    const hasUserBTicket = res.body.data.some((t: any) => t.ticketNumber === "TKT-2026-900004");
    expect(hasUserBTicket).toBe(false);

    // Verify all returned tickets belong to User A
    res.body.data.forEach((t: any) => {
      expect(t.requester.id).toBe(userAId);
    });
  });

  it("API-07: filters correctly by search keyword and category", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${userAId}&search=flickering&categoryId=${categoryHardwareId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ticketNumber).toBe("TKT-2026-900001");
  });

  it("API-08: handles pagination with page and pageSize query parameters", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${userAId}&page=1&pageSize=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalCount: 3,
      totalPages: 2
    });
  });
});
