# Lab 4 Specification — TokTickIT Actions Taken, Dashboards, and Final Regression

**Course:** CPE 334 — Semester 1/2026 · **Author:** Garunyapas Danpitakkul (67070503404, @vienggg)
**Companion documents:** `api-spec.md`, `ui-spec.md`, `tests.md`, `sprint-plan.md`
**Baseline:** `main` at tag `lab3-release` (server 251 tests, client 70 tests green before Lab 4 work).

---

## 1. Sprint Goal

Complete the core TokTickIT service-desk workflow: IT Staff record **Actions Taken** under each Ticket, the backend enforces the final Ticket status rules (including a resolution gate and an append-only status history), each role gets a concise dashboard linked to the detailed screens, and the whole application — Labs 1 to 3 included — is hardened, responsive, accessible and consistent under Zen Green.

## 2. Stakeholder Request Interpretation

The service desk can receive Tickets and staff can talk to Requesters, but nobody can see what work was actually done. The stakeholder wants each Ticket to carry a list of work items (what was done, when, by whom, with what result, whether follow-up is needed, and where to find supporting files). The Ticket Owner stays responsible for the Ticket as a whole, but any IT Staff member may do and record work. A Requester can say "this looks fixed", but only staff may move the Ticket to Resolved, and the server must refuse to do so when the work is not finished. Requesters and staff need a small dashboard each, built from real data and linking to the full lists. Finally, everything built so far must still work and look like one product.

## 3. Scope

### Included
* **Actions Taken** (create, view, edit, assign, status, complete, cancel) on Ticket Detail; read-only for Requesters.
* Final **Ticket status transition matrix** with role rules, resolution gate, cancel/reopen reasons, and an append-only **status history**.
* **Optimistic concurrency** (stale-update detection) for Ticket workflow changes and Actions Taken.
* **Requester dashboard** and **IT Staff dashboard** (Administrators reuse the staff dashboard plus user counts), computed by the backend.
* Role-aware navigation, Requester routes that can be addressed by URL, drill-down links.
* Prisma migration `5_add_actions_taken_and_history`, idempotent seed additions, README update.
* Final hardening: duplicate-submit protection, preserved form data, consistent states, console/placeholder cleanup, full regression.

### Explicitly Excluded
SLA clocks, escalation, on-call, breach notices · email/SMS/LINE/push or any external notification · inventory, spare parts, purchasing, service costing · time-sheets, billing, payroll, labor cost · multi-level approval, e-signatures · BI tools, custom reports, exports · multi-tenant organisations, production cloud operations · **file upload for Actions Taken** (Attachment Notes are text only) · deleting Actions Taken or status history · any feature not listed above.

## 4. Functional Requirements

### Actions Taken
* **FR-01** IT Staff and Administrators can list the Actions Taken of any Ticket, ordered by Action Date/Time then id.
* **FR-02** IT Staff and Administrators can create an Action Taken on a Ticket with: Action Date/Time, Description, Result, Status, Assignee, Follow-Up Required?, Follow-up Note, Attachment Notes. *Performed by* is set by the server.
* **FR-03** IT Staff and Administrators can edit a non-terminal Action Taken.
* **FR-04** An Action Taken has its own status (`PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) with the transitions in BR-11; completing and cancelling are status changes, not deletions.
* **FR-05** An Action Taken can be assigned to any active IT Staff or Administrator; the default assignee is the creator.
* **FR-06** A Requester can view all Actions Taken (every field) of their own Tickets and can never create or change one.
* **FR-07** When Follow-Up Required is set, a Follow-up Note is mandatory (UI, API and database).

### Ticket Workflow
* **FR-08** The Ticket status control offers only the transitions permitted for the current status, role, owner and Actions Taken state.
* **FR-09** Moving a Ticket to `RESOLVED` is allowed only when the resolution gate (BR-19) is satisfied; the server enforces it for every client.
* **FR-10** Cancelling and reopening require a reason; cancelling also requires no open Actions Taken.
* **FR-11** Every status change appends a history entry (from, to, actor, reason, time); the history is shown as a timeline and cannot be edited or deleted.
* **FR-12** A workflow change or Action Taken update based on out-of-date data is rejected with a conflict that returns the current record.
* **FR-13** After any successful workflow change the Ticket summary (status badge, permitted transitions, version) is refreshed.

### Dashboards
* **FR-14** A Requester dashboard shows only that Requester's own Tickets: open, waiting for me, resolved, closed, recently updated, recently resolved.
* **FR-15** A staff dashboard shows unassigned, my owned, my open Actions Taken, pending follow-ups, waiting-for-Requester, counts by status and by IT Priority, an attention list and recently updated Tickets.
* **FR-16** The Administrator dashboard is the staff dashboard plus concise user-account counts.
* **FR-17** Every metric card has a defined query, an empty state and a drill-down link; every list row opens its Ticket.
* **FR-18** After login every role lands on its Dashboard; navigation shows role-appropriate links and marks the active page.

### Hardening
* **FR-19** Repeated clicks and network retries on create/save/transition actions do not create duplicates or double transitions.
* **FR-20** Forms keep the user's input after a recoverable failure (validation, conflict, network).
* **FR-21** Loading, validation, success, empty, no-results, forbidden, conflict, not-found and safe-failure feedback is consistent on every screen.
* **FR-22** All Lab 1–3 behaviour (authentication, ownership, comments, notes, attachments, user management) continues to work.
* **FR-23** README documents setup, migration, seed, tests and the demo flow.

## 5. Business Rules

### Actions Taken
* **BR-01** An Action Taken belongs to exactly one Ticket (required foreign key; cannot be moved to another Ticket).
* **BR-02** The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by, and assigned to, a different IT Staff member; recording an action never changes the Ticket Owner.
* **BR-03** Only IT Staff and Administrators may create or update Actions Taken. Every write is enforced by the backend.
* **BR-04** A Requester may read Actions Taken only for their own Tickets; for another Requester's Ticket the response is 404 (existence is not revealed).
* **BR-05** *Performed by* (`createdBy`) is the authenticated creator, set by the server, immutable, and any value sent by the client is ignored. *Assignee* must be an **active** user with role `IT_STAFF` or `ADMINISTRATOR`, otherwise `422 INVALID_ASSIGNEE`; if omitted it defaults to the creator.
* **BR-06** Action Date/Time (`actionAt`) defaults to the server's current time, may not be later than now + 5 minutes, and may not be earlier than the Ticket's creation time. It is stored in UTC and displayed in Asia/Bangkok.
* **BR-07** Description is required, 1–2000 characters after trimming.
* **BR-08** Result is optional while the action is `PLANNED`/`IN_PROGRESS` and **required** (1–2000 characters) when the action is `COMPLETED`.
* **BR-09** If Follow-Up Required is true, Follow-up Note is required (1–1000 characters after trimming); if false, the note is stored as null.
* **BR-10** Attachment Notes are optional free text (≤ 1000 characters) saying where supporting files can be found. They are not uploads.
* **BR-11** Action status transitions: `PLANNED → IN_PROGRESS | COMPLETED | CANCELLED`; `IN_PROGRESS → COMPLETED | CANCELLED`; `COMPLETED` and `CANCELLED` are terminal. A new action may start as `PLANNED` (default), `IN_PROGRESS` or `COMPLETED`, never `CANCELLED`.
* **BR-12** A terminal (`COMPLETED`/`CANCELLED`) Action Taken is read-only (`409 ACTION_LOCKED`); a correction is recorded as a new Action Taken.
* **BR-13** Actions Taken are never deleted; cancelling is the removal mechanism (append-only history of work).
* **BR-14** Actions Taken can be created or edited only while the Ticket is `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER` or `REOPENED`; for `RESOLVED`, `CLOSED` and `CANCELLED` the server returns `409 TICKET_LOCKED`. Reopening the Ticket unlocks it.
* **BR-15** Everything in an Action Taken is visible to the Requester of the Ticket; staff-only remarks belong in Internal Notes (the form says so).

### Ticket Status and Resolution
* **BR-16** Statuses are `NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED`. Only IT Staff and Administrators change status (§6.2). A Requester can never change status.
* **BR-17** The legal transitions are the Lab 3 matrix (unchanged, §6.2) plus the gates below. An illegal transition returns `409 ILLEGAL_TRANSITION` with the permitted destinations.
* **BR-18** A Ticket cannot enter `IN_PROGRESS` or `RESOLVED` while it has no owner.
* **BR-19 (Resolution gate)** A Ticket may enter `RESOLVED` only if (a) it has an owner, (b) it has at least one `COMPLETED` Action Taken, and (c) it has no `PLANNED` or `IN_PROGRESS` Action Taken. Otherwise `409 RESOLUTION_BLOCKED` with a `blockers` list. The check and the status change run in one transaction that locks the Ticket row, so a concurrent action creation cannot slip past the gate.
* **BR-20** Entering `CANCELLED` requires a non-empty reason (≤ 500 characters) and no `PLANNED`/`IN_PROGRESS` Action Taken (staff cancel them first). `CANCELLED` is terminal.
* **BR-21** Entering `REOPENED` (from `RESOLVED` or `CLOSED`) requires a reason. Reopening clears `resolvedAt` and `closedAt`.
* **BR-22** Only `RESOLVED → CLOSED` closes a Ticket. `resolvedAt` is set on entering `RESOLVED`, `closedAt` on entering `CLOSED`.
* **BR-23** The Requester's "Problem Appears Resolved" signal (Lab 3) remains advisory: it sets a flag and a Public Comment and never changes status. Staff see it as a badge and on the attention list.
* **BR-24** Every status change writes a `TicketStatusHistory` row in the same transaction as the change. History rows have no update or delete path and are ordered by `(createdAt, id)`. A Requester sees from/to, actor name and time, but not the reason.

### Concurrency and Retries
* **BR-25** `Ticket.version` increases on every staff workflow change (status, owner, IT priority); `ActionTaken.version` increases on every edit. Lab 4 clients send `expectedVersion`; a mismatch returns `409 STALE_UPDATE` with the current record and changes nothing. (Lab 3 callers that omit it keep last-write-wins behaviour; this is documented, not hidden.)
* **BR-26** Creating an Action Taken accepts a client-generated `clientRequestId`. A repeat of the same `(ticketId, clientRequestId)` returns the existing row with `200` instead of creating a second one.

### Dashboards
* **BR-27** All dashboard numbers are computed by the backend from the database at request time; the client never computes metrics.
* **BR-28** The Requester dashboard is scoped to the authenticated user's own Tickets; identifiers in the request are ignored.
* **BR-29** "Active" Tickets are those in `NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED`.
* **BR-30** Time rules use Asia/Bangkok. "Recently resolved" means `resolvedAt` falls on or after 00:00 Bangkok time six days ago (the last 7 calendar days including today) and status is `RESOLVED` or `CLOSED`.
* **BR-31** Lists contain at most 5 rows ordered by `updatedAt` desc, `id` desc (recently resolved: `resolvedAt` desc). Dashboards never return whole Ticket collections.
* **BR-32** Empty data is explicit: every count is `0` (never missing) and every list is `[]`; each card renders its own empty message.
* **BR-33** *My Open Actions* counts Actions Taken assigned to the current user with status `PLANNED` or `IN_PROGRESS` on Tickets in any status.
* **BR-34** *Pending Follow-ups* counts **distinct active Tickets** having at least one non-cancelled Action Taken with Follow-Up Required, so the count equals the number of rows in its drill-down list.
* **BR-35** *By IT Priority* counts active Tickets only; *By Status* counts all 8 statuses (zeros included).
* **BR-36** The attention list contains active Tickets with IT Priority `URGENT` or `HIGH`, or with the Requester resolution signal set, ordered by IT Priority severity then `updatedAt` desc.
* **BR-37** Administrator user counts show users by role and active/inactive; staff (non-admin) responses never include them.

### Migration and Legacy Data
* **BR-38** The migration preserves every existing User, Ticket, Attachment, Public Comment and Internal Note (row counts and foreign keys unchanged).
* **BR-39** Legacy Tickets simply have zero Actions Taken and no history; no synthetic rows are invented. The gate applies only when a transition is attempted, so already-`RESOLVED`/`CLOSED` legacy Tickets are untouched. The timeline shows "History is recorded from Lab 4 onward" when empty.
* **BR-40** `resolvedAt`/`closedAt` are backfilled from `updatedAt` for Tickets already `RESOLVED`/`CLOSED`; this is approximate and labelled as such so "recently resolved" is still meaningful for legacy data.

## 6. Authorization and Transition Matrices

### 6.1 Authorization matrix (new and changed operations)

| Operation | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|
| View Actions Taken of a Ticket | ✅ own Tickets (read-only) | ✅ any | ✅ any |
| Create / edit / complete / cancel an Action Taken | ❌ 403 | ✅ | ✅ |
| Assign an Action Taken to an active staff user | ❌ | ✅ | ✅ |
| View status history | ✅ own (no reasons) | ✅ with reasons | ✅ with reasons |
| Change Ticket status | ❌ 403 | ✅ (gates apply) | ✅ (gates apply) |
| Requester dashboard | ✅ own data | ❌ 403 | ❌ 403 |
| Staff dashboard | ❌ 403 | ✅ | ✅ |
| User-account counts on dashboard | ❌ | ❌ | ✅ |
| All Lab 3 operations | unchanged | unchanged | unchanged |

Unauthenticated calls to any of these return 401. Hiding a control in the UI is never authorization.

### 6.2 Ticket status transition matrix

| From \ To | NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER | RESOLVED | CLOSED | REOPENED | CANCELLED |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **NEW** | — | ✅ | ✅ ¹ | — | — | — | — | ✅ ² |
| **OPEN** | — | — | ✅ ¹ | ✅ | ✅ ³ | — | — | ✅ ² |
| **IN_PROGRESS** | — | — | — | ✅ | ✅ ³ | — | — | ✅ ² |
| **WAITING_FOR_REQUESTER** | — | — | ✅ ¹ | — | ✅ ³ | — | — | ✅ ² |
| **RESOLVED** | — | — | — | — | — | ✅ | ✅ ⁴ | — |
| **CLOSED** | — | — | — | — | — | — | ✅ ⁴ | — |
| **REOPENED** | — | — | ✅ ¹ | ✅ | ✅ ³ | — | — | ✅ ² |
| **CANCELLED** | — | — | — | — | — | — | — | — |

¹ owner required (BR-18) · ² reason required, no open Actions Taken (BR-20) · ³ resolution gate (BR-19) · ⁴ reason required (BR-21).
Roles: IT Staff and Administrator only, for every cell. The matrix cells are identical to Lab 3 §6.5; Lab 4 adds only the footnoted gates and the role statement.

## 7. Data Changes

* **`ActionTaken`** (new): `id`, `ticketId` (FK → Ticket, `ON DELETE RESTRICT`), `actionAt`, `description`, `result?`, `status` (enum `ActionStatus`), `followUpRequired`, `followUpNote?`, `attachmentNotes?`, `createdById`, `assigneeId`, `updatedById?`, `clientRequestId?`, `version` (default 1), `createdAt`, `updatedAt`, `completedAt?`. Unique `(ticketId, clientRequestId)`; indexes `(ticketId, actionAt, id)` and `(assigneeId, status)`. A database `CHECK` enforces BR-09 (`NOT followUpRequired OR length(btrim(followUpNote)) > 0`) and one enforces BR-08 (`status <> 'COMPLETED' OR length(btrim(result)) > 0`).
* **`TicketStatusHistory`** (new): `id`, `ticketId` (FK), `fromStatus`, `toStatus`, `changedById` (FK), `reason?`, `createdAt`; index `(ticketId, createdAt, id)`.
* **`Ticket`** (changed): adds `version Int DEFAULT 1`, `resolvedAt?`, `closedAt?`; adds index `(ownerId, status)` for dashboard queries.
* **Enum** `ActionStatus`: `PLANNED, IN_PROGRESS, COMPLETED, CANCELLED`.

### Database-design decisions (justified)
1. **Integer `version` instead of comparing `updatedAt`.** `updatedAt` has millisecond precision, is also touched by unrelated writes (comments, attachments), and would reject valid edits or miss real conflicts. A dedicated counter changes only on workflow edits, is trivial to compare in a single `UPDATE … WHERE version = ?`, and survives clock or serialization quirks.
2. **Business rules as `CHECK` constraints in addition to API validation.** The follow-up and completed-result rules are enforced where data lives, so seed scripts, future code paths or manual SQL cannot create an inconsistent row. The API validates first to return friendly 400s; the database is the last line of defence.
3. **`ON DELETE RESTRICT` for `ActionTaken.ticketId` (not `CASCADE` as for comments).** Work history is an audit record; deleting a Ticket must fail loudly instead of silently erasing what was done. This also matches BR-13.
4. **Separate `TicketStatusHistory` table (not a status-log column or reusing comments).** A dedicated append-only table gives stable `(createdAt, id)` ordering, makes the "no update/delete path" rule structural, and keeps requester-visible data separate from staff-only reasons.

### Migration strategy and recovery
`5_add_actions_taken_and_history` is generated with `--create-only`, hand-reviewed to contain **no `DROP`/destructive statement**, and only adds objects and nullable/defaulted columns, so existing rows are untouched. Order: back up with `pg_dump` → rehearse on a restored copy → apply → compare row counts of every table before/after → run the regression suite. **Recovery:** restore the dump taken before the migration (`psql` into a fresh database) and run `prisma migrate resolve --rolled-back 5_add_actions_taken_and_history`; the rollback is rehearsed once and recorded in `tests.md`. Pre-migration counts: users 451, tickets 1031, attachments 128, public comments 229, internal notes 144.

### Seed data (idempotent)
Upserts by email / ticket number / `(ticketId, clientRequestId)`, safe to run repeatedly. Adds: Tickets with **0, 1 and several** Actions Taken; one Ticket with actions by two different staff while owned by a third; actions in every `ActionStatus`; at least one pending follow-up; one inactive IT Staff account (for rejection demos); one Requester with no Tickets (empty dashboard); one fully idle staff user (zero metrics); status-history rows for the seeded transitions. Existing Lab 3 seed data (all 8 statuses, all priorities, assigned and unassigned) is kept.

## 8. API Contract
See `api-spec.md`. Summary: `GET /api/tickets/:id/actions`, `POST` and `PATCH /api/staff/tickets/:id/actions[/:actionId]`, `GET /api/tickets/:id/history`, changed `PATCH /api/staff/tickets/:id/{status,owner,it-priority}`, `GET /api/dashboard/requester`, `GET /api/dashboard/staff`, plus `ACTIVE` status filter and `followUp=true` queue filter. Error shape stays `{ error: { code, message } }` with extra fields (`permitted`, `blockers`, `current`) for specific codes.

## 9. UI Specification Summary
See `ui-spec.md`. Dashboard is the landing page for every role; the Requester area moves to URL routes (`/dashboard`, `/tickets`, `/tickets/new`, `/tickets/:id`); the staff Ticket Detail gains an **Actions Taken** table with inline create/view/edit forms and a status-history timeline; the status control shows only permitted transitions and explains blocked ones; metric cards are links with labels, values and empty states. Layouts hold at 1280, 768 and 375 px with no horizontal page scroll.

## 10. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given permitted IT Staff and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and the approved assignee (default: creator). |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-03 | Given a Requester, when they try to create or update an Action Taken, then the server returns 403 and no row is written. |
| AC-04 | Given a Requester, when they list Actions Taken, then they see every field for their own Ticket, and a 404 (no content) for another Requester's Ticket. |
| AC-05 | Given an assignee who is inactive or not IT Staff/Administrator, when an action is created or reassigned, then the server returns 422 `INVALID_ASSIGNEE` and writes nothing. |
| AC-06 | Given Follow-Up Required without a Follow-up Note (or a `COMPLETED` action without a Result), when saved, then the request is rejected with 400; with the note/result it succeeds; the same rows cannot be inserted directly into the database. |
| AC-07 | Given a Ticket owned by staff A, when staff B records an Action Taken, then it succeeds, shows B as Performed by, and the Ticket Owner is still A. |
| AC-08 | Given an Action Taken, when its status moves along a legal edge it succeeds; along an illegal edge (e.g. `COMPLETED → IN_PROGRESS`) it returns 409 `ILLEGAL_ACTION_TRANSITION` with the permitted set; editing a terminal action returns 409 `ACTION_LOCKED`. |
| AC-09 | Given two staff editing the same Action Taken, when the second saves with an old `expectedVersion`, then 409 `STALE_UPDATE` returns the current record and nothing is overwritten. |
| AC-10 | Given the same create request sent twice with one `clientRequestId`, then exactly one row exists and the second response is 200 with the same id. |
| AC-11 | Given a Ticket in `RESOLVED`, `CLOSED` or `CANCELLED`, when an Action Taken is created or edited, then the server returns 409 `TICKET_LOCKED`. |
| AC-12 | Given several Actions Taken on a Ticket, when listed repeatedly, then the order is stable by `actionAt` then `id`. |
| AC-13 | Given a Ticket with no owner, no completed action, or an open action, when staff request `RESOLVED`, then the server returns 409 `RESOLUTION_BLOCKED` listing every blocker and the status is unchanged. |
| AC-14 | Given the gate is satisfied, when staff request `RESOLVED`, then status changes, `resolvedAt` is set, one history row is appended in the same transaction, and the response carries the new status and version. |
| AC-15 | Given a Requester, when they call the status endpoint or use "Problem Appears Resolved", then status never changes (403 / flag only). |
| AC-16 | Given staff cancelling a Ticket, when the reason is missing or an action is still open, then the request is rejected; with a reason and no open actions the Ticket becomes `CANCELLED` and cannot change again. |
| AC-17 | Given a `RESOLVED` or `CLOSED` Ticket, when staff reopen it without a reason it is rejected; with a reason it becomes `REOPENED` and `resolvedAt`/`closedAt` are cleared. |
| AC-18 | Given status changes on a Ticket, when history is read, then entries are ordered by time then id, none can be modified or deleted (no such endpoint), and a Requester does not receive reasons. |
| AC-19 | Given a stale Ticket `expectedVersion`, when a status, owner or priority change is submitted, then 409 `STALE_UPDATE` returns the current Ticket and nothing changes. |
| AC-20 | Given an illegal transition (Lab 3 behaviour, e.g. `NEW → RESOLVED`), then 409 `ILLEGAL_TRANSITION` with the permitted set is still returned. |
| AC-21 | Given the Ticket Detail screen, then the status control lists only permitted destinations, explains why Resolve is unavailable, and refreshes the summary status after success. |
| AC-22 | Given seeded data, when the staff dashboard loads, then every card equals the corresponding direct database query and every drill-down link opens a list whose row count equals the card. |
| AC-23 | Given a Requester calling the staff dashboard, or staff/Administrator calling the Requester dashboard, then 403; unauthenticated then 401. |
| AC-24 | Given a user with no matching data, then all counts are 0, all lists are empty and each card shows its empty message. |
| AC-25 | Given an Administrator, then the staff dashboard includes user-account counts; for IT Staff they are absent. |
| AC-26 | Given Tickets resolved just before and after Bangkok midnight six days ago, then "recently resolved" includes exactly those inside the window. |
| AC-27 | Given the pre-Lab-4 database, when the migration and seed run (twice), then all existing rows are intact, legacy Tickets read correctly with zero actions, and a second seed run adds nothing. |
| AC-28 | Given the Actions Taken UI, then list, create, view and edit modes work, validation messages sit beside their fields, and entered data survives a failed save. |
| AC-29 | Given every Lab 4 screen at 1280, 768 and 375 px, then there is no horizontal page overflow, clipped or overlapping content, keyboard focus is visible and controls have accessible names. |
| AC-30 | Given the complete application, then the Lab 1–3 automated suites pass unchanged in intent and each role's navigation reaches only its permitted screens, including direct URL entry. |
| AC-31 | Given no session, then every new endpoint returns 401. |
| AC-32 | Given seeded data, then each dashboard endpoint responds in under 500 ms (smoke threshold). |
| AC-33 | Given a double click or retry on Create Action, Save or a status change, then exactly one change is applied and the console shows no errors. |

Every criterion maps to at least one test in `tests.md`.

## 11. Definition of Done (Product Completion)

* All FRs and BRs are implemented and each is covered by a test named in `tests.md`; every AC maps to at least one passing test.
* The `lab-01`…`lab-03` suites (server 251, client 70 at baseline) still pass, and the Lab 3 Playwright specs still pass.
* Migration `5_…` applies to a restored pre-Lab-4 dump with identical row counts, and the documented recovery was rehearsed; the seed is idempotent.
* Authorization (§6.1) and transitions (§6.2) hold when the UI is bypassed; every new write is tested as Requester (403/404), unauthenticated (401) and stale (409).
* Dashboard numbers were compared with direct SQL for at least five metrics, with transcripts saved.
* All Lab 4 screens are verified at 1280/768/375 px with the checklist in `ui-spec.md` §9 completed; no console errors, broken links, placeholder text or unfinished controls remain.
* `README.md` setup, migration, seed, test and demo steps are current.
* `docs/lab-04/*` merged to `lab4-staging` **before** the implementation PRs (I-3 onward); `reviewer.md` and `ai-use.md` updated with every PR.
* `lab4-staging` merged to `main`, tagged `lab4-release`, final test output captured **from `main`**, and all GitHub Issues in Done.

## 12. Assumptions and Decisions

* **Handout vs rubric:** the field list names *Performed by (auto)* only, while the grading text also expects "assign", "complete", "cancel" and "inactive-assignee rejection". Both are kept: *Performed by* is the immutable creator; *Assignee* is a separate, validated field; Action Taken has its own status. The UI labels them "Recorded by" and "Assignee".
* **Defaults:** a new action starts `PLANNED` (it can also start `COMPLETED` when work is logged after the fact).
* **Resolution strictness (BR-19):** requiring at least one completed action is a deliberate product decision so that "Resolved" always has recorded work behind it.
* **Terminal actions are read-only (BR-12):** corrections are new actions; this keeps the work record trustworthy.
* **Requester visibility (BR-15):** Requesters see every Action Taken field, as the handout states; staff-only remarks belong in Internal Notes.
* **Attachment Notes are text pointers**, not uploads, because file handling for actions is out of scope.
* **Time zone:** Asia/Bangkok for all date boundaries; the API returns UTC ISO timestamps.
* **Concurrency:** optimistic versioning rather than locks; Lab 3 endpoints keep working for callers that send no `expectedVersion`, and the Lab 4 client always sends it.
* **Routing:** the Requester area becomes URL-based so dashboard drill-down links work and can be tested; Lab 2 behaviour is otherwise preserved.
* **Admin dashboard** reuses the staff dashboard (handout §4.6) and adds only user counts.
