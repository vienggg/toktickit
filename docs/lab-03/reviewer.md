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
| [#67](https://github.com/vienggg/toktickit/pull/67) | feat(lab3): IT Staff Ticket Queue | `feature/lab3-staff-queue` | `lab3-staging` | Changes Requested → Fixed → re-review pending |

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

---

## 3. Reviewer Availability Agreement

@NinjoMUDA and the author coordinated directly (outside this log) that PR
review would continue alongside Lab 3 the same way it did for Lab 1 and Lab 2.
Eleven feature/docs branches are expected to move through
`Backlog → Specified → Started → PR Review → Fixing → Done`, one active Issue
at a time, with the author never merging their own PR.
