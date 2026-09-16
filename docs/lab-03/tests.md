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
| UNIT-03 | Unit | BR-19, §6.5 | Status transition matrix — all legal edges | Every ✅ cell in §6.5 returns permitted=true | `server/tests/lab-03/status-transitions.unit.test.ts` | |
| UNIT-04 | Unit | BR-19, §6.5 | Status transition matrix — all illegal edges | Every non-✅ cell returns permitted=false with the correct permitted-set | `server/tests/lab-03/status-transitions.unit.test.ts` | |
| API-01 | API | AC-01 | Valid login | 200, authenticated cookie set, safe user object (no hash) | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-05, BR-06 | Invalid credentials | 401, generic message, identical for wrong password and unknown email | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | AC-06, BR-07 | Inactive account, correct password | 403, deactivation message | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | AC-07, BR-08 | Logout | 204, cookie cleared, subsequent protected call returns 401; calling logout twice still 204 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | FR-03 | GET /api/auth/me | 200 with role and mustChangePassword; 401 unauthenticated | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | AC-02, AC-14, BR-02, BR-10 | Change password (forced) | 200, mustChangePassword cleared; rejects reusing initial password; rejects mismatch | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-07 | API | AC-02, FR-04 | mustChangePassword lockout | Any non-allowlisted route returns 403 while true | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-08 | API | AC-04, BR-24 | Requester requests Internal Notes | 403, empty body, no note content leaked | `server/tests/lab-03/comments-notes.api.test.ts` | *(I-7 — Internal Notes endpoint does not exist until then)* |
| API-09 | API | AC-03, BR-03 | Client-supplied requesterId ignored | Authenticated identity determines ownership regardless of body/query override | `server/tests/lab-03/authorization.api.test.ts` | *(I-4 — Requester routes are not yet rewired to the session)* |
| API-10 | API | AC-17, BR-32 | Cross-requester ticket access | 404 (not 403), no existence confirmation | `server/tests/lab-03/authorization.api.test.ts` | *(I-4)* |
| API-11 | API | FR-07 | Unauthenticated access to any protected route | 401 across the route table | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-12 | API | §6 matrix | Full role × endpoint authorization grid | Prints and asserts the matrix in `specification.md` §6 in one run | `server/tests/lab-03/authorization.api.test.ts` | *(grows incrementally — full grid needs I-4/I-6/I-7/I-8 routes to exist; role-gate mechanism itself is covered now by API-21..23 below)* |
| AUTHZ-01 | API | §6 matrix | requireRole middleware — permitted/rejected role behavior | Permitted role passes through; other role → 403 FORBIDDEN; no auth → 401 | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-02 | Security | BR-07, FR-07 | Deactivation takes effect on next request, not at token expiry | A live session is rejected 403 the instant the account is deactivated | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-13 | API | AC-18 | Staff queue — search/filter/sort/pagination | Correct result sets per query; invalid param → 400 naming the field | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-14 | API | FR-14 | Staff queue — role restriction | Requester → 403; IT Staff/Admin → 200 | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-15 | API | AC-08, BR-13, BR-14 | Claim/reassign ownership | Owner set correctly; rejects an inactive or Requester-role ownerId | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-16 | API | BR-16 | Set IT Priority | Updates independently of Requested Priority; role-restricted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-17 | API | AC-09, BR-17, BR-19 | Status transition enforcement | Legal transition succeeds; illegal → 409 with permitted set; IN_PROGRESS blocked while unassigned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-18 | API | AC-10, BR-05 | Requester resolution signal | Sets flag + auto-comment; status unchanged; Requester cannot set Resolved/Closed directly | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-19 | API | BR-04, BR-21, BR-22, BR-23 | Public Comments CRUD (create/list only) | Append-only; author/timestamp server-set; rejects blank/oversize content | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-20 | API | BR-04, BR-21 | Internal Notes CRUD (create/list only) | Staff/Admin only; append-only; same validation as comments | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-21 | API | FR-20 | Admin user list — search/role filter | Correct filtering; non-Admin → 403 | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-22 | API | AC-11, BR-26 | Create user — duplicate email | 409, case-insensitive match, no user created | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-23 | API | FR-24 | Create user — invalid role | 400 | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-24 | API | FR-22 | Edit user — basic fields | Name/email/role/isActive update correctly | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-25 | API | AC-14, FR-23 | Set new initial password | mustChangePassword forced true; that user's next login requires change | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-26 | API | AC-12, BR-27 | Self-deactivation blocked | Admin cannot deactivate/demote own account | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-27 | API | AC-13, BR-28 | Last-Administrator protection | Deactivating/demoting the last active Admin rejected; a second active Admin may be deactivated | `server/tests/lab-03/users-admin.api.test.ts` | |
| REGR-01 | Migration/Regression | BR-30, BR-31, AC-16 | Row-count and FK integrity before/after migration | Category/RequesterUser→User/RelatedSystem/Ticket/Attachment counts unchanged; every requesterId still resolves | `server/tests/lab-03/migration-regression.api.test.ts` | |
| REGR-02 | Migration/Regression | FR-10 | All Lab 1/2 endpoints still function under cookie auth | Every Lab 2 API test passes after rewriting from `?requesterId=` to session auth | `server/tests/lab-03/migration-regression.api.test.ts` | |

## Client Tests — `client/tests/lab-03/`

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI Component | AC-01, AC-05 | Login form | Valid submit calls API and redirects; invalid shows generic error; busy state disables button | `client/tests/lab-03/Login.test.tsx` | |
| UI-02 | UI Component | AC-02, BR-09, BR-11 | Change Password form | Validates policy and confirmation client-side; submits and redirects on success | `client/tests/lab-03/ChangePassword.test.tsx` | |
| UI-03 | UI Component | FR-14 | Staff Queue rendering | Renders rows with correct badges; empty and no-results states render correctly | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-04 | UI Style | §1 (ui-spec) | Status/role badge colors | Correct token applied per status/role value | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-05 | Responsive | §9 (ui-spec) | Queue table → card collapse | Mobile viewport renders card layout, not the desktop table | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-06 | UI Component | FR-15, FR-16, FR-17 | Staff Ticket Detail controls | Claim/reassign/IT Priority/status controls call the correct endpoints | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-07 | UI Style | §7 (ui-spec) | Public Comment vs Internal Note panel styling | Distinct background/label rendered for each panel | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-08 | UI Component | FR-20, FR-21, FR-22 | User Management list/create/edit forms | Search/filter call correct query; create/edit submit correct payloads; inline validation renders | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-09 | UI Component | AC-12, AC-13 | Admin safety rules surfaced in UI | Self-deactivation and last-Admin attempts show an inline blocking message | `client/tests/lab-03/UserManagement.test.tsx` | |

## End-to-End Tests — `e2e/lab-03/` (Playwright)

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-07, AC-15 | Login → app → logout → blocked | Full session lifecycle; direct navigation to a protected route after logout redirects to `/login` | `e2e/lab-03/authentication.spec.ts` | |
| E2E-02 | E2E | AC-02 | Initial password login and change | Normal app opens only after a valid password change | `e2e/lab-03/authentication.spec.ts` | |
| E2E-03 | E2E | FR-14–FR-19 | Full staff workflow | Queue → open Ticket → claim → set IT Priority → change status → post comment → post note | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-04 | E2E | FR-20–FR-23 | Full admin workflow | Create user → set initial password → that user's forced change at next login | `e2e/lab-03/user-administration.spec.ts` | |

---

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

REGR-01 asserts these counts are unchanged after the full `0_init` →
`4_add_comments_and_notes` migration sequence, and that every `Ticket.requesterId`
still resolves to the same `User` row it referenced as a `RequesterUser`.
Verified manually during I-2 (all 15 tickets and 5 attachments preserved,
zero NULLs introduced by the enum conversion) and asserted automatically by
`server/tests/lab-03/migration-regression.api.test.ts`.
