import { describe, it, expect, afterEach } from "vitest";
import { getPrisma } from "../../src/prisma.js";

// API-18 (docs/lab-04/tests.md): the follow-up and completed-result rules are
// enforced by CHECK constraints in the database (BR-08, BR-09), independent
// of any API validation, so seeds, scripts and future code paths cannot
// create an inconsistent row. The remaining API-xx tests are added with I-3.
describe("Actions Taken database constraints (API-18)", () => {
  const created: number[] = [];

  afterEach(async () => {
    if (created.length) {
      await getPrisma().actionTaken.deleteMany({ where: { id: { in: created.splice(0) } } });
    }
  });

  async function fixtures() {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { ownerId: { not: null } } });
    return { ticketId: ticket.id, userId: ticket.ownerId as number };
  }

  it("API-18a: rejects follow-up required with a missing or blank note", async () => {
    const prisma = getPrisma();
    const { ticketId, userId } = await fixtures();
    for (const note of [null, "", "   "]) {
      await expect(
        prisma.actionTaken.create({
          data: { ticketId, actionAt: new Date(), description: "x", followUpRequired: true, followUpNote: note, createdById: userId, assigneeId: userId },
        }),
      ).rejects.toThrow(/ActionTaken_followUp_note_check|check constraint/i);
    }
  });

  it("API-18b: rejects a COMPLETED action with a missing or blank result", async () => {
    const prisma = getPrisma();
    const { ticketId, userId } = await fixtures();
    for (const result of [null, "", "  "]) {
      await expect(
        prisma.actionTaken.create({
          data: { ticketId, actionAt: new Date(), description: "x", status: "COMPLETED", result, createdById: userId, assigneeId: userId },
        }),
      ).rejects.toThrow(/ActionTaken_completed_result_check|check constraint/i);
    }
  });

  it("API-18c: accepts valid rows and enforces unique (ticketId, clientRequestId)", async () => {
    const prisma = getPrisma();
    const { ticketId, userId } = await fixtures();
    const clientRequestId = `test-api18-${Date.now()}`;
    const ok = await prisma.actionTaken.create({
      data: { ticketId, actionAt: new Date(), description: "ok", status: "COMPLETED", result: "done", followUpRequired: true, followUpNote: "check later", createdById: userId, assigneeId: userId, clientRequestId },
    });
    created.push(ok.id);
    expect(ok.version).toBe(1);
    await expect(
      prisma.actionTaken.create({
        data: { ticketId, actionAt: new Date(), description: "dup", createdById: userId, assigneeId: userId, clientRequestId },
      }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it("API-18d: a Ticket with recorded actions cannot be deleted (ON DELETE RESTRICT, BR-13)", async () => {
    const prisma = getPrisma();
    const { ticketId, userId } = await fixtures();
    const a = await prisma.actionTaken.create({
      data: { ticketId, actionAt: new Date(), description: "keep", createdById: userId, assigneeId: userId },
    });
    created.push(a.id);
    await expect(prisma.ticket.delete({ where: { id: ticketId } })).rejects.toThrow();
    expect(await prisma.ticket.count({ where: { id: ticketId } })).toBe(1);
  });
});
