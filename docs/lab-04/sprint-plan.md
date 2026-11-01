# Sprint 4 Execution Plan — TokTickIT Actions Taken, Dashboards, and Final Regression

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents — Semester 1/2026
**Author:** Garunyapas Danpitakkul (Vieng) — 67070503404 — [@vienggg](https://github.com/vienggg)
**Peer Reviewer:** _to confirm_ (Lab 3 PRs were reviewed and merged by [@projectnewy](https://github.com/projectnewy))
**Target:** 60 / 60
**Starting point:** `main` @ `78ed025` (tag `lab3-release`), working tree clean.
**Revision:** v1 — 2026-10-31

> **Status:** historical working plan. Where it differs from `specification.md`, `api-spec.md` or `ui-spec.md`, **those documents are the source of truth** (e.g. drill-down hrefs use `ownerId=` and `status=ACTIVE`; the dashboard performance smoke threshold is 500 ms).
>
> This is a working plan, not a graded artifact. The graded artifacts are
> `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`,
> `ai-use.md`, the code, and the single submitted PDF (labsheet §14).

---

## 0. The Laws of This Sprint (carried over from Lab 3, still true)

1. **The reviewer is the critical path.** 9 PRs, author never merges their own.
   Agree review windows before coding starts.
2. **Evidence is captured with each feature, never after.** 30 of 60 points are
   screenshots and test output (Parts 5–9). Each feature PR ships its own
   screenshots and Playwright spec.
3. **The grader reads the PDF, not the repo.** Every required `.md` is rendered
   inside the PDF, under headings "Answer Part 1" … "Answer Part 9".
4. **New for Lab 4 — grade against the rubric, not just the prose.** The rubric
   (§14) asks for things the handout body never names. See §1.

---

## 1. Hidden Requirements — what the rubric grades that the handout body doesn't spell out

| Rubric source | Phrase | What it forces into the design |
|---|---|---|
| Part 6 | "create, **assign**, edit" | An Action Taken has an **assignee** (defaults to the creator), not only an auto "Performed by". |
| Part 6 | "**status transition, complete, cancel**" | An Action Taken has its own **status**: `PLANNED → IN_PROGRESS → COMPLETED`, or `→ CANCELLED`. |
| Part 6 | "**inactive-assignee rejection**" | Server rejects an assignee who is inactive or not IT Staff/Admin. |
| Part 6 | "different Actions Taken on one Ticket" | Seed + screenshot of one Ticket with ≥3 actions by ≥2 different staff. |
| Part 5 | "**current-user Actions Taken**" | Staff dashboard card + list: actions assigned to me that are still open. |
| Part 5 | "selected metrics **match database queries**" | A psql/SQL transcript per key metric, shown next to the dashboard screenshot. |
| Part 7 | "**stable ordering, append-only**" | New append-only `TicketStatusHistory` table, ordered by `(createdAt, id)`; shown as a timeline. |
| Part 2 | "spec existed **before** main implementation PRs" | I-1 (spec PR) merged first; screenshot of its merge timestamp vs later PRs. |
| Part 3 | "passing test output **from main**" | Final test run is on `main` after release merge, not on a feature branch. |
| AC-01 (handout) | "authenticated creator **and approved assignee**" | Confirms the assignee field above. |
| §6.1 | stale updates | Optimistic concurrency (`version` column + `expectedVersion`) → `409 STALE_UPDATE`. |
| §8.5 | duplicate clicks / network retry | Client disables while pending **and** server idempotency via `clientRequestId`. |
| §4.6 | drill-down | Requester screens need real URLs (`/tickets?status=…`); today they are tab state. |

---

## 2. Locked Decisions (go into specification.md §11 "Assumptions and Decisions")

| # | Decision | Choice | Why |
|---|---|---|---|
| D-01 | Action Taken model | New table `ActionTaken` (child of `Ticket`, FK `onDelete: Restrict`) | BR-01: exactly one Ticket. Restrict, not Cascade — work history must never vanish silently. |
| D-02 | Action status | Enum `ActionStatus { PLANNED, IN_PROGRESS, COMPLETED, CANCELLED }`; `COMPLETED`/`CANCELLED` terminal | Rubric Part 6. Same enum-not-string reasoning as Lab 3 D-05. |
| D-03 | Performed by vs Assignee | `createdById` (auto from session, immutable) + `assigneeId` (active IT Staff/Admin, defaults to creator) | Handout says "Performed by (auto)"; rubric + AC-01 say "assign". Both are kept, displayed as "Recorded by" and "Performed by". |
| D-04 | Action date/time | `actionAt` (user-editable, defaults to now, may not be > now + 5 min, may not be before Ticket `createdAt`) + `createdAt`/`updatedAt` system stamps | "Action Date/Time" is when the work happened, not when it was typed. Stored UTC, displayed Asia/Bangkok. |
| D-05 | Follow-up | `followUpRequired Boolean`, `followUpNote String?` — DB `CHECK (NOT followUpRequired OR length(trim(followUpNote)) > 0)` | Rule enforced in DB, API, and UI (defense in depth); the CHECK is DB-design justification #1. |
| D-06 | Attachment Notes | Free text `attachmentNotes String?` (≤1000 chars) — a pointer to where evidence lives, **not** a file upload | Handout: "what file to look for". Avoids a second upload pipeline (out of scope). |
| D-07 | Optimistic concurrency | `version Int @default(1)` on `Ticket` and `ActionTaken`; every staff write sends `expectedVersion`; mismatch → `409 STALE_UPDATE` with the current record | §6.1. Integer version beats `updatedAt` comparison (no clock/precision issues). DB-design justification #2. |
| D-08 | Idempotent create | `clientRequestId String?` with `@@unique([ticketId, clientRequestId])`; a repeat POST returns the existing row with `200` instead of `201` | §8.5 network-retry case. Client generates a UUID per form open. |
| D-09 | Audit trail | Append-only `TicketStatusHistory(ticketId, fromStatus, toStatus, changedById, reason?, createdAt)`; written in the same transaction as the status change; no update/delete endpoint | Rubric Part 7. Ordered by `(createdAt, id)` for stable ordering. |
| D-10 | Resolution gate | `→ RESOLVED` requires: owner set **and** ≥1 `COMPLETED` action **and** 0 actions `PLANNED`/`IN_PROGRESS`. Otherwise `409 RESOLUTION_BLOCKED` listing the reasons | Handout §4.5: "backend must enforce the resolution rule even when a client bypasses the screen". |
| D-11 | Cancel gate | `→ CANCELLED` requires a `reason` (stored in history) and 0 open actions (user cancels them first) | Explicit and testable; no hidden cascade. |
| D-12 | Closed/Cancelled tickets | Actions become read-only (`409 TICKET_LOCKED`); Reopen unlocks | Keeps work history consistent with the final status. |
| D-13 | Requester resolution signal | Unchanged from Lab 3 (flag + public comment); now also shown as a "Requester says resolved" badge on the staff dashboard attention list | §4.5: advisory only. |
| D-14 | Dashboards | Two endpoints computed server-side with `count`/`groupBy`; return counts + max 5 recent rows; never full collections | §6.2. |
| D-15 | Time zone | All "today"/"last 7 days" boundaries computed in **Asia/Bangkok** on the server; API returns ISO UTC | §6.2 asks for it explicitly. |
| D-16 | Requester routing | Replace Requester tab-state workspace with routes `/dashboard`, `/tickets`, `/tickets/new`, `/tickets/:id`; `/tickets` reads `?status=` | Drill-down needs addressable URLs; also removes an inconsistency left from Lab 2. |
| D-17 | Landing page | All roles land on `/dashboard` after login | Dashboards are "the starting point" (§8.1). |
| D-18 | Legacy data | No synthetic history rows; legacy tickets show "History recorded from Lab 4 onward". Gate D-10 applies only at transition time, so already-Resolved/Closed legacy tickets are untouched | Honest data; documented in spec §7 per §5.2. |

---

## 3. Data Model & Migration (`5_add_actions_taken_and_history`)

```prisma
enum ActionStatus { PLANNED IN_PROGRESS COMPLETED CANCELLED }

model ActionTaken {
  id               Int          @id @default(autoincrement())
  ticketId         Int
  actionAt         DateTime
  description      String       // 1–2000
  result           String?      // required when status = COMPLETED
  status           ActionStatus @default(PLANNED)
  followUpRequired Boolean      @default(false)
  followUpNote     String?
  attachmentNotes  String?
  createdById      Int
  assigneeId       Int
  updatedById      Int?
  clientRequestId  String?
  version          Int          @default(1)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  completedAt      DateTime?

  ticket    Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  createdBy User   @relation("ActionCreatedBy", fields: [createdById], references: [id])
  assignee  User   @relation("ActionAssignee",  fields: [assigneeId],  references: [id])
  updatedBy User?  @relation("ActionUpdatedBy", fields: [updatedById], references: [id])

  @@unique([ticketId, clientRequestId])
  @@index([ticketId, actionAt, id])
  @@index([assigneeId, status])
}

model TicketStatusHistory {
  id          Int           @id @default(autoincrement())
  ticketId    Int
  fromStatus  TicketStatus
  toStatus    TicketStatus
  changedById Int
  reason      String?
  createdAt   DateTime      @default(now())
  @@index([ticketId, createdAt, id])
}

// Ticket: + version Int @default(1), + resolvedAt DateTime?, + closedAt DateTime?
```

Procedure (same discipline as Lab 3 §4):
1. `pg_dump` → `artifacts/lab-04/db-backup-pre-lab4.sql` (git-ignored if large; record checksum).
2. `prisma migrate dev --create-only`, hand-add the follow-up `CHECK` constraint, confirm **no DROP** in SQL.
3. Backfill in SQL: `Ticket.resolvedAt/closedAt = updatedAt` where status already RESOLVED/CLOSED (used by "recently resolved"; flagged as approximate in the spec).
4. Rehearse on a restored dump; capture before/after row counts for every table → `tests.md` (MIG tests).
5. Rollback = restore dump + `prisma migrate resolve --rolled-back 5_…`; written down and rehearsed once.

**Seed additions (idempotent, keyed by ticketNumber + clientRequestId):** tickets with 0, 1, and 4 actions; one ticket with actions by 2 different staff and an owner who is a third person; actions in every `ActionStatus`; at least one follow-up-required action; one inactive IT Staff (for rejection demo); one Requester with zero tickets (for the empty dashboard); status history rows for seeded transitions.

---

## 4. Ticket Status Matrix (refined)

Lab 3 matrix stays; Lab 4 adds role columns and gates.

| From → To | Allowed roles | Extra gate |
|---|---|---|
| NEW → OPEN / IN_PROGRESS | Staff, Admin | IN_PROGRESS needs owner (BR-17 from Lab 3) |
| any active → WAITING_FOR_REQUESTER | Staff, Admin | none (spec BR-18: owner needed only for IN_PROGRESS and RESOLVED) |
| active → RESOLVED | Staff, Admin | **D-10 resolution gate** |
| RESOLVED → CLOSED | Staff, Admin | none (Requester cannot close) |
| RESOLVED / CLOSED → REOPENED | Staff, Admin | reason required |
| active → CANCELLED | Staff, Admin | reason required + **D-11** |
| CANCELLED → * | nobody | terminal |
| Any transition | Requester | **never** — 403 (signal endpoint only) |

"Active" = NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED.
`GET /api/staff/tickets/:id` keeps returning `permittedStatusTransitions`, now with gates applied, plus `resolutionBlockers[]` so the UI can explain why Resolve is disabled.

---

## 5. Dashboard Metric Definitions (exact — goes into spec BR section and api-spec)

**Requester** (`GET /api/dashboard/requester`, always scoped to session user):

| Metric | Query | Drill-down |
|---|---|---|
| My Open Tickets | requesterId = me AND status ∈ active | `/tickets?status=active` |
| Waiting for Me | status = WAITING_FOR_REQUESTER | `/tickets?status=WAITING_FOR_REQUESTER` |
| Resolved — please confirm | status = RESOLVED | `/tickets?status=RESOLVED` |
| Closed | status = CLOSED | `/tickets?status=CLOSED` |
| Recently Updated (list, 5) | order by updatedAt desc, id desc | `/tickets/:id` |
| Recently Resolved (list, 5) | resolvedAt within last 7 Bangkok days | `/tickets/:id` |

**IT Staff / Admin** (`GET /api/dashboard/staff`):

| Metric | Query | Drill-down |
|---|---|---|
| Unassigned | ownerId null AND active | `/staff/queue?ownerId=unassigned&status=ACTIVE` |
| My Owned Tickets | ownerId = me AND active | `/staff/queue?ownerId=<my id>&status=ACTIVE` |
| My Open Actions | ActionTaken.assigneeId = me AND status ∈ {PLANNED, IN_PROGRESS} | list → `/staff/tickets/:id#actions` |
| Follow-ups Pending | followUpRequired AND ticket active | `/staff/queue?followUp=true` |
| By Status (8 counts) | groupBy status | `/staff/queue?status=X` |
| By IT Priority (active only) | groupBy itPriority | `/staff/queue?itPriority=X` |
| Urgent / Attention (list, 5) | active AND (itPriority ∈ {URGENT,HIGH} OR requesterResolvedAt not null) | `/staff/tickets/:id` |
| Recently Updated (list, 5) | order by updatedAt desc | `/staff/tickets/:id` |

**Admin extra:** user counts by role and active/inactive → `/admin/users?role=X`.

Empty behavior: every count returns `0` (never missing); every list returns `[]`; UI shows a per-card empty message, not a blank card. Staff queue may need new filters `owner=me|unassigned` and `followUp=true` — check in I-5 and add with tests if missing.

---

## 6. API Increment (detailed in api-spec.md)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/api/tickets/:id/actions` | Requester (own, read-only view), Staff, Admin | Ordered `actionAt, id`. Requester view omits `clientRequestId`, `version`. |
| POST | `/api/staff/tickets/:id/actions` | Staff, Admin | 201 / 200 (idempotent replay) / 400 / 404 / 409 TICKET_LOCKED / 422 INVALID_ASSIGNEE |
| PATCH | `/api/staff/tickets/:id/actions/:actionId` | Staff, Admin | Requires `expectedVersion`; edits fields + status transition; 409 STALE_UPDATE / ILLEGAL_ACTION_TRANSITION |
| GET | `/api/tickets/:id/history` | Requester (own), Staff, Admin | Append-only timeline |
| PATCH | `/api/staff/tickets/:id/status` | Staff, Admin | **Changed:** accepts `expectedVersion`, `reason`; new 409 codes RESOLUTION_BLOCKED, STALE_UPDATE |
| PATCH | `/api/staff/tickets/:id/owner`, `/it-priority` | Staff, Admin | **Changed:** honor `expectedVersion` when sent (client always sends) |
| GET | `/api/dashboard/requester` | Requester | 403 for others |
| GET | `/api/dashboard/staff` | Staff, Admin | 403 for Requester; Admin gets `userCounts` |

No delete endpoint for actions or history (append-only; cancel instead of delete).
Error shape stays `{ error: { code, message, details? } }` from Lab 3.

---

## 7. UI Increment (detailed in ui-spec.md)

- **Navbar:** Dashboard link for every role, active-page indicator; remove leftovers (footer "MVP" text, any dev-only controls).
- **Requester Dashboard:** 4 metric cards (each a link), Recently Updated list, Recently Resolved list, Quick Actions (Create Ticket, My Tickets). Mirrors handout mock-up page 6.
- **Staff Dashboard:** 5 metric cards (Unassigned, My Owned, My Open Actions, Follow-ups, Waiting for Requester), status + priority strips, Urgent/Attention list, My Open Actions list, Recently Updated, Refresh button. Mirrors mock-up page 5.
- **Admin:** Staff dashboard + user-count strip.
- **Staff Ticket Detail → "Actions Taken" section:** table on desktop / stacked cards on mobile; "Add Action" opens inline form (not a modal — avoids focus-trap risk); row → view mode → Edit; status buttons only for legal action transitions; follow-up note appears and becomes required when the checkbox is ticked; stale-update banner with "Reload latest" that keeps the user's typed values.
- **Ticket status control:** only permitted transitions; disabled Resolve shows blocker list; reason dialog for Cancel/Reopen; summary badge refreshes on success.
- **Status History timeline** on both staff and requester detail views.
- **Requester Ticket Detail:** read-only Actions Taken list (no internal notes, ever).
- States per screen: loading, empty, no-results, forbidden, not-found, conflict, safe failure — all reuse Lab 3 components.

---

## 8. Issue Decomposition

`feature/*` → `lab4-staging` → `main` (release PR) → tag `lab4-release`.
One active issue at a time. Reviewer merges every PR. Each feature PR includes its own tests, screenshots, a `reviewer.md` entry and an `ai-use.md` entry.

| # | Issue | Branch | Delivers | Rubric |
|---|---|---|---|---|
| I-1 | Sprint 4 engineering contract | `docs/lab4-spec-and-test-plan` | specification / api-spec / ui-spec / tests `.md`, this plan | 2, 3 |
| I-2 | Actions Taken data foundation | `feature/lab4-actions-data` | Migration 5, backup + rehearsal, seed, MIG tests | 2, 3 |
| I-3 | Actions Taken API + Ticket workflow | `feature/lab4-actions-and-workflow-api` | GET/POST/PATCH actions, authz, assignee rule, idempotency, versioning; resolution/cancel gates D-10/D-11, history writes, stale-update on Lab 3 endpoints; `actions-taken.api.test.ts`, `ticket-workflow.api.test.ts` | 6, 7 |
| I-4 | Actions Taken + workflow UI | `feature/lab4-actions-ui` | Staff detail section, requester read-only list, status control, timeline, `ActionsTaken.test.tsx`, `TicketWorkflow.test.tsx`, e2e `actions-taken-flow`, `ticket-resolution` | 6, 7 |
| I-5 | Role dashboards (API + UI + routing) | `feature/lab4-dashboards` | Both dashboard endpoints, queue filter additions, SQL cross-check transcripts, Requester routes (D-16), both dashboard screens, nav, API + component tests, e2e `dashboards.spec.ts` | 5, 8 |
| I-6 | Final hardening & regression | `feature/lab4-hardening` | Duplicate-click audit, form-data preservation, console-error sweep, placeholder removal, README update, full Labs 1–3 regression run | 8, 9 |
| I-7 | Responsive, a11y, visual inspection | `feature/lab4-visual-a11y` | Screenshots ×3 viewports for every Lab 4 screen, completed checklist in ui-spec | 9 |
| I-8 | Release integration | `lab4-staging` → `main` | Release PR, tag `lab4-release`, final test output from `main` | 1, 3 |
| I-9 | Final report evidence | `docs/lab4-report-final` | Final reviewer.md / tests.md status, Kanban screenshot, PDF | 1–9 |

Order reasoning: I-1 must merge before I-3 starts (Part 2 evidence). I-4 depends on I-3. I-5 can run before I-4 if the reviewer stalls on UI. I-3 and I-5 are the two large PRs; keep each focused on one concern in its commits so review stays tractable.

---

## 9. Phase 0 — before any code

| Step | Action |
|---|---|
| 0.1 | Confirm reviewer + review windows; record in `reviewer.md` §3. |
| 0.2 | Create `lab4-staging` from `main` and push. |
| 0.3 | Run full baseline: server, client, Playwright Lab 3 suites. Record counts in `tests.md` "Regression Baseline". |
| 0.4 | `pg_dump` backup (§3 step 1). |
| 0.5 | Create GitHub Issues I-1…I-9 and add to the Project board (Backlog). Needs `gh auth refresh -s project` — current token lacks project scope. |
| 0.6 | Create `docs/lab-04/` skeleton, `server/tests/lab-04/`, `client/tests/lab-04/`, `e2e/lab-04/`, `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow,regression}/`. |
| 0.7 | Extend `e2e/lab-03/capture.ts` → `e2e/lab-04/capture.ts` (same harness, new screens). |
| 0.8 | Clean up `server/uploads/` test debris (check git status of those files first). |

**Gate:** `lab4-staging` exists, baseline green and recorded, backup taken, issues on the board.

---

## 10. Test Plan Skeleton (full table lives in tests.md)

| Level | Files | Key cases |
|---|---|---|
| Unit | `server/tests/lab-04/action-rules.unit.test.ts`, `status-transitions` (extend) | action status matrix, follow-up rule, resolution-gate function, Bangkok date boundaries |
| API | `actions-taken.api.test.ts` | create valid (AC-01), Requester 403, inactive assignee 422, follow-up missing note 400, idempotent replay 200, stale 409, locked ticket 409, cross-ticket actionId 404 |
| API | `ticket-workflow.api.test.ts` | each matrix cell sample, resolve blocked/allowed, cancel needs reason, history appended in order, Requester cannot transition, stale status update 409 |
| API | `requester-dashboard.api.test.ts` / `staff-dashboard.api.test.ts` | counts equal direct Prisma counts, ownership scoping (AC-02), empty user → zeros, role 403, date boundary at Bangkok midnight |
| Migration | `migration-regression.api.test.ts` (lab-04) | row counts preserved, legacy tickets readable, seed run twice = same counts |
| UI component | `StaffDashboard`, `RequesterDashboard`, `ActionsTaken`, `TicketWorkflow` `.test.tsx` | loading / empty / error / forbidden states, links point at right drill-down, follow-up field toggling, only permitted transitions rendered, form keeps data after failure |
| UI style / responsive / a11y | Playwright visual spec | no horizontal overflow at 375/768/1280, focus visible, axe check on Lab 4 screens |
| E2E | `actions-taken-flow`, `ticket-resolution`, `dashboards` `.spec.ts` | full lifecycle New → Resolved → Closed and → Cancelled; two staff add actions to one ticket; dashboard card click lands on filtered list |
| Performance smoke | `dashboards.perf.test.ts` | dashboard endpoints < 500 ms on seeded DB |
| Regression | all lab-01..03 suites | must stay green unchanged in intent |

---

## 11. PDF Map (where each part's evidence comes from)

| Part | Pts | Evidence source |
|---|---|---|
| 1 Git | 10 | `git log --graph` showing feature → lab4-staging → main; Kanban Done; rendered reviewer.md; README + .gitignore; `tree` output |
| 2 Spec | 5 | rendered specification.md; I-1 merge time vs I-3 merge time |
| 3 Tests | 10 | rendered tests.md; full test output run on `main` |
| 4 AI | 5 | ai-use.md with 6–10 prompts + "My Reflection" |
| 5 Staff dashboard | 5 | screenshots of every state + SQL transcript matching counts |
| 6 Actions Taken | 10 | the largest UI part — budget the most screenshots here |
| 7 Workflow | 5 | transitions, blocked resolve, history timeline ordering |
| 8 Requester dash + regression | 5 | dashboard + one shot per regression area |
| 9 Visual | 5 | rendered ui-spec + 3-viewport shots + completed checklist |

---

## 12. Ranked Risks

1. **Reviewer latency** (9 PRs). Mitigation: agree windows at 0.1; batch small fixes.
2. **Rubric/handout mismatch on Actions Taken** (assignee/status not in the field list). Mitigation: D-02/D-03 cover both readings; spec states the interpretation explicitly.
3. **Changing Lab 3 status endpoint** breaks Lab 3 tests. Mitigation: `expectedVersion` optional on Lab 3 endpoints; gates only add new 409s for cases Lab 3 tests don't exercise — verify in I-3.
4. **Requester routing rewrite (D-16)** touches Lab 2 screens. Mitigation: do it in I-5 behind the Lab 2/3 regression suites; e2e for direct URLs.
5. **Migration on real data.** Mitigation: dump + rehearsal + no-DROP check.
6. **Screenshot volume at the end.** Mitigation: capture harness per PR.

---

## 13. Open Items

- Who reviews and merges Lab 4 PRs, and their availability.
- Submission deadline (not stated in the labsheet).
- `gh` token needs `project` scope for the Kanban board.
- Confirm the D-10 resolution gate strictness (≥1 completed action) is acceptable.
