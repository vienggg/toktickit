-- Hand-edited per docs/lab-03/specification.md §8 (D-05 procedure).
-- The raw Prisma diff added "passwordHash" TEXT NOT NULL with no default,
-- which fails against the 5 existing RequesterUser rows. This version adds
-- it nullable, backfills a real bcrypt-compatible hash via pgcrypto's
-- Blowfish implementation (bcryptjs can verify $2a$/$2b$ hashes produced
-- this way), then tightens to NOT NULL.
--
-- Seeded/local-dev-only initial password for every migrated Lab 2 Requester:
--   ChangeMe123!
-- (documented in docs/lab-03/specification.md §8 and README.md; never a
-- real secret, mustChangePassword defaults to true so it must be changed
-- at first login per BR-02/BR-30.)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "RequesterUser" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "RequesterUser" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RequesterUser" ADD COLUMN     "passwordHash" TEXT;
ALTER TABLE "RequesterUser" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'REQUESTER';

UPDATE "RequesterUser" SET "passwordHash" = crypt('ChangeMe123!', gen_salt('bf', 10));

ALTER TABLE "RequesterUser" ALTER COLUMN "passwordHash" SET NOT NULL;

-- CreateIndex
CREATE INDEX "RequesterUser_role_idx" ON "RequesterUser"("role");

-- CreateIndex
CREATE INDEX "RequesterUser_isActive_idx" ON "RequesterUser"("isActive");
