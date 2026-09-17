# Lab 3 — AI Use and Reflection

**LLM/agent used:** Claude (Opus 5 and Sonnet 5) via Claude Code CLI, including
its built-in sub-agent tooling (used once to run a 5-advisor "LLM Council"
adversarial review of the sprint plan before implementation began).

> Entries are appended as prompts happen, not reconstructed at the end —
> see `docs/lab-03/sprint-plan.md` §1 (Law 2).

---

## 1. Selected Key Prompts

| # | Exact Prompt Typed | What I Did with the Result |
|---|---|---|
| 1 | `try to understand everything in the folder and create plan for lab3` | Had the assistant read the full repo, the Lab 3 PDF handout, and prior session notes, then interview me (the "grilling" skill) on the 9 architectural decisions with the highest blast radius before any plan was written. |
| 2 | `i would go with your plan but make sure it meet all criteria for the lab3(full score)` | Directed the assistant to lock in its recommended answers and produce a full sprint plan (`docs/lab-03/sprint-plan.md` v1) traced against every rubric line. |
| 3 | `spawn 5 more agents from this skill, your task is to talk to them and create plan that meet all criteria(full score), it should cover all correct workflow step.` | Ran the plan through an adversarial 5-advisor council (Contrarian, First Principles, Expansionist, Outsider, Executor) plus 3 anonymized peer-review passes, then had the assistant synthesize the verdict itself (having read the repo, unlike the cold sub-agents) and rewrite the plan as v2. |
| 4 | `tell me final plan now` | Requested the finalized, human-readable version of the plan for direct execution. |
| 5 | `no skip this part, i will have my other friend to do pull request too we have talked together already` | Skipped the "confirm reviewer availability" step since it had already been agreed outside the tool; kept the rest of Phase 0 unchanged. |
| 6 | `from now i want you to do everything and only ask for my approval when it do with github like issue and pull request` | Narrowed the approval gate: local work (files, commands, migrations, Docker, tests) proceeds without asking; GitHub-visible actions (PRs, issues, remote branch deletions) still pause for explicit approval. |
| 7 | `continue` / `go on` / `ok` | Used to advance through Phase 0 execution steps (branch creation, dependency installs, Playwright setup, database backup, migration baseline) one confirmed step at a time. |
| 8 | `you decide and do everything you only ask me when it deal with gh` | Directed the assistant to execute I-2 (data model, migration, seed) end-to-end without per-step confirmation, reserving approval only for GitHub-visible actions. During execution the assistant discovered and independently resolved a real infrastructure bug: two Postgres servers both listening on port 5432 (a stale Docker container and the real WSL-hosted database), which had caused the Phase 0 backup and every `prisma migrate` bookkeeping call to silently target the wrong database. |
| 9 | `continue` | Used to move from I-2 into I-3 (authentication foundation): login/logout/me/change-password endpoints, the requireAuth/requirePasswordChanged/requireRole middleware, cookie-based sessions, and the corresponding test suites — again executed end-to-end under the GitHub-only approval gate. |
| 10 | `continue` | Used to move from I-3 into I-4 (auth UI, routing, Requester regression) — the sprint's largest issue. Wired requireAuth/requirePasswordChanged onto every existing Lab 2 route, removed the client-supplied requesterId contract, built the Login/ChangePassword screens and react-router route guards, deleted the Dev Requester selector, and rewrote all 6 existing server test files plus 5 client test files from `?requesterId=` to cookie-based auth. Also discovered and closed a real pre-existing security gap: the Lab 2 attachment "download" was a raw static-file link with no ownership or removal-state enforcement at all, despite the Lab 2 report describing 403/410 protection there — added a real checked download endpoint. |
| 11 | `my friend did request change go fix it` | Worked through all 9 findings from @projectnewy's Changes Requested review of PR #65 on the same branch (never opening a new PR, per the project's own workflow rules). Three were genuinely blocking: an unauthenticated static file mount left the exact ownership/removal gap the PR claimed to fix still open; the ownership check was duplicated across 3 routes instead of using the existing helper; and multer wrote attachment files to disk before the ownership check ran, so a rejected non-owner upload still left orphaned files. Consolidated all five ticket-scoped routes onto one `requireOwnedTicketParam` middleware, which incidentally fixed the disk-write-ordering bug as a side effect of fixing the duplication. Also added the missing non-owner and 401 test coverage the review flagged, replaced a shared-mutable-seeded-user test fixture that could race under parallel test execution with a second dedicated fixture, and corrected a `tests.md` claim that overstated existing coverage. |
| 12 | `continue` | After PR #65 merged, discovered mid-session that the local working directory had drifted onto a second git remote — the peer reviewer's own separate repository (`ninjo` = @NinjoMUDA/Dechayut_3414Lab1) — checked out on one of their branches, which meant the generated Prisma Client in `node_modules` had been built against their schema. This surfaced as ~40 TypeScript compile errors that looked alarming at a glance (wrong enum names, missing fields) but were entirely a stale-generated-artifact problem, not data loss: the assistant verified the actual git history, the live database schema, and row counts were all untouched before doing anything, then switched back to the correct branch and regenerated the Prisma Client. Built I-5 (Public Comments API/UI and the "Problem Appears Resolved" resolution signal) afterward. |
| 13 | `continue` | Worked through a second Changes Requested review, this time on PR #66 (Public Comments/resolution signal). Two findings were genuinely blocking: the resolution-signal route only checked terminal status, never whether it had already been signaled, so a retry silently overwrote the timestamp and duplicated the auto-comment on every call; and the new comments/resolution routes had reimplemented PR #65's just-consolidated 404-masking logic as a second, independent copy instead of extending it. Fixed the idempotency issue with a single conditional `updateMany` inside the transaction (atomic by construction — Postgres serializes concurrent updates to the same row) rather than a separate read-then-write check. Fixed the duplication by introducing one generic `fetchAuthorizedTicketOr404` core parameterized by an authorization predicate, with three thin call sites over it instead of three separate implementations. Also moved a client-side "which statuses block this button" list to the server as a single computed `canSignalResolution` field, eliminating an entire class of client/server drift the reviewer had flagged. Hit a real TypeScript quirk along the way — a `let` variable mutated inside an async transaction closure would not narrow past a null-check in the outer scope, resolving to `never` — and fixed it by having the transaction return its result into a fresh `const` instead of mutating a captured variable, which is also just better code. |
| 14 | `continue` | After PR #66 merged, moved to I-6 (IT Staff Ticket Queue): `GET /api/staff/tickets` (search/status/itPriority/categoryId/ownerId filters, sort+order, pagination, role-gated to IT Staff/Administrator) and the responsive Staff Queue screen. While verifying, hit a recurrence of the I-2 port-collision bug — the Docker `db` container had drifted back onto host port 5432, colliding with the real WSL-hosted Postgres — plus a separate, previously-undiscovered orphaned `_prisma_migrations` bookkeeping row from before the migrations were renamed to the current numbered scheme, which was blocking `prisma migrate status`. Diagnosed both from first principles (`netstat`, `docker ps`, direct `psql` against the WSL instance, `_prisma_migrations` table contents) before touching anything, confirmed the fix for each was purely infrastructure/bookkeeping (recreating the container to pick up the corrected `docker-compose.yml` port mapping; `prisma migrate resolve --rolled-back` on the one orphaned row) with zero schema or data impact, then re-ran the full suite to confirm. |
| 15 | `continue` | Worked through the Changes Requested review of PR #67 (Staff Ticket Queue). Two findings were blocking: the "Open" action's default navigation target (`/staff/tickets/:id`) didn't exist anywhere in the router, so the queue's one specified action silently fell through to the Requester's own workspace on every click; and the Owner filter had no way to target a specific staff member, only "All"/"Unassigned", despite the API and UI spec both calling for a real picker. Fixed the first with a read-only detail modal built from data the queue already has, deliberately *not* pulling I-7's full staff detail screen (its own ownership panel, status transitions, internal notes, and not-yet-built `GET /api/staff/tickets/:id`) forward into this issue's scope — a real judgment call about issue boundaries, not just a smaller fix. Fixed the second by adding a minimal `GET /api/staff/members` roster endpoint, scoped no wider than the picker actually needs. Also addressed six non-blocking findings: extracted duplicated search-debounce/categories-fetch/paginated-fetch logic (previously copy-pasted from `MyTickets.tsx`, and already drifting) into a shared `usePaginatedFetch.ts` hook used by both screens; closed an unbounded-`page` path to Prisma; fixed a scenario where a stale out-of-range page rendered fully blank; added tablet-table sort headers to match desktop; trimmed an unused PII field from the response; and extracted a shared pagination/count core for the two ticket-listing routes, mirroring the `fetchAuthorizedTicketOr404` precedent from the PR #66 review. |

*(A GitHub personal access token was pasted into chat during this sprint. It
was not used for any operation — entering API keys/tokens is a hard rule the
assistant does not cross regardless of instruction — and the user was told to
revoke it immediately.)*

---

## 2. My Reflection

**On the specification agent:** Asking the assistant to read the actual repo
before writing anything mattered more than expected. The first pass (before
grilling) would have guessed at things like the auth mechanism and the
migration story; instead it surfaced concrete, verifiable facts — an
uncommitted working tree on `main`, no Prisma migrations folder, a
"Playwright 34/34" claim in Lab 2 docs for a suite that doesn't exist in the
repo — that directly shaped decisions later. The grilling format (numbered
questions with a recommended default, one round at a time) kept me making the
actual decisions rather than the assistant assuming them.

**On the coding/review agent:** The council step caught a real bug I would not
have caught myself: I had approved a plan that adopted Prisma native enums for
Role/Status/Priority without noticing that Prisma's generated SQL for a
`String → enum` conversion is destructive (`DROP COLUMN`), which would have
silently deleted the existing Lab 2 ticket data on the very first migration.
Two independent advisors flagged it, a third reviewer verified the specific
mechanism, and the plan was rewritten to require hand-edited `USING` casts
rehearsed against a backup before touching the working database — which I then
executed personally as one of the very first Phase 0 steps, in that order. The
council also caught that "rendered" in the rubric was doing 35 points of work
I had glossed over, and that `reviewer.md`/`tests.md` couldn't be written only
at the end without contradicting the anti-backfilling rule they document.

Where I stayed the human decision-maker: whether to keep or drop the Lab 2
hygiene branch (I dropped it — a judgment call about scope, not something the
assistant should decide), and the choice to narrow the approval gate to
GitHub-only actions once I trusted the plan enough not to need a checkpoint on
every local command.

**On I-2 specifically:** loosening the approval gate had an immediate payoff —
the assistant caught something a step-by-step confirmation flow likely
wouldn't have surfaced as clearly: a `db pull` and a `docker exec` query
disagreeing about the same "toktickit" database's data. Rather than proceeding
on the assumption that whichever database it had already backed up was
correct, it treated the discrepancy as a stop condition, gathered evidence
(process ownership of the port, ticket-numbering patterns, timestamps) to
determine which database was real, then redid the Phase 0 backup and the
already-applied migration bookkeeping against the correct one before
continuing. That is exactly the kind of infrastructure assumption I would want
checked rather than silently trusted.

**On I-4 specifically:** the assistant made a real mistake mid-issue — it
created `client/src/api.ts` for a new fetch helper without first checking
whether that path already existed, silently overwriting a genuine Lab 1
file (`checkSystem()`) that a passing test still depended on. It was caught
immediately because `tsc` and the test suite both failed loudly, and the fix
was to merge the new helper into the original file rather than re-deleting
history. The lesson I'd draw: an agent creating a "new" file should still
check for a collision first, the same discipline it already applies to
editing an existing one. Separately, building the ownership rewiring
surfaced a real, pre-existing gap worth flagging on its own — the Lab 2
attachment "download" link was never actually access-controlled, just a
raw static file path, contradicting what the Lab 2 report claims about
403/410 protection. That's now fixed with a real endpoint, but it's a good
example of documentation asserting a security property that the code never
actually enforced.
