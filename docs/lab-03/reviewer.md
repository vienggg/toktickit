# Lab 3 — Peer Review Record

**Author:** Garunyapas Danpitakkul (Student ID: 67070503404, GitHub: @vienggg)
**Peer Reviewer:** Dechayut (Student ID: 67070503414, GitHub: @NinjoMUDA)
**Partner Repository:** [https://github.com/NinjoMUDA/Dechayut_3414Lab1](https://github.com/NinjoMUDA/Dechayut_3414Lab1)
**Project Repository:** [https://github.com/vienggg/toktickit](https://github.com/vienggg/toktickit)

> This log is appended after every merged PR, not written retroactively at the
> end of the sprint — see `docs/lab-03/sprint-plan.md` §1 (Law 2) for why.

---

## 1. Pull Requests Authored (Reviewed & Merged by @NinjoMUDA)

| PR # | Title | Feature Branch | Target Branch | Status & Verdict |
|---|---|---|---|:---:|
| [#61](https://github.com/vienggg/toktickit/pull/61) | chore(lab3): Sprint 3 infrastructure setup | `chore/lab3-phase0-infra` | `lab3-staging` | Approved & Merged |
| [#62](https://github.com/vienggg/toktickit/pull/62) | docs(lab3): Sprint 3 engineering contract | `docs/lab3-spec-and-test-plan` | `lab3-staging` | Approved & Merged |
| [#63](https://github.com/vienggg/toktickit/pull/63) | feat(lab3): data model, migration, and seed for Users, Roles, and Ticket workflow | `feature/lab3-user-model-and-migration` | `lab3-staging` | Approved & Merged |
| [#64](https://github.com/vienggg/toktickit/pull/64) | feat(lab3): authentication foundation — login, logout, me, change-password | `feature/lab3-auth-foundation` | `lab3-staging` | Approved & Merged |
| [#65](https://github.com/vienggg/toktickit/pull/65) | feat(lab3): auth UI, routing, and Requester regression | `feature/lab3-auth-shell-and-regression` | `lab3-staging` | Changes Requested → Fixed → Approved & Merged |
| [#66](https://github.com/vienggg/toktickit/pull/66) | feat(lab3): Requester Public Comments and resolution signal | `feature/lab3-requester-comments` | `lab3-staging` | Changes Requested → Fixed → Approved & Merged |
| [#67](https://github.com/vienggg/toktickit/pull/67) | feat(lab3): IT Staff Ticket Queue | `feature/lab3-staff-queue` | `lab3-staging` | Changes Requested → Fixed → Approved & Merged |
| [#68](https://github.com/vienggg/toktickit/pull/68) | feat(lab3): IT Staff Ticket Detail | `feature/lab3-staff-ticket-detail` | `lab3-staging` | Changes Requested → Fixed → Approved & Merged |
| [#69](https://github.com/vienggg/toktickit/pull/69) | feat(lab3): Administrator User Management | `feature/lab3-user-administration` | `lab3-staging` | Changes Requested → Fixed → Approved & Merged |
| [#70](https://github.com/vienggg/toktickit/pull/70) | feat(lab3): E2E specs, full screenshot manifest, visual inspection | `feature/lab3-e2e-and-visual` | `lab3-staging` | Changes Requested → Fixed → re-review pending |

*(Rows are appended, and PR numbers/links/verdicts filled in, as each Issue's
PR is actually opened and reviewed. This table is never pre-filled with
predicted outcomes.)*

**Note on reviewer identity:** PRs #61 and #62 were reviewed and merged by the
GitHub account **@projectnewy**, not @NinjoMUDA as named at the top of this
document. This is recorded here factually and should be confirmed/reconciled
before final submission — Part 1 grades "rendered reviewer.md with reviewer
identity," so whichever account is doing the actual reviewing needs to match
what this document says.

---

## 2. Substantive Review Comments Received & Responses

#### PR #65: Auth UI, routing, and Requester regression — Changes Requested (@projectnewy, 2026-09-16)

> **Reviewer Feedback:** Nine findings, ranked by severity, three called out as
> blocking: (1) the `/uploads` static mount was still live alongside the new
> authenticated download endpoint, so the ownership/removal-state gap the PR
> claimed to close was still open via the old path; (2) the ownership check
> (`!ticket || ticket.requesterId !== req.authUser!.id`) was hand-rolled
> inline in three places instead of reusing the existing `findOwnedTicketOr404`
> helper, risking future divergence; (3) `GET /api/auth/me` silently dropped
> `department` on every call after the initial login response; (4) the
> attachment-upload route ran multer's disk-write middleware *before* the
> ownership check, so a non-owner's rejected upload still left an orphaned
> file on disk; (5) no non-owner regression test existed for the POST/DELETE
> attachment routes, only GET and download; (6) `tests.md`'s API-10d row
> claimed 401 coverage across categories/systems/attachments/PATCH that
> didn't actually exist, and no systems test file existed at all; (7)
> `my-tickets` and `ticket-detail` tests both mutated the same real seeded
> user's `mustChangePassword` flag, race-prone under Vitest's cross-file
> parallelism; (8) the Navbar brand-click target changed from `'create'` to
> `'list'` with no explanation; (9) `checkSystem()` fetches `/api/categories`
> without `credentials: 'include'`, which is now behind `requireAuth`.
>
> **Author Response (@vienggg):** All nine addressed on the same branch.
> (1) Removed the `express.static("/uploads", ...)` mount entirely — nothing
> client-side referenced it any more, and the download endpoint doesn't need
> it (it streams from disk directly). (2)+(4) Replaced all four inline/duplicated
> ownership checks with one `requireOwnedTicketParam` middleware, applied to
> all five ticket-scoped routes (GET/PATCH/POST-attachments/DELETE-attachment/
> download) *ahead of* `upload.array()`, so ownership is confirmed before
> multer ever writes a file. (3) Added `department` to the `authUser` object
> `requireAuth` builds. (5) Added `API-12c`/`API-13a`: non-owner POST returns
> 404 and writes no file (asserted via before/after attachment count);
> non-owner DELETE returns 404. (6) Created `server/tests/lab-01/systems.test.ts`
> (didn't exist) and added the missing 401 tests for PATCH, POST/DELETE
> attachments, and the download route; corrected the `tests.md` row to
> describe what's actually tested and where. (7) Added a second dedicated
> test fixture (`REGRESSION_OTHER_REQUESTER_*` in `testAuth.ts`) with
> `mustChangePassword` already `false`, so `ticket-detail.api.test.ts`'s
> "someone else" scenario no longer touches any real seeded user or shared
> mutable state at all. (8) Reverted the brand-click target to `'create'`
> (Lab 2 behavior) — the change was unintentional drift, not a decision.
> (9) Added `credentials: 'include'` to `checkSystem()`'s `/api/categories`
> call. All 68 server tests (+6 new) and 17 client tests pass.

#### PR #66: Requester Public Comments and resolution signal — Changes Requested (@projectnewy, 2026-09-16)

> **Reviewer Feedback:** Eight findings, two blocking. (1) `POST
> .../resolution-signal` had no idempotency guard — the 409 check only
> covered terminal status, never whether `requesterResolvedAt` was already
> set, so a double-click or retry on a still-open ticket overwrote the
> timestamp and created a duplicate comment every time; the terminal-status
> read was also not re-checked inside the transaction, so it wasn't
> atomic. (2) the new `requireTicketVisibleToUser`/`findVisibleTicketOr404`
> reimplemented the same 404-masking logic PR #65 had just consolidated
> into one helper, reintroducing a second independent copy. (3) the
> client's `RESOLUTION_TERMINAL_STATUSES` list had dead entries (two raw
> uppercase values that can never reach the client once
> `serializeTicket`'s legacy mapping runs) and wasn't derived from any
> shared source with the server's own list. (4) `fetchComments` silently
> swallowed a non-ok response, unlike `fetchTicketDetail`'s handling in
> the same file. (5) `handlePostComment`/`handleSignalResolution`
> discarded their POST response and re-fetched instead — the resolution
> handler's re-fetch of the whole ticket also flipped `isLoading` and
> unmounted the detail view. (6) the resolution route reused the
> heavy `findOwnedTicketOr404` (with joins) for a handler that only reads
> `id`/`status`. (7) `parseInt(req.params.id, 10)` accepts trailing
> garbage (`"5abc"` → `5`) — a pre-existing pattern copy-pasted into the
> new route rather than fixed. (8) `authorRole` was fetched and typed on
> the client but never rendered.
>
> **Author Response (@vienggg):** All eight addressed on the same branch.
> (1) Rewrote the guard as a single conditional `updateMany` (`WHERE id =
> ? AND status NOT IN (...) AND requesterResolvedAt IS NULL`) inside the
> transaction — atomic by construction, since Postgres serializes
> concurrent UPDATEs on the same row and the second one's WHERE simply
> won't match once the first has committed. Added `API-18f` testing a
> second call is rejected and creates no duplicate. (2) Introduced one
> shared `fetchAuthorizedTicketOr404` core, parameterized by an
> authorization predicate and a fetch strategy; `findOwnedTicketOr404`
> (strict ownership, full detail), `findOwnedTicketLightOr404` (strict
> ownership, no joins), and `findVisibleTicketOr404` (role-aware
> visibility, no joins) are now three thin call sites over that one core.
> (3) Moved the status list to the server as the single source of truth
> and added a computed `canSignalResolution` boolean to `serializeTicket`'s
> output; the client reads that flag directly and no longer duplicates any
> status logic. (4) `fetchComments` now sets a visible error on a non-ok
> response. (5) Both handlers now read the POST/resolution-signal response
> directly — the resolution route was changed to also return the created
> comment so the client never needs a follow-up request for either
> action. (6) Resolution-signal now uses `findOwnedTicketLightOr404`. (7)
> Added a `parseStrictId` helper (regex-validated, not `parseInt`'s
> permissive trailing-garbage behavior) and applied it to every
> `:id`/`:attachmentId` route param in the file, not just the new I-5
> routes. (8) `authorRole` is now rendered as a small badge next to the
> author's name for any non-Requester author. All 82 server tests (+1 new)
> and 19 client tests pass.

#### PR #67: IT Staff Ticket Queue — Changes Requested (@projectnewy, 2026-09-17)

> **Reviewer Feedback:** Eight findings, two blocking. (1) the "Open"
> action's default `navigate('/staff/tickets/:id')` pointed at a route that
> does not exist in `App.tsx`, so every click on the queue's one specified
> action silently fell through to the Requester's own workspace instead of
> a ticket detail view — and no test exercised the click at all. (2) the
> Owner filter only offered "All"/"Unassigned" even though the API and
> `ui-spec.md` both call for a real per-staff-member picker, and there was
> no endpoint that could supply that roster (`/api/admin/users` is
> Administrator-only). (3) `categoryId`/`ownerId`/`page` each hand-rolled
> `/^\d+$/` validation instead of reusing `parseStrictId`, and `page` had
> no upper bound the way `pageSize` did, so an absurd `page` value could
> reach Prisma as a huge `skip` and surface as an unhandled 500. (4) the
> new screen re-implemented `MyTickets.tsx`'s search debounce, categories
> fetch, and fetch/loading/error shape wholesale rather than sharing it,
> and had already drifted (missing `parseApiError`). (5) a stale page with
> zero rows on it (e.g. after ownership churn) rendered fully blank with no
> Prev/Next to recover. (6) sortable column headers only existed on the
> desktop table, not the tablet layout. (7) the response included
> `description` and the requester's email though the UI never rendered
> them. (8) the staff-tickets query building duplicated `GET
> /api/tickets`'s pagination/count/findMany shape independently.
>
> **Author Response (@vienggg):** All eight addressed on the same branch.
> (1) `handleOpen` now opens a read-only detail modal populated from the
> already-fetched queue row — deliberately not I-7's full staff detail
> screen (ownership panel, status transitions, internal notes; that's
> issue #56, not yet started, with its own undocumented-until-then `GET
> /api/staff/tickets/:id`). Added a row-click → modal test. (2) Added `GET
> /api/staff/members` (IT_STAFF/ADMINISTRATOR only, active roster,
> `[{id, name}]`), documented in `api-spec.md` §4, and wired the picker to
> it. (3) `categoryId`/`ownerId` now reuse `parseStrictId`; `page` is
> capped at 100000 with the same 400 shape as every other invalid param;
> added a huge-`page` test. (4) Extracted the debounce, categories fetch,
> and generic paginated-fetch/loading/error state machine into
> `client/src/hooks/usePaginatedFetch.ts`, shared by both `MyTickets.tsx`
> and `StaffTicketQueue.tsx`, fixing the `parseApiError` drift. (5)
> Pagination controls now render whenever `pagination.total > 0`
> regardless of the current page's row count, and a stale out-of-range
> `page` auto-clamps back instead of rendering blank. (6) The tablet
> table gained the same sortable-header affordance as the desktop table.
> (7) Dropped the unused `requesterEmail` field; kept `description` and
> `requesterName` since the new modal renders both. (8) Extracted
> `fetchPaginatedTickets` as a shared pagination/count/findMany core for
> both `GET /api/tickets` and `GET /api/staff/tickets`, matching the
> `fetchAuthorizedTicketOr404` core-plus-thin-call-sites shape from the
> last two reviews. 103 server tests (+4 new) and 27 client tests (+2 new)
> pass.

#### PR #68: IT Staff Ticket Detail — Changes Requested (@projectnewy, 2026-09-18)

> **Reviewer Feedback:** Ten findings, two blocking. Also called out several
> things done well: the status-transition matrix matched §6.5 exactly, the
> `SAFE_REQUESTER_SELECT` passwordHash fix (from this same PR) was checked
> against every `requester:` include and found complete, ownership
> assignment correctly validated the live active-staff roster, and Internal
> Notes' 403 masking correctly ran the role check before the ticket lookup.
> Blocking: (1) `GET /api/staff/tickets/:id`'s `permittedStatusTransitions`
> did not apply the same BR-17 filter (`IN_PROGRESS` blocked while
> unassigned) that `PATCH /status` separately enforced — reproducible in
> the PR's own curl evidence (ticket 232, unassigned, yet
> `permittedStatusTransitions` included `IN_PROGRESS`) — so the client's
> Status control could offer a choice guaranteed to 409. (2) the evidence
> transcript (`artifacts/lab-03/curl-transcripts-i7.txt`) committed a real
> bcrypt hash for the regression-suite account, permanently in git history
> even after the runtime leak was fixed. Non-blocking: (3) comments/docs/a
> test title inaccurately claimed the I-6 read-only modal "remains
> available" via `onOpenTicket` after it had actually been deleted; (4)
> owner/IT-Priority/status PATCH handlers wrote then re-fetched the ticket
> with a second query instead of using `update()`'s own `include`; (5) the
> Public Comments panel was copy-pasted into `StaffTicketDetail.tsx`
> instead of shared, and had already drifted (always showing the role
> badge, unlike the Requester-side suppression for REQUESTER authors); (6)
> `formatDate` was reimplemented locally instead of reusing the shared one,
> producing a different date format; (7) `GET /api/staff/members` was
> fetched independently by both the Queue and Detail screens; (8)
> `--color-internal-note-bg` didn't match the spec's documented value; (9)
> the three save handlers triplicated the same boilerplate; (10) the
> `{ id, name }` owner projection was repeated ad hoc instead of a named
> constant like `SAFE_REQUESTER_SELECT`.
>
> **Author Response (@vienggg):** All ten addressed. (1) Extracted
> `getPermittedTransitionsForTicket(status, ownerId)` in
> `statusTransitions.ts` as the single shared BR-17 filter, used by both
> `GET`'s serializer and `PATCH /status`'s 409 handling. (2) Amended and
> force-pushed the original commit with the hash redacted, removing it
> from the branch's own history. (3) Corrected the "remains available"
> wording in all three places the reviewer named. (4) The three PATCH
> handlers now pass their `include` shape directly to `update()`. (5)
> Extracted a shared `PublicCommentsPanel`, preserving the exact
> role-badge-suppression behavior from the original Requester-side
> component. (6) Switched to the shared `formatDate`. (7) Extracted
> `useStaffMembers()` mirroring the existing `useCategoryOptions` pattern.
> (8) Corrected the CSS variable to the spec's documented `#FDF4E7`. (9)
> Extracted `useSavingAction()` for the shared save/error/success flow.
> (10) Added a named `STAFF_OWNER_SELECT` constant. 218 server tests (+5
> new) and 39 client tests pass.
>
> **Follow-up (@projectnewy, same day):** Verified all nine other fixes
> directly against the branch and confirmed each. Flagged that (2)'s
> verification claim overstated what was actually achieved: force-push
> only moves the branch ref, it doesn't garbage-collect the orphaned
> commit, and the old commit (`cab265d`) is still fetchable by exact SHA
> from GitHub — confirmed with `git fetch`, the GitHub API, and `git show
> cab265d:...`, which all still return the real hash. Since this is a
> seed/regression-fixture credential (the plaintext, `RegressionTest789`
> for this fixture, is already documented in `server/tests/helpers/testAuth.ts`)
> rather than a live secret, not re-blocking on it — but asked for the
> claim to be corrected rather than left overstated.
>
> **Author Response (@vienggg):** Agreed and corrected. Force-push removes
> a commit from a branch's *reachable* history, which is what a reviewer
> or grader diffing the branch will see, but does not purge the underlying
> git object from GitHub's storage — the older SHA remains fetchable
> directly, and is now doubly discoverable since it's named in this very
> log. The practical exposure is low (a bcrypt hash for a fixture account
> whose plaintext password is already committed in source, not a
> production credential), and a true purge would require GitHub Support
> intervention, which is out of scope here. Recording the accurate state
> rather than the overstated one: **the hash is off the branch's
> reachable history but not fully purged from GitHub's object storage.**

#### PR #69: Administrator User Management — Changes Requested (@projectnewy, 2026-09-18)

> **Reviewer Feedback:** Nine findings, one blocking. Also confirmed
> `SAFE_ADMIN_USER_SELECT` was correctly applied on every response with no
> full-row leak anywhere, password hashing/`mustChangePassword` correctly
> reused the existing helpers, `requireRole(ADMINISTRATOR)` correctly
> excluded IT_STAFF on both server and client, and BR-27's self-block had
> no id-comparison bug. Blocking: (1) BR-28's "last active Administrator"
> check had a genuine TOCTOU race — the count-then-write was two separate
> non-transactional statements with no lock, so two concurrent PATCHes
> deactivating each other of exactly two remaining active Administrators
> could each read "1 other active admin" before either write committed and
> both succeed, leaving zero active Administrators, exactly what the rule
> exists to prevent. Non-blocking: (2) the Part 7 evidence transcript's
> Scenario 4 (IT Staff → admin users) still showed the old 404 with a note
> promising re-capture "once I-8's routes exist" — which was now true; (3)
> `api-spec.md`'s status-code summary table said 409 for the
> last-Administrator rule while the implementation and detailed section
> both used 403; (4) the duplicate-email check ran before the BR-27
> self-modification check, so a self-deactivation attempt that also
> collided on email returned 409 DUPLICATE_EMAIL instead of 403
> SELF_MODIFICATION_BLOCKED; (5) the app-level email-uniqueness pre-check
> raced the DB's unique constraint, and the losing concurrent request's
> Prisma P2002 fell into the generic catch as an unhandled 500 instead of
> 409; (6) BR-27/BR-28 were hand-rolled entirely inline with no extracted
> reusable function; (7) Create User and Edit User were two fully separate
> modals duplicating ~90% of the same form fields; (8) a locally
> reimplemented `parseApiErrorDetailed` duplicated the already-imported
> `parseApiError`; (9) no client test exercised `RequireRole` redirecting
> an IT_STAFF/Requester away from `/admin/users`.
>
> **Author Response (@vienggg):** All nine addressed. (1) Extracted
> `checkAdminSafetyRules(tx, ...)` and now run the BR-27/BR-28 checks, the
> duplicate-email check, and the write inside one transaction, with an
> explicit `SELECT ... FOR UPDATE` lock on the active-Administrator row
> set taken before counting — this is what actually closes the race (plain
> `$transaction` at READ COMMITTED does not), since a second transaction's
> lock request blocks until the first commits, then re-reads the
> now-current state. Considered and rejected Serializable isolation
> (pushes a retry loop onto every caller for a guarantee a small explicit
> lock gives more cheaply) and the resolution-signal route's
> atomic-UPDATE-with-WHERE pattern (only works when the checked condition
> lives on the row being updated itself, not on other rows — BR-28's
> condition is about *other* active Administrators). Added a real
> concurrency test: two `Promise.all`'d PATCHes against exactly two active
> Administrators, asserting exactly one succeeds and at least one stays
> active. (2) Re-captured Scenario 4 — a real 403 now. (3) Corrected the
> status-code table to 403. (4) Reordered the checks so BR-27 runs first.
> (5) Both `POST` and `PATCH` now catch `P2002` explicitly and return 409;
> added a concurrency test for this too. (6) `checkAdminSafetyRules` is a
> named, reusable function. (7) Extracted a single parameterized
> `UserFormModal` for both Create and Edit. (8) Removed the duplicated
> function; `parseApiError` is now a thin wrapper over a new
> `parseApiErrorDetail` that also exposes `error.code`. (9) Added a test
> asserting `RequireRole` redirects IT_STAFF/Requester away from
> `/admin/users`. 251 server tests (+3 new) and 52 client tests (+2 new)
> pass.

#### PR #70: E2E specs, full screenshot manifest, visual inspection — Changes Requested (@projectnewy, 2026-09-18)

> **Reviewer Feedback:** Six findings, one blocking. Opened by noting this
> PR was "a real step up in rigor" from the PR #68 incident — the
> three honestly-unchecked checklist items and the `ai-use.md`
> process-deviation admission were checked against the actual code and
> both held up exactly as described, and the `login()` helper's ARIA-role
> fix was confirmed as a genuine fix rather than a workaround. Blocking:
> (1) every new spec authenticates as a `regression-suite-*` fixture
> account that is only ever created as a lazy side effect of the server's
> own vitest suite touching `testAuth.ts` — absent from `seed.ts`, with no
> `globalSetup` in `playwright.config.ts` either — so the "13/13 passing"
> claim was not reproducible from a genuinely fresh database; it only
> worked because the local dev DB had already accumulated those rows from
> a different test suite. Worth fixing: (2) the Claim-ticket step's
> `isVisible().catch(() => false)` guard meant a future regression hiding
> the Claim button entirely would report green instead of failing, since
> the following assertion only checked the button was gone, not that
> claiming actually happened; (3) `shoot(..., "all")` left the page stuck
> at mobile viewport afterward, worked around with three scattered ad hoc
> resets across two spec files while a third spec never got the same fix;
> (4) a checked-off checklist item described a UI state (Owner as
> "static text" vs. a select) that doesn't exist in the actual component.
> Minor: (5) a checked-off item claimed more than its backing test
> verified (that status badges are drawn from a declared 7-color scale,
> not just that they differ from priority badges); (6) the
> forbidden/not-found checklist item was only tested for two forbidden
> scenarios, never a genuine not-found ticket ID.
>
> **Author Response (@vienggg):** All six addressed. (1) Added
> `e2e/lab-03/global-setup.ts`, wired via `playwright.config.ts`'s
> `globalSetup`, running the same `ensureRegression*()` upserts directly
> before any spec, independent of any other suite ever having run —
> required moving `testAuth.ts`'s `app` import to a lazy dynamic import
> since `app.ts`'s `import.meta.url` isn't valid under Playwright's module
> resolution for this repo. Verified for real by corrupting the three
> fixture rows via Prisma and re-running the suite to confirm global setup
> repairs them before the first login. (2) The Claim step now asserts the
> button is visible before clicking and asserts the owner value actually
> changed afterward. (3) Fixed the viewport-stickiness once in `shoot()`
> itself (captures and restores the pre-call viewport), removed the three
> ad hoc resets. (4) Corrected the checklist wording — Owner is always one
> `<select>` with "Unassigned" as one of its own options; left honestly
> unchecked rather than checked against a state that doesn't exist. (5)
> Narrowed the claim to match what's actually tested, and flagged the
> underlying gap (the 7-color scale isn't wired into any CSS yet) as a
> separate follow-up rather than fixing it here or leaving the checkmark
> inflated. (6) Added a genuine not-found-ticket test —
> `StaffTicketDetail.tsx` already handled the case correctly; only the
> test coverage was missing. 14/14 Playwright tests pass (13 original + 1
> new).

---

## 3. Reviewer Availability Agreement

@NinjoMUDA and the author coordinated directly (outside this log) that PR
review would continue alongside Lab 3 the same way it did for Lab 1 and Lab 2.
Eleven feature/docs branches are expected to move through
`Backlog → Specified → Started → PR Review → Fixing → Done`, one active Issue
at a time, with the author never merging their own PR.
