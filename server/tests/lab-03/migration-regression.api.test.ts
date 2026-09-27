import { describe, it, expect } from "vitest";
import { getPrisma } from "../../src/prisma.js";

// REGR-01 (docs/lab-03/tests.md): asserts the Lab 1-3 migration sequence
// (0_init -> 4_add_comments_and_notes) preserved every pre-Lab-3 row and
// every Ticket.requesterId -> User foreign key. Baseline recorded in
// docs/lab-03/tests.md "Regression Baseline" after the port-collision
// correction: Category 4, RequesterUser 5, RelatedSystem 7, Ticket 15,
// Attachment 5 (as of the pre-Lab-3 backup, artifacts/lab-03/db-backup-pre-lab3.sql).
// This test asserts the floor, not an exact count, because Lab 3 seed data
// (I-2) and later feature work add rows on top of that baseline without
// ever deleting a pre-existing one.
describe("Migration/Regression (REGR-01)", () => {
  it("REGR-01a: preserves at least the pre-Lab-3 row counts across all evolved tables", async () => {
    const prisma = getPrisma();
    const [categories, users, systems, tickets, attachments] = await Promise.all([
      prisma.category.count(),
      prisma.user.count(),
      prisma.relatedSystem.count(),
      prisma.ticket.count(),
      prisma.attachment.count(),
    ]);

    expect(categories).toBeGreaterThanOrEqual(4);
    expect(users).toBeGreaterThanOrEqual(5);
    expect(systems).toBeGreaterThanOrEqual(7);
    expect(tickets).toBeGreaterThanOrEqual(15);
    expect(attachments).toBeGreaterThanOrEqual(5);
  });

  it("REGR-01b: every Ticket.requesterId still resolves to a User row (no orphaned FKs)", async () => {
    // requesterId is a required, DB-constrained (ON DELETE RESTRICT) foreign
    // key, so Prisma's relation filter can't express "null" here — a raw
    // LEFT JOIN is the direct way to assert no orphan could exist.
    const prisma = getPrisma();
    const orphaned = await prisma.$queryRaw<Array<{ id: number; ticketNumber: string }>>`
      SELECT t.id, t."ticketNumber"
      FROM "Ticket" t
      LEFT JOIN "RequesterUser" u ON u.id = t."requesterId"
      WHERE u.id IS NULL
    `;
    expect(orphaned).toEqual([]);
  });

  it("REGR-01c: the 5 original Lab 2 Requester accounts still exist with role REQUESTER and their original data intact", async () => {
    const prisma = getPrisma();
    const originalEmails = [
      { email: "jennifer.anderson@toktick.internal", name: "Jennifer Anderson", department: "Finance", isActive: true },
      { email: "michael.brown@toktick.internal", name: "Michael Brown", department: "Operations", isActive: true },
      { email: "emily.davis@toktick.internal", name: "Emily Davis", department: "Marketing", isActive: true },
      { email: "david.wilson@toktick.internal", name: "David Wilson", department: "Engineering", isActive: true },
      { email: "alex.taylor@toktick.internal", name: "Alex Taylor", department: "Human Resources", isActive: false },
    ];

    for (const expected of originalEmails) {
      const user = await prisma.user.findUnique({ where: { email: expected.email } });
      expect(user).not.toBeNull();
      expect(user!.name).toBe(expected.name);
      expect(user!.department).toBe(expected.department);
      expect(user!.isActive).toBe(expected.isActive);
      expect(user!.role).toBe("REQUESTER");
      expect(user!.passwordHash).not.toBe("");
      expect(user!.passwordHash).not.toContain(" ");
    }
  });

  it("REGR-01d: no Ticket has a NULL status or requestedPriority after the enum conversion", async () => {
    const prisma = getPrisma();
    const withNulls = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::int AS count FROM "Ticket" WHERE status IS NULL OR priority IS NULL
    `;
    expect(Number(withNulls[0].count)).toBe(0);
  });

  it("REGR-01e: passwordHash values are bcrypt-format and never store the plaintext initial password", async () => {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({ select: { passwordHash: true } });
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(u.passwordHash).not.toBe("ChangeMe123!");
    }
  });
});
