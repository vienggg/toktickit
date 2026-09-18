# Lab 3 Test DD and Traceability — TokTickIT

This plan is written before implementation, alongside `specification.md`,
`api-spec.md`, and `ui-spec.md` (I-1), and is updated in place as each
feature Issue lands — never reconstructed after the fact. "Final" status is
filled in as each test is written and run; a blank cell means not yet
implemented.

## Correction to the Lab 2 Test Record

Lab 2's `docs/lab-02/tests.md` and `docs/session_state.md` report
**"Playwright 34/34 passing"** for an end-to-end suite. That suite did not
exist inside the repository — the actual script was `lab2/test_all_features_e2e.mjs`,
a hand-rolled script using the `playwright` library directly, living outside
`toktickit/` entirely, with no `e2e/` folder and no `@playwright/test` runner
in the repo at that time. Lab 3 introduces `@playwright/test` properly (see
Phase 0 of `docs/lab-03/sprint-plan.md`) and this record is corrected here
rather than carried forward silently.

---

## Coverage Levels Required (per handout §10)

Unit · API/Integration · UI Component · UI Style · Responsive ·
Security/Authorization · Migration/Regression · End-to-End.

---

## Server Tests — `server/tests/lab-03/`

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-12 | Password hash/verify round-trip | Hash never equals plaintext; verify succeeds only for correct password | `server/tests/lab-03/password.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-09 | Password policy validator | Rejects <8 chars, no letter, or no digit; accepts a compliant password | `server/tests/lab-03/password.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-19, §6.5 | Status transition matrix — all legal edges | Every ✅ cell in §6.5 returns permitted=true | `server/tests/lab-03/status-transitions.unit.test.ts` | Pass |
| UNIT-04 | Unit | BR-19, §6.5 | Status transition matrix — all illegal edges | Every non-✅ cell returns permitted=false with the correct permitted-set | `server/tests/lab-03/status-transitions.unit.test.ts` | Pass |
| UNIT-05 | Unit | BR-17 (added in review of PR #68 — item 1: `getPermittedTransitionsForTicket` extracted so `GET`'s serializer and `PATCH /status` share one BR-17 filter instead of two independent copies) | `getPermittedTransitionsForTicket` helper | Excludes `IN_PROGRESS` when `ownerId` is `null`; includes it once owned; leaves other statuses' permitted sets unchanged | `server/tests/lab-03/status-transitions.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Valid login | 200, authenticated cookie set, safe user object (no hash) | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-05, BR-06 | Invalid credentials | 401, generic message, identical for wrong password and unknown email | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | AC-06, BR-07 | Inactive account, correct password | 403, deactivation message | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | AC-07, BR-08 | Logout | 204, cookie cleared, subsequent protected call returns 401; calling logout twice still 204 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | FR-03 | GET /api/auth/me | 200 with role and mustChangePassword; 401 unauthenticated | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | AC-02, AC-14, BR-02, BR-10 | Change password (forced) | 200, mustChangePassword cleared; rejects reusing initial password; rejects mismatch | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-07 | API | AC-02, FR-04 | mustChangePassword lockout | Any non-allowlisted route returns 403 while true | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-08 | API | AC-04, BR-24 | Requester requests Internal Notes | 403, empty body, no note content leaked | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-09 | API | AC-03, BR-03 | Client-supplied requesterId ignored | Authenticated identity determines ownership regardless of body/query override | `server/tests/lab-02/create-ticket.api.test.ts` (API-03b) | Pass |
| API-10 | API | AC-17, BR-32 | Cross-requester ticket access | 404 (not 403), no existence confirmation | `server/tests/lab-02/ticket-detail.api.test.ts` (API-10c) | Pass |
| API-10d | API | FR-07 | Unauthenticated access to every Requester route | 401 on GET/POST/PATCH tickets, GET/POST/DELETE attachments, the download route, categories, and systems — **corrected in review of PR #65**: the original claim listed categories/systems but not PATCH, attachments, download, or systems specifically, and no systems test file existed at all | `server/tests/lab-01/{categories,systems}.test.ts`, `server/tests/lab-02/{create-ticket,my-tickets,ticket-detail}.api.test.ts` | Pass |
| API-10e | API | §5.1, §9 | Attachment download endpoint (new in I-4 — did not exist in Lab 2) | Owner downloads 200; non-owner 404; soft-removed attachment 410 | `server/tests/lab-02/ticket-detail.api.test.ts` (API-12b, API-13) | Pass |
| API-10f | Security | BR-32 | POST/DELETE attachment ownership (added in review of PR #65 — the ownership fix itself had no non-owner test on these two routes, only GET/download) | Non-owner POST returns 404 and writes no file to disk; non-owner DELETE returns 404 | `server/tests/lab-02/ticket-detail.api.test.ts` (API-12c, API-13a) | Pass |
| API-11 | API | FR-07 | Unauthenticated access to any protected route | 401 across the route table | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-12 | API | §6 matrix | Full role × endpoint authorization grid | Prints and asserts the matrix in `specification.md` §6 in one run | `server/tests/lab-03/authorization.api.test.ts` | Pass *(now covers I-4/I-6/I-7 routes; still grows for I-8's admin routes)* |
| AUTHZ-01 | API | §6 matrix | requireRole middleware — permitted/rejected role behavior | Permitted role passes through; other role → 403 FORBIDDEN; no auth → 401 | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-02 | Security | BR-07, FR-07 | Deactivation takes effect on next request, not at token expiry | A live session is rejected 403 the instant the account is deactivated | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-13 | API | AC-18 | Staff queue — search/filter/sort/pagination | Correct result sets per query; invalid param → 400 naming the field | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-13n | API | AC-18 (added in review of PR #67 — item 3: `page` had no upper bound, only `pageSize` did) | Staff queue — huge page number | An absurdly large `page` (e.g. `99999999999999999999`) returns 400 naming `page`, not an unhandled 500 from an oversized Prisma `skip` | `server/tests/lab-03/staff-queue.api.test.ts` (API-13n) | Pass |
| API-14 | API | FR-14 | Staff queue — role restriction | Requester → 403; IT Staff/Admin → 200 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-28 | API | AC-18 (added in review of PR #67 — item 2: no endpoint listed staff for the Owner filter picker) | `GET /api/staff/members` roster | Returns active IT_STAFF/ADMINISTRATOR users as `[{ id, name }]` ordered by name; Requester → 403; unauthenticated → 401 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-15 | API | AC-08, BR-13, BR-14 | Claim/reassign ownership | Owner set correctly; rejects an inactive or Requester-role ownerId | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-16 | API | BR-16 | Set IT Priority | Updates independently of Requested Priority; role-restricted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-17 | API | AC-09, BR-17, BR-19 | Status transition enforcement | Legal transition succeeds; illegal → 409 with permitted set; IN_PROGRESS blocked while unassigned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-17b | API | BR-17 (added in review of PR #68 — item 1: `GET`'s `permittedStatusTransitions` did not apply the BR-17 filter that `PATCH /status` enforces, so an unassigned ticket's response could offer `IN_PROGRESS` as permitted even though applying it always 409'd) | `GET /api/staff/tickets/:id` — `permittedStatusTransitions` BR-17 filter | Excludes `IN_PROGRESS` for an unassigned ticket; includes it once the ticket has an owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-18 | API | AC-10, BR-05 | Requester resolution signal | Sets flag + auto-comment; status unchanged; Requester cannot set Resolved/Closed directly; blocked (409) once already terminal; 404 for non-owner | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-18f | API | BR-05 | Resolution-signal idempotency (added in review of PR #66 — no test called the route twice on the same still-open ticket) | A second call on the same open ticket returns 409, does not overwrite the timestamp, and does not create a duplicate comment | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-19 | API | BR-04, BR-21, BR-22, BR-23, BR-32 | Public Comments CRUD (create/list only) | Append-only (no PATCH/DELETE route); author/timestamp server-set; rejects blank/oversize content; 404 for non-owning Requester; 401 unauthenticated | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-20 | API | BR-04, BR-21 | Internal Notes CRUD (create/list only) | Staff/Admin only; append-only; same validation as comments | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| SEC-01 | Security | (found capturing I-7's Part 7 curl evidence, not from a written requirement — every `include: { requester: true }` fetched the full `User` row, including `passwordHash`, into the ticket response; three Requester-facing routes since I-2, plus the new I-7 staff-detail route) | No ticket response ever includes `passwordHash` | `res.body.requester.passwordHash` is `undefined` and the raw JSON contains no `passwordHash` string, for both the Requester's own ticket detail and the staff detail route | `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-21 | API | FR-20 | Admin user list — search/role filter | Correct filtering; non-Admin → 403 | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-22 | API | AC-11, BR-26 | Create user — duplicate email | 409, case-insensitive match, no user created | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-23 | API | FR-24 | Create user — invalid role | 400 | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-24 | API | FR-22 | Edit user — basic fields | Name/email/role/isActive update correctly | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-25 | API | AC-14, FR-23 | Set new initial password | mustChangePassword forced true; that user's next login requires change | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-26 | API | AC-12, BR-27 | Self-deactivation blocked | Admin cannot deactivate/demote own account | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-27 | API | AC-13, BR-28 | Last-Administrator protection | Deactivating/demoting the last active Admin rejected; a second active Admin may be deactivated | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-29 | API | AC-13, BR-28 (added in review of PR #69 — item 1: TOCTOU race in the last-Administrator count-then-write) | Last-Administrator protection under real concurrency | Two concurrent PATCHes, each deactivating the other of exactly two active Administrators, via `Promise.all`: exactly one succeeds (200), the other is rejected (403 LAST_ADMINISTRATOR), and a fresh DB count immediately after confirms at least one active Administrator remains | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-30 | API | AC-12, BR-27 vs BR-26 (added in review of PR #69 — item 4: ordering) | Self-modification check precedes duplicate-email check | A self-deactivation attempt whose body also collides on another user's email returns 403 SELF_MODIFICATION_BLOCKED, not 409 DUPLICATE_EMAIL | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-31 | API | BR-26 (added in review of PR #69 — item 5: app-level email pre-check races the DB unique constraint) | Duplicate-email race on create | Two concurrent `POST /api/admin/users` with the same email via `Promise.all`: one succeeds (201), the other returns 409 DUPLICATE_EMAIL (not a 500), and only one row is created | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| REGR-01 | Migration/Regression | BR-30, BR-31, AC-16 | Row-count and FK integrity before/after migration | Category/RequesterUser→User/RelatedSystem/Ticket/Attachment counts unchanged; every requesterId still resolves | `server/tests/lab-03/migration-regression.api.test.ts` | |
| REGR-02 | Migration/Regression | FR-10 | All Lab 1/2 endpoints still function under cookie auth | Every Lab 2 API test passes after rewriting from `?requesterId=` to session auth | `server/tests/lab-03/migration-regression.api.test.ts` | |

## Client Tests — `client/tests/lab-03/`

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI Component | AC-01, AC-05 | Login form | Valid submit calls API and redirects; invalid shows generic error; busy state disables button | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI Component | AC-02, BR-09, BR-11 | Change Password form | Validates policy and confirmation client-side; submits and redirects on success | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI Component | FR-14 | Staff Queue rendering | Renders rows with correct badges; empty and no-results states render correctly | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-04 | UI Style | §1 (ui-spec) | Status/role badge colors | Correct token applied per status/role value; owner name vs. Unassigned pill | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-05 | Responsive | §9 (ui-spec) | Queue table → card collapse | Card layout markup present alongside the desktop table (Bootstrap breakpoint classes; jsdom does not evaluate CSS media queries, so this asserts markup, not computed layout) | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-03e | UI Component | FR-14 (added in review of PR #67 — item 1: "Open" navigated to a route App.tsx never defines, and no test caught it; **superseded in I-7**, which built that route; wording corrected in review of PR #68 — item 3: the I-6 modal was fully deleted, not preserved) | Queue "Open" action | Clicking a row's Open button navigates to the real `/staff/tickets/:id` Staff Ticket Detail screen (I-7). The I-6 read-only modal (`TicketDetailModal`) no longer exists at all; `onOpenTicket` is a bare optional callback that receives the clicked ticket id and renders nothing itself — a caller that passes it must build its own UI | `client/tests/lab-03/StaffTicketQueue.test.tsx` (item-1) | Pass |
| UI-03f | UI Component | AC-18 (added in review of PR #67 — item 2: Owner filter only offered All/Unassigned) | Queue Owner picker | Picker is populated from `GET /api/staff/members`; selecting a specific staff member sends the matching `ownerId` query param | `client/tests/lab-03/StaffTicketQueue.test.tsx` (item-2) | Pass |
| UI-06 | UI Component | FR-15, FR-16, FR-17 | Staff Ticket Detail controls | Claim/reassign/IT Priority/status controls call the correct endpoints | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-07 | UI Style | §7 (ui-spec) | Public Comment vs Internal Note panel styling | Distinct background/label rendered for each panel | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-08 | UI Component | FR-20, FR-21, FR-22 | User Management list/create/edit forms | Search/filter call correct query; create/edit submit correct payloads; inline validation renders | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-09 | UI Component | AC-12, AC-13 | Admin safety rules surfaced in UI | Self-deactivation and last-Admin attempts show an inline blocking message | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-10 | UI Component | FR-20 (added in review of PR #69 — item 9: no client test exercised RequireRole on a route this sensitive) | RequireRole guard on `/admin/users` | IT_STAFF and REQUESTER users are redirected away from `/admin/users` instead of it rendering; an ADMINISTRATOR user renders it normally | `client/tests/lab-03/ProtectedRoute.test.tsx` | Pass |

## End-to-End Tests — `e2e/lab-03/` (Playwright)

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-07, AC-15 | Login → app → logout → blocked | Full session lifecycle; direct navigation to a protected route after logout redirects to `/login` | `e2e/lab-03/authentication.spec.ts` | |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after a valid password change | `e2e/lab-03/authentication.spec.ts` | |
| E2E-03 | E2E | FR-14–FR-19 | Full staff workflow | Queue → open Ticket → claim → set IT Priority → change status → post comment → post note | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-04 | E2E | FR-20–FR-23 | Full admin workflow | Create user → set initial password → that user's forced change at next login | `e2e/lab-03/user-administration.spec.ts` | |

---

## Part 7 Direct API Authorization Evidence

Cookie-jar `curl` transcripts (D-01: the session is an httpOnly cookie, so
there is no bearer token to paste) captured 2026-09-17 against a running
local server and the real dev database, per `sprint-plan.md` §6:
`artifacts/lab-03/curl-transcripts-i7.txt`. Covers all six required
scenarios (Requester → internal notes 403 with no note content; Requester →
staff queue 403; Requester → another Requester's ticket 404 masking per
BR-32; IT Staff → admin users; unauthenticated → 401;
`mustChangePassword` user → 403), plus a bonus I-7 positive-path transcript
(claim → illegal transition 409 with permitted set).

The IT-Staff-→-admin-users scenario was originally captured as a
route-not-found 404 (before I-8 existed), with a note deferring re-capture.
I-8 (Administrator User Management) has since landed on this branch, and
the transcript was re-captured against the real routes: it now shows the
role-based 403 the scenario was always meant to demonstrate.

Capturing this transcript is also what surfaced SEC-01 above (the
`passwordHash` leak) — the transcript file documents the finding, the fix,
and a re-run of the same request confirming it.

## Screenshot / Visual Evidence Traceability

Captured via `e2e/lab-03/capture.ts` (see `sprint-plan.md` §3), one run per
merged feature Issue, re-run in full during I-9. Folders exactly as required:
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.
Each figure referenced in the submitted PDF corresponds to a specific AC or FR
from `specification.md`; the mapping is finalized in I-11 alongside the final
`reviewer.md`.

---

## Regression Baseline (recorded before any Lab 3 migration)

**Correction (2026-09-16):** the count below of Ticket 18 / Attachment 4,
originally captured during Phase 0, was taken against the wrong database. This
machine runs two independent PostgreSQL servers that both listen on port 5432
— a Docker container (`toktickit-db`, reachable only via `docker exec`) and a
real Postgres 16 instance inside a WSL Ubuntu distro (reachable via
`localhost:5432` from any host-side tool, including every `npx prisma`
command, `npm run dev`, and this session's own Node scripts, because Windows
routes `localhost` to the more specific `127.0.0.1`-bound listener). The
Docker container turned out to be a stale, unused artifact from initial
`docker-compose` setup (volume created 2026-08-12, ticket numbers randomly
generated, never touched since); the WSL instance is the real one — its
ticket numbers follow the sequential `TKT-2026-0001XX` scheme from the Lab 2
hardening fix, with timestamps through 2026-09-02 matching the actual session
history. The Phase 0 backup and this baseline table have been redone against
the WSL (real) database. `docker-compose.yml`'s `db` service now publishes
port 5433 instead of 5432 to prevent this ambiguity recurring; its internal
Docker-network traffic (`db:5432`, used by the `server` container) is
unaffected either way.

Captured 2026-09-16 against the corrected pre-Lab-3 database, backed up to
`artifacts/lab-03/db-backup-pre-lab3.sql`:

| Table | Row Count |
|---|---:|
| Category | 4 |
| RequesterUser | 5 |
| RelatedSystem | 7 |
| Ticket | 15 |
| Attachment | 5 |

**Note (I-6, 2026-09-17):** `staff-queue.api.test.ts` could not initially be
run end-to-end because the Docker `db` container had drifted back onto host
port 5432 (colliding with the real WSL-hosted Postgres, the same class of
issue first diagnosed during I-2 — see the row counts above), which made the
reachable `localhost:5432` connection land on an unrelated, unmigrated
database. Recreating the container restored the correct `5433` mapping from
`docker-compose.yml`, after which an orphaned, never-finished
`_prisma_migrations` bookkeeping row (`20260812121902_init`, predating the
current `0_init`–`4_add_comments_and_notes` sequence) was cleared with `npx
prisma migrate resolve --rolled-back` — a bookkeeping-only fix, no schema or
data change. All 99 server tests, including the 17 in
`staff-queue.api.test.ts`, then passed.

REGR-01 asserts these counts are unchanged after the full `0_init` →
`4_add_comments_and_notes` migration sequence, and that every `Ticket.requesterId`
still resolves to the same `User` row it referenced as a `RequesterUser`.
Verified manually during I-2 (all 15 tickets and 5 attachments preserved,
zero NULLs introduced by the enum conversion) and asserted automatically by
`server/tests/lab-03/migration-regression.api.test.ts`.
