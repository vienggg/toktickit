# Migration 5 rehearsal — 2026-11-01

**Migration:** `server/prisma/migrations/5_add_actions_taken_and_history/migration.sql`
**Procedure:** `pg_dump` of the working database → restored into a scratch database → migration applied with `psql -v ON_ERROR_STOP=1` → counts compared. The dump is kept outside the repository because it contains password hashes.

| Table | Before | After |
|---|---:|---:|
| RequesterUser (User) | 451 | 451 |
| Ticket | 1031 | 1031 |
| Attachment | 128 | 128 |
| PublicComment | 229 | 229 |
| InternalNote | 144 | 144 |
| ActionTaken (new) | — | 0 |
| TicketStatusHistory (new) | — | 0 |

* `Ticket.version` = 1 for all 1031 rows; `resolvedAt` backfilled for the 62 legacy `RESOLVED`/`CLOSED` Tickets; `closedAt` for the 35 `CLOSED` Tickets.
* SQL scan: no `DROP`, `TRUNCATE` or `DELETE FROM`.
* CHECK constraints probed with raw inserts: follow-up without note → `ActionTaken_followUp_note_check` violation; `COMPLETED` without result → `ActionTaken_completed_result_check` violation.

**Recovery procedure:** create a fresh database, `psql -f <dump>`, point `DATABASE_URL` at it, then `npx prisma migrate resolve --rolled-back 5_add_actions_taken_and_history` so the migration can be applied again after a fix.

## Correction after review of PR #86 (2026-11-01)

**Defect:** the first version of migration 5 contained only 1 of its 6 foreign keys. The SQL had been extracted from `prisma migrate diff` with a `sed` range that stopped at the first `... RESTRICT ON UPDATE CASCADE;` line, silently dropping the remaining five `ADD CONSTRAINT ... FOREIGN KEY` statements. The reviewer caught it by comparing the SQL with `schema.prisma`.

**Fix:** migration 5 was regenerated from the complete diff (6 foreign keys, hand-written CHECKs and backfill kept). New tests: MIG-07 (all 6 FKs and delete rules from `pg_constraint`), MIG-08 (`prisma migrate diff --exit-code` reports no drift between migrations and `schema.prisma`) and MIG-09 (orphan rows are rejected).

**Recovery rehearsal (documented procedure, executed for real):** a safety dump of the dev database was taken, the database was dropped and recreated, the pre-Lab-4 dump was restored (0 errors; users 451, tickets 1031, attachments 128, public comments 229, internal notes 144), `prisma migrate deploy` applied migration 5, the seed ran, and the full suite passed (server 264/264) with "No difference detected" from the drift check.
