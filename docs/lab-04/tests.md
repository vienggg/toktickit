# Lab 4 Test Plan and Traceability

Written **before** implementation (Test DD / TDD). Each test is created failing first, then the code is written to make it pass. The **Final** column is `Planned` until the test runs green; it is updated to `Pass` (with the run on `main`) in I-9. Requirement references point to `specification.md` (AC/BR/FR).

## Coverage Levels Required (handout §10)
Unit · API/Integration · UI Component · UI Style · Responsive · Security/Authorization · Workflow · Migration/Regression · Performance-smoke · End-to-End.

## Regression Baseline (recorded 2026-11-01 on `main` @ `78ed025`, before any Lab 4 change)

| Suite | Result |
|---|---|
| `server` (`npm test`, Vitest + Supertest, `lab-01`…`lab-03`) | 16 files, **251 passed** |
| `client` (`npm test`, Vitest + RTL, `lab-01`…`lab-03`) | 12 files, **70 passed** |
| Database before migration | users 451 · tickets 1031 · attachments 128 · public comments 229 · internal notes 144 (backup taken with `pg_dump`, 8 tables) |

Both suites must remain green (unchanged in intent) at every PR (AC-30).

---

## Server Tests — `server/tests/lab-04/`

| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-11, AC-08 | Action status matrix, every legal and illegal edge | Legal edges allowed; terminal states have no exits; `CANCELLED` is not a valid initial status | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-09, BR-08, AC-06 | Field rules: follow-up note and completed result validators | Rejects missing/blank note when follow-up true and blank result when completed; trims; length limits | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-03 | Unit | BR-19, AC-13, AC-14 | `getResolutionBlockers()` pure function | Returns every blocker combination (`NO_OWNER`, `NO_COMPLETED_ACTION`, `OPEN_ACTIONS`); empty when satisfied | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-17–BR-22, AC-20 | Lab 3 matrix + Lab 4 gates in `getPermittedTransitionsForTicket` | Matrix cells unchanged; `IN_PROGRESS`/`RESOLVED` hidden without owner; `RESOLVED` hidden while blockers exist | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-05 | Unit | BR-06 | `actionAt` bounds | Future > 5 min rejected; before Ticket creation rejected; default now | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-06 | Unit | BR-30, AC-26 | Bangkok window helper | Boundary at 00:00 Asia/Bangkok six days ago; DST-free; UTC inputs convert correctly | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| API-01 | API | AC-01, BR-05 | Create valid Action Taken | 201, under the correct Ticket, `createdBy` = caller, `assignee` = caller by default | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-01, BR-05 | Create with explicit active assignee | 201, assignee as requested, `createdBy` still caller; client-sent `createdById` ignored | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-07, BR-02 | Staff B records an action on staff A's Ticket | 201; Ticket `ownerId` unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-05, BR-05 | Inactive assignee; Requester-role assignee; unknown id | 422 `INVALID_ASSIGNEE` each; zero rows written | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-06, BR-09 | Follow-up required without note; with whitespace note | 400 naming `followUpNote`; with a note 201; false clears note | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | AC-06, BR-08 | Create/patch to `COMPLETED` without result | 400 naming `result` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | BR-07, BR-10 | Description blank / >2000; attachment notes >1000; `CANCELLED` initial status | 400 each with field name | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-03, BR-03 | Requester POST and PATCH | 403, no row written / changed | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-09 | API | AC-04, BR-04 | Requester GET own vs other Requester's Ticket | 200 with all fields (no `version`) vs 404 empty | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-10 | API | AC-31 | Unauthenticated GET/POST/PATCH actions, history, both dashboards | 401 each | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-11 | API | AC-08, BR-11 | PATCH legal status moves (`PLANNED→IN_PROGRESS→COMPLETED`, `→CANCELLED`) | 200; `completedAt` set on complete; version +1; `updatedBy` set | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-12 | API | AC-08, BR-12 | Illegal action move; edit of a terminal action | 409 `ILLEGAL_ACTION_TRANSITION` with `permitted`; 409 `ACTION_LOCKED` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-13 | API | AC-09, BR-25 | Two staff edit the same action; second uses old `expectedVersion` | 409 `STALE_UPDATE` with `current`; first edit intact | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-14 | API | AC-10, BR-26 | POST twice with same `clientRequestId` (sequential and concurrent) | One row; 201 then 200 with same id | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-15 | API | AC-11, BR-14 | POST/PATCH on `RESOLVED`, `CLOSED`, `CANCELLED` Tickets; works again after reopen | 409 `TICKET_LOCKED`; then 201 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-16 | API | AC-12 | List ordering and stability | Same order across repeated calls; ties on `actionAt` break by `id` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-17 | API | BR-01, BR-13 | Wrong-ticket `actionId`; `DELETE` route | 404 (action of another Ticket); `DELETE` 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-18 | API | AC-06 | Database CHECK constraints (raw insert via Prisma `$executeRaw`) | Constraint violation for follow-up without note and completed without result | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| WF-01 | Workflow | AC-13, BR-19 | Resolve with no owner / no completed action / open action | 409 `RESOLUTION_BLOCKED`, `blockers` lists every applicable code; status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-02 | Workflow | AC-14, BR-19, BR-22, BR-24 | Resolve when gate satisfied | 200, `resolvedAt` set, exactly one history row, version +1 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-03 | Workflow | AC-13 | Race: create an open action while resolve runs | Either resolve succeeds before the action exists, or is blocked; never resolved with an open action | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-04 | Workflow | AC-15, BR-16, BR-23 | Requester PATCH status; Requester resolution signal | 403 / flag only; status and history unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-05 | Workflow | AC-16, BR-20 | Cancel without reason; with open action; valid cancel; any move after | 400; 409 `OPEN_ACTIONS_BLOCK_CANCEL`; 200; 409 `ILLEGAL_TRANSITION` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-06 | Workflow | AC-17, BR-21 | Reopen from `RESOLVED` and `CLOSED` with/without reason | 400 without; 200 with; `resolvedAt`/`closedAt` cleared | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-07 | Workflow | AC-20, BR-17 | One request per matrix cell (all 64) | ✅ cells succeed (given gates met); others 409 `ILLEGAL_TRANSITION` with permitted set | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-08 | Workflow | AC-18, BR-24 | History after several transitions; Requester vs staff view; write methods | Ordered `createdAt`,`id`; reasons only for staff; POST/PATCH/DELETE → 404 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-09 | Workflow | AC-19, BR-25 | Stale `expectedVersion` on status, owner and IT priority | 409 `STALE_UPDATE` with `current` each; nothing changed; omitted `expectedVersion` still works (Lab 3 compat) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-10 | Workflow | AC-33, BR-24 | Same transition submitted twice quickly | Second gets 409 (`ILLEGAL_TRANSITION` or `STALE_UPDATE`); exactly one history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-11 | Workflow | AC-21 | `GET /api/staff/tickets/:id` fields | `permittedStatusTransitions`, `resolutionBlockers`, `actionsSummary`, `version` consistent with PATCH outcomes | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| DASH-01 | API | AC-02, BR-28 | Requester dashboard scoping | Counts and lists include only the caller's Tickets even with `?requesterId=` of another user | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-02 | API | AC-22, BR-27 | Requester metrics vs direct Prisma counts | Each of the 4 counts equals the direct query on seeded data | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-03 | API | AC-24, BR-32 | Requester with no Tickets | All counts 0, both lists `[]`, hrefs present | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-04 | API | AC-26, BR-30 | Recently resolved window | Ticket resolved just inside Bangkok day −6 included, just outside excluded; max 5; ordering | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-05 | API | AC-23 | Staff/Admin call Requester dashboard; Requester calls staff dashboard | 403 | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-06 | API | AC-22, BR-33, BR-34, BR-35 | Staff metrics vs direct Prisma/SQL (unassigned, my owned, my open actions, pending follow-ups, by status, by priority, waiting) | Every number equals its direct query on seeded data | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-07 | API | AC-22 | Drill-down parity | For each `href` with a filter, `GET /api/staff/tickets` (or `/api/tickets`) with that query returns `total` equal to the card count | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-08 | API | AC-24 | Idle staff user (no owned tickets/actions) | Owned/actions/follow-ups 0; org-wide counts unaffected; lists as defined | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-09 | API | AC-25, BR-37 | Administrator vs IT Staff payload | `userCounts` only for Administrator; counts equal `User` table groupings | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-10 | API | BR-36 | Attention list rules and order | Includes urgent/high and requester-signalled active Tickets only; max 5; severity then recency | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-11 | API | AC-22 | New filters: `status=ACTIVE`, `followUp=true`, invalid `followUp` | Correct result sets; 400 for `followUp=maybe` on staff queue | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| PERF-01 | Performance-smoke | AC-32 | Both dashboard endpoints on seeded DB (1000+ tickets) | Each < 500 ms median of 5 calls | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| MIG-01 | Migration | AC-27, BR-38 | Row counts before/after migration for every table | Identical counts (users 451, tickets 1031, attachments 128, comments 229, notes 144 on the rehearsal copy) | `server/tests/lab-04/migration-regression.api.test.ts` | Planned |
| MIG-02 | Migration | AC-27, BR-39 | Legacy Tickets after migration | Readable via Requester and staff APIs; zero actions; empty history; owners/requesters unchanged | `server/tests/lab-04/migration-regression.api.test.ts` | Planned |
| MIG-03 | Migration | BR-40 | `resolvedAt`/`closedAt` backfill | Set for legacy `RESOLVED`/`CLOSED`, null otherwise | `server/tests/lab-04/migration-regression.api.test.ts` | Planned |
| MIG-04 | Migration | AC-27 | Seed run twice | Second run adds no rows; counts identical | `server/tests/lab-04/migration-regression.api.test.ts` | Planned |
| MIG-05 | Migration | AC-27 | Migration SQL review | File contains no `DROP`; rollback rehearsal (restore dump + `migrate resolve --rolled-back`) recorded | `server/tests/lab-04/migration-regression.api.test.ts` (SQL text check) + manual log in `artifacts/lab-04/` | Planned |
| REG-01 | Regression | AC-30 | Lab 1–3 server suites | All 251 baseline tests pass unchanged in intent | `server/tests/lab-01/`, `lab-02/`, `lab-03/` | Planned |

## Client Tests — `client/tests/lab-04/`

| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI component | AC-22, FR-15 | Staff dashboard renders every card, strip and list from API data | Labels, values, hrefs match payload; admin-only Users strip only for Administrator | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | UI component | AC-24, FR-17 | Staff dashboard loading, empty, forbidden and safe-failure states | Skeleton with `aria-busy`; per-card empty text; forbidden message; retry alert without raw error | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-03 | UI component | FR-17 | Cards and rows are links to the documented destinations; "My Open Actions" card focuses its list | `href` values and focus move | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-04 | UI component | AC-02, FR-14 | Requester dashboard cards, lists and quick actions | Values/links from payload; no search/filter UI | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-05 | UI component | AC-24 | Requester dashboard empty/loading/error | Empty messages, Create Ticket link, retry | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-06 | UI component | AC-28, FR-01 | Actions Taken list: table/cards content, empty state, locked notice | All fields shown; "No actions recorded yet."; Add hidden when locked | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-07 | UI component | AC-28, AC-06 | Create form behaviour | Follow-up Note appears and becomes required on check; Result required for Completed; inline errors with `aria-describedby`; first error focused | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-08 | UI component | AC-28, FR-20 | Form data preserved after failed save (network, 400, 422, 409) | All typed values remain; alert shown; assignee error under Assignee | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-09 | UI component | AC-33, FR-19 | Double click on Save | One POST sent; button disabled with "Saving…"; same `clientRequestId` on retry | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-10 | UI component | AC-04 | Requester variant | No Add/Edit controls, no version/assignee editing | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-11 | UI component | AC-21, FR-08 | Status control options | Only `permittedStatusTransitions`; disabled Resolve with blocker messages; Cancel/Reopen require reason | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-12 | UI component | AC-21, FR-13 | Successful transition | Summary badge/permitted list refresh; live region announces change | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-13 | UI component | AC-19 | Stale/conflict response | Conflict banner with Reload latest; typed reason kept | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-14 | UI component | AC-18 | History timeline | Order, badges, reason hidden for Requester, empty text | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-15 | UI component | FR-18, AC-30 | Navigation per role, `aria-current`, landing redirects, Requester URL routes | Links per §2 of `ui-spec.md`; direct `/tickets?status=…` applies the filter | `client/tests/lab-04/Navigation.test.tsx` | Planned |
| REG-02 | Regression | AC-30 | Lab 1–3 client suites | All 70 baseline tests pass unchanged in intent | `client/tests/lab-01/`, `lab-02/`, `lab-03/` | Planned |

## End-to-End, Style, Responsive and Accessibility — `e2e/lab-04/` (Playwright)

| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-07, AC-28 | Staff A owns a Ticket; staff B adds an action; requester sees it read-only | Action shows B as Performed by; owner still A; requester has no edit controls | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-05, AC-06, AC-08 | Validation and assignment through the UI: missing follow-up note, inactive assignee, complete, cancel | Inline errors; assignee error; status badges update | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-09, AC-19 | Two browser contexts edit the same action and status | Second saves get a conflict banner; Reload latest works; no overwrite | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-13, AC-14, AC-18, AC-21 | Lifecycle: New → Open → In Progress → blocked Resolve → complete action → Resolved → Closed; timeline | Blockers explained, then resolve succeeds; history ordered | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-05 | E2E | AC-15, AC-16, AC-17 | Requester signals resolved (status unchanged); staff cancel and reopen with reasons | Status only changes by staff; reasons required | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-06 | E2E | AC-22, AC-24 | Staff dashboard cards, lists, empty user, drill-down click lands on filtered queue | Counts equal the filtered list totals | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-07 | E2E | AC-02, AC-23 | Requester dashboard drill-down; staff URL as Requester | Own data only; redirect/forbidden for staff routes | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-08 | E2E | AC-30 | Regression tour per role: login, My Tickets, detail, attachment, public comment, staff queue/detail, internal note, user management, logout + blocked direct access | All screens reachable by permitted roles only | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-09 | E2E | AC-33 | Console error sweep and double-click on create action/status | No `console.error`; single change applied | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| STYLE-01 | UI style | AC-29, V-08, V-11 | Badge text/symbol present; tokens used; no placeholder text | Assertions on DOM text and computed styles | `e2e/lab-04/visual-inspection.spec.ts` | Planned |
| RESP-01 | Responsive | AC-29, V-01–V-04 | Every Lab 4 screen at 1280, 768, 375 | `scrollWidth ≤ clientWidth`; table↔cards switch; no clipped text (screenshots saved) | `e2e/lab-04/visual-inspection.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-29, V-05–V-07, V-12 | Keyboard walk-through and axe-core scan of dashboards, actions form, status control | No critical/serious violations; focus visible; labelled controls | `e2e/lab-04/visual-inspection.spec.ts` | Planned |
| REG-03 | Regression | AC-30 | Lab 3 Playwright specs | All pass unchanged in intent | `e2e/lab-03/*.spec.ts` | Planned |

---

## Acceptance-Criterion Traceability

| AC | Tests |
|---|---|
| AC-01 | API-01, API-02, E2E-01 |
| AC-02 | DASH-01, UI-04, E2E-07 |
| AC-03 | API-08 |
| AC-04 | API-09, UI-10 |
| AC-05 | API-04, E2E-02 |
| AC-06 | UNIT-02, API-05, API-06, API-18, UI-07, E2E-02 |
| AC-07 | API-03, E2E-01 |
| AC-08 | UNIT-01, API-11, API-12, E2E-02 |
| AC-09 | API-13, E2E-03 |
| AC-10 | API-14 |
| AC-11 | API-15 |
| AC-12 | API-16 |
| AC-13 | UNIT-03, WF-01, WF-03, E2E-04 |
| AC-14 | UNIT-03, WF-02, E2E-04 |
| AC-15 | WF-04, E2E-05 |
| AC-16 | WF-05, E2E-05 |
| AC-17 | WF-06, E2E-05 |
| AC-18 | WF-08, UI-14, E2E-04 |
| AC-19 | WF-09, UI-13, E2E-03 |
| AC-20 | UNIT-04, WF-07 |
| AC-21 | WF-11, UI-11, UI-12, E2E-04 |
| AC-22 | DASH-02, DASH-06, DASH-07, DASH-11, UI-01, E2E-06 |
| AC-23 | DASH-05, E2E-07 |
| AC-24 | DASH-03, DASH-08, UI-02, UI-05, E2E-06 |
| AC-25 | DASH-09, UI-01 |
| AC-26 | UNIT-06, DASH-04 |
| AC-27 | MIG-01–MIG-05 |
| AC-28 | UI-06, UI-07, UI-08, E2E-01 |
| AC-29 | STYLE-01, RESP-01, A11Y-01 |
| AC-30 | REG-01, REG-02, REG-03, UI-15, E2E-08 |
| AC-31 | API-10 |
| AC-32 | PERF-01 |
| AC-33 | WF-10, UI-09, E2E-09 |

## Evidence plan (for the final report)
* Passing output of `npm test` (server and client) and `npx playwright test` **from `main`** after the release merge (I-8), pasted into the report.
* SQL transcripts for ≥ 5 dashboard metrics next to the matching screenshot (`artifacts/lab-04/screenshots/staff-dashboard/`).
* Migration evidence: before/after row counts and the rollback rehearsal log.
* Screenshots by area: `staff-dashboard/`, `requester-dashboard/`, `actions-taken/` (plus workflow and regression shots), each at 1280/768/375 px.
