-- Hand-edited per docs/lab-03/specification.md §8 (D-05).
-- Prisma's raw diff for a String -> native enum conversion generates
-- DROP COLUMN + ADD COLUMN, which silently destroys existing data.
-- This version preserves every existing value via USING casts.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- AlterTable: convert "priority" (String) -> Priority enum, preserving data.
-- Existing values are "Low" | "Medium" | "High" | "Urgent" (verified against
-- the live database before writing this migration).
ALTER TABLE "Ticket" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "priority" TYPE "Priority" USING (
  CASE "priority"
    WHEN 'Low' THEN 'LOW'
    WHEN 'Medium' THEN 'MEDIUM'
    WHEN 'High' THEN 'HIGH'
    WHEN 'Urgent' THEN 'URGENT'
  END
)::"Priority";
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET NOT NULL;

-- AlterTable: convert "status" (String) -> TicketStatus enum, preserving data.
-- Existing values are "New" | "In_Progress" | "Resolved" | "Closed" (verified
-- against the live database before writing this migration).
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus" USING (
  CASE "status"
    WHEN 'New' THEN 'NEW'
    WHEN 'In_Progress' THEN 'IN_PROGRESS'
    WHEN 'Resolved' THEN 'RESOLVED'
    WHEN 'Closed' THEN 'CLOSED'
  END
)::"TicketStatus";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
ALTER TABLE "Ticket" ALTER COLUMN "status" SET NOT NULL;

-- Note: "Ticket_status_idx" already exists from 0_init and is preserved
-- automatically by Postgres across the ALTER COLUMN TYPE above; the raw
-- Prisma diff incorrectly suggested recreating it (would error: relation
-- already exists), so that statement is intentionally omitted here.
