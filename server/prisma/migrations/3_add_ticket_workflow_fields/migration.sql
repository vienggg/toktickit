-- Hand-edited per docs/lab-03/specification.md §8 and §5 (BR-16): IT Priority
-- initially copies Requested Priority for each ticket individually, not a
-- blanket default. The raw Prisma diff only applies the column default
-- ('MEDIUM') to every existing row, which is wrong for tickets whose
-- Requested Priority is LOW/HIGH/URGENT.

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "itPriority" "Priority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "requesterResolvedAt" TIMESTAMP(3);

-- Backfill: copy each existing ticket's own Requested Priority into IT
-- Priority, per BR-16 ("IT Priority initially copies Requested Priority").
UPDATE "Ticket" SET "itPriority" = "priority";

-- CreateIndex
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");

-- CreateIndex
CREATE INDEX "Ticket_itPriority_idx" ON "Ticket"("itPriority");

-- CreateIndex
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "RequesterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
