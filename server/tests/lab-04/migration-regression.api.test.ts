import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";

// MIG-01..MIG-06 (docs/lab-04/tests.md). Baseline numbers are read from the
// snapshot taken from the pg_dump BEFORE migration 5 (artifacts/lab-04/
// pre-migration-snapshot.json) — nothing is hardcoded here. Counts are a floor
// because seed data and other suites only ever add rows.
const serverDir = path.resolve(__dirname, "..", "..");
const snapshot = JSON.parse(
  readFileSync(path.resolve(serverDir, "..", "artifacts", "lab-04", "pre-migration-snapshot.json"), "utf8"),
) as {
  counts: { users: number; tickets: number; attachments: number; publicComments: number; internalNotes: number };
  tickets: Record<string, number>;
};

describe("Lab 4 migration and regression (MIG-01..MIG-06)", () => {
  it("MIG-01: no pre-Lab-4 row was lost and every snapshotted Ticket keeps its requester", async () => {
    const prisma = getPrisma();
    const [users, tickets, attachments, comments, notes] = await Promise.all([
      prisma.user.count(),
      prisma.ticket.count(),
      prisma.attachment.count(),
      prisma.publicComment.count(),
      prisma.internalNote.count(),
    ]);
    expect(users).toBeGreaterThanOrEqual(snapshot.counts.users);
    expect(tickets).toBeGreaterThanOrEqual(snapshot.counts.tickets);
    expect(attachments).toBeGreaterThanOrEqual(snapshot.counts.attachments);
    expect(comments).toBeGreaterThanOrEqual(snapshot.counts.publicComments);
    expect(notes).toBeGreaterThanOrEqual(snapshot.counts.internalNotes);

    const rows = await prisma.ticket.findMany({ select: { ticketNumber: true, requesterId: true } });
    const now = new Map(rows.map((r) => [r.ticketNumber, r.requesterId]));
    const mismatched = Object.entries(snapshot.tickets).filter(([num, requesterId]) => now.get(num) !== requesterId);
    expect(mismatched).toEqual([]);
  });

  it("MIG-02: a legacy Ticket reads normally with zero Actions Taken and an empty history", async () => {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-2026-000104" },
      include: { actionsTaken: true, statusHistory: true },
    });
    expect(ticket.version).toBeGreaterThanOrEqual(1);
    expect(ticket.actionsTaken).toEqual([]);
    expect(ticket.statusHistory).toEqual([]);
  });

  it("MIG-03: resolvedAt/closedAt were backfilled for legacy RESOLVED/CLOSED Tickets (BR-40)", async () => {
    const prisma = getPrisma();
    const legacy = Object.keys(snapshot.tickets);
    const missing = await prisma.ticket.count({
      where: { ticketNumber: { in: legacy }, status: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: null },
    });
    expect(missing).toBe(0);
    const closedMissing = await prisma.ticket.count({
      where: { ticketNumber: { in: legacy }, status: "CLOSED", closedAt: null },
    });
    expect(closedMissing).toBe(0);
  });

  it("MIG-04: running the seed again adds no rows (idempotent)", async () => {
    const prisma = getPrisma();
    // Other test files run in parallel and add their own rows, so only
    // seed-owned rows are counted (fixed seed emails/ticket numbers/prefix).
    const seedEmails = [
      "jennifer.anderson", "michael.brown", "emily.davis", "david.wilson", "alex.taylor", "nok.chaiyo",
      "priya.nair", "carlos.mendez", "sofia.rossi", "tom.becker", "mali.wong", "grace.kim", "daniel.osei",
    ].map((n) => `${n}@toktick.internal`);
    const seedTickets = ["TKT-2026-000301", "TKT-2026-000303", "TKT-2026-000304", "TKT-2026-000305", "TKT-2026-000307"];
    const count = async () => ({
      users: await prisma.user.count({ where: { email: { in: seedEmails } } }),
      tickets: await prisma.ticket.count({ where: { ticketNumber: { in: seedTickets } } }),
      comments: await prisma.publicComment.count({ where: { ticket: { ticketNumber: { in: seedTickets } } } }),
      notes: await prisma.internalNote.count({ where: { ticket: { ticketNumber: { in: seedTickets } } } }),
      actions: await prisma.actionTaken.count({ where: { clientRequestId: { startsWith: "seed-lab4-" } } }),
      history: await prisma.ticketStatusHistory.count({ where: { ticket: { ticketNumber: { in: seedTickets } } } }),
    });
    execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { cwd: serverDir, stdio: "pipe" });
    const first = await count();
    execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { cwd: serverDir, stdio: "pipe" });
    const second = await count();
    expect(second).toEqual(first);
  }, 120_000);

  it("MIG-05: migration 5 contains no destructive statement", () => {
    const dir = readdirSync(path.join(serverDir, "prisma", "migrations")).find((d) => d.startsWith("5_"));
    expect(dir).toBe("5_add_actions_taken_and_history");
    const sql = readFileSync(path.join(serverDir, "prisma", "migrations", dir as string, "migration.sql"), "utf8");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });

  it("MIG-06: seed provides the Lab 4 demo shapes (0/1/many actions, all statuses, follow-up, mixed staff)", async () => {
    const prisma = getPrisma();
    const tickets = await prisma.ticket.findMany({
      where: { actionsTaken: { some: { clientRequestId: { startsWith: "seed-lab4-" } } } },
      include: { actionsTaken: true },
    });
    const sizes = tickets.map((t) => t.actionsTaken.length);
    expect(sizes.some((n) => n === 1)).toBe(true);
    expect(sizes.some((n) => n >= 3)).toBe(true);

    const seeded = tickets.flatMap((t) => t.actionsTaken);
    expect(new Set(seeded.map((a) => a.status))).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
    expect(seeded.some((a) => a.followUpRequired && (a.followUpNote ?? "").trim().length > 0)).toBe(true);

    // One Ticket whose actions were performed by two different staff, neither of them the owner.
    const mixed = tickets.find((t) => {
      const performers = new Set(t.actionsTaken.map((a) => a.createdById));
      return performers.size >= 2 && t.ownerId !== null && !performers.has(t.ownerId);
    });
    expect(mixed).toBeDefined();

    // Zero-metric fixtures.
    expect(await prisma.ticket.count({ where: { ownerId: { not: null }, actionsTaken: { none: {} } } })).toBeGreaterThan(0);
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } })).toBeGreaterThan(0);
    expect(await prisma.user.count({ where: { role: "REQUESTER", isActive: true, submittedTickets: { none: {} } } })).toBeGreaterThan(0);
    expect(
      await prisma.user.count({
        where: { role: "IT_STAFF", isActive: true, ownedTickets: { none: {} }, actionsAssigned: { none: {} } },
      }),
    ).toBeGreaterThan(0);
    expect(await prisma.ticketStatusHistory.count()).toBeGreaterThan(0);
  });
});
