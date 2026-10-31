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
