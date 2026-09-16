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
| — | I-5: Requester Public Comments and resolution signal | `feature/lab3-requester-comments` | `lab3-staging` | Pending |

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

---

## 3. Reviewer Availability Agreement

@NinjoMUDA and the author coordinated directly (outside this log) that PR
review would continue alongside Lab 3 the same way it did for Lab 1 and Lab 2.
Eleven feature/docs branches are expected to move through
`Backlog → Specified → Started → PR Review → Fixing → Done`, one active Issue
at a time, with the author never merging their own PR.
