-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "createdById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "clientRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_idx" ON "ActionTaken"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_createdAt_id_idx" ON "TicketStatusHistory"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Lab 4 business rules enforced in the database (spec BR-08, BR-09).
-- Prisma cannot express CHECK constraints, so they are added by hand.
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followUp_note_check"
  CHECK (NOT "followUpRequired" OR ("followUpNote" IS NOT NULL AND length(btrim("followUpNote")) > 0));

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_completed_result_check"
  CHECK ("status" <> 'COMPLETED' OR ("result" IS NOT NULL AND length(btrim("result")) > 0));

-- Backfill (spec BR-40): legacy Tickets already RESOLVED/CLOSED get an
-- approximate resolvedAt/closedAt from updatedAt so "recently resolved"
-- works for pre-Lab-4 data. No rows are deleted or rewritten otherwise.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('RESOLVED', 'CLOSED') AND "resolvedAt" IS NULL;
UPDATE "Ticket" SET "closedAt"   = "updatedAt" WHERE "status" = 'CLOSED' AND "closedAt" IS NULL;
