# Sprint 3 Execution Plan — TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents — Semester 1/2026
**Author:** Garunyapas Danpitakkul (Vieng) — 67070503404 — [@vienggg](https://github.com/vienggg)
**Peer Reviewer:** Dechayut (Ninjo) — 67070503414 — [@NinjoMUDA](https://github.com/NinjoMUDA)
**Target:** 60 / 60
**Revision:** v2 — hardened after adversarial review. Changes from v1 marked **[R]**.

> This is a working plan, not a graded artifact. The graded artifacts are
> `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`,
> `ai-use.md`, the code, and the single submitted PDF.

---

## 0. The Three Laws of This Sprint

Everything below is detail. These three are the ones that actually decide the grade.

1. **The reviewer is the critical path, not the code.** Eleven issues, one active
   at a time, and you are forbidden from merging your own PRs. Your throughput is
   bounded by how fast @NinjoMUDA clicks Merge. Nothing else in this plan matters
   if that queue stalls.
2. **Evidence is captured *with* each feature, never after.** 30 of 60 points are
   awarded on screenshots and test output. Any deliverable scheduled "at the end"
   gets whatever time is left, and there is never time left.
3. **The grader reads the PDF, not the repo.** Every required `.md` must appear as
   readable content *inside* the PDF. A link is not "rendered."

---

## 1. Locked Architectural Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| D-01 | Session mechanism | JWT (HS256) in an **httpOnly, SameSite=Lax, Path=/** cookie `toktickit_session`, 2h expiry | httpOnly removes the XSS token-theft class; SameSite=Lax covers CSRF without a token dance. Documented trade-off: stateless JWT cannot be revoked server-side, so logout clears the cookie and expiry stays short. |
| D-02 | Password hashing | `bcryptjs`, cost 10 | Pure JS — no native toolchain on Windows. |
| D-03 | User model migration | `RequesterUser` → `User`, **with `@@map("RequesterUser")` pinning the physical table** **[R]** | §5.2 demands existing Ticket ownership stay correct. `@@map` means the model rename is a Prisma-client concept only — **no table rename ever reaches SQL**, so `prisma migrate diff` cannot emit DROP/CREATE. This is load-bearing, not cosmetic. |
| D-04 | Migration tooling | `prisma migrate`; baseline as `0_init`, then hand-verified migrations | Parts 2 and 3 grade migration *evidence*. Only real migration files can be shown to a grader. |
| D-05 | Role / Status / Priority | Prisma native **enums** — **every enum migration hand-edited with `USING` casts** **[R]** | DB rejects invalid roles for free (an Admin acceptance criterion). **Danger:** Prisma generates `DROP COLUMN` + `ADD COLUMN` for String→enum, which destroys all `status`/`priority` data silently. See §4 for the mandatory procedure. |
| D-06 | Comments vs Notes | Two tables: `PublicComment`, `InternalNote` | AC-04 requires rejecting a Requester *without leaking content*. Separate tables make that structural, not a `where` clause someone forgets. |
| D-07 | Client routing | `react-router-dom` v7 (declarative mode, same API as v6) with route guards | Part 5 requires screenshotting "direct access blocked after logout" — impossible without an address bar. v7 installed since v6 is no longer npm's `latest`; declarative mode (`BrowserRouter`/`Routes`/`Route`) keeps the same shape. |
| D-08 | E2E tooling | `@playwright/test` at repo root, **installed in Phase 0** **[R]** | Part 3 wants real passing output. Also powers the screenshot harness (§3). |
| D-09 | Requested Priority | `requestedPriority` with `@map("priority")` | Clean spec-facing name, zero column rename, zero data movement. |
| D-10 | Requester resolution | A flag + auto-generated Public Comment, never a status change | BR-05: a Requester may *indicate* resolution but cannot set Resolved/Closed. |
| D-11 | Error semantics **[R]** | **403** for role violations; **404** for cross-requester resource access | §6.2 mandates not leaking whether another user's ticket exists — hence 404. But an unexplained 404 reads as "broken endpoint" to a grader, so *every* such screenshot carries an inline caption saying the masking is deliberate. |
| D-12 | `mustChangePassword` enforcement **[R]** | A `requirePasswordChanged` middleware applied globally in **I-3**, allowlisting only `/api/auth/me`, `/change-password`, `/logout` | Parts 5 and 8 both fail without it. It is a server concern, decided with the auth foundation — not a client route guard bolted on in I-4. |

---

## 2. Phase 0 — Before Any Code

| Step | Action |
|---|---|
| **0.0** | **[R] Message @NinjoMUDA with the 11-issue list and agree two fixed review windows per day, in writing.** This is step zero for a reason — see Law 1. Record the agreement in `reviewer.md`. |
| 0.1 | **[R]** Create `lab3-staging` from current `main` **first**. |
| 0.2 | **[R]** Branch `docs/lab2-finalization` off `lab3-staging` — **not** `main`. Your own rules forbid a PR based on `main` except the final release PR; v1 got this wrong. |
| 0.3 | Commit the 4 modified files + untracked `docs/session_state.md`. PR → `lab3-staging`, merged by @NinjoMUDA. |
| 0.4 | Tag `lab2-release` on `main` at `a437751` — it does not exist despite Lab 2 docs citing it. |
| 0.5 | Install: server `bcryptjs jsonwebtoken cookie-parser` + types; client `react-router-dom`; root `@playwright/test`. |
| 0.6 | **[R]** Scaffold `playwright.config.ts` and the screenshot harness skeleton (§3) now, empty but runnable. |
| 0.7 | Baseline migrations: `prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script > migrations/0_init/migration.sql`, then `prisma migrate resolve --applied 0_init`. **Confirm the generated SQL contains no DROP.** |
| 0.8 | **[R]** `pg_dump` the current database to `artifacts/lab-03/db-backup-pre-lab3.sql`. Every migration in §4 is rehearsed against a restore of this dump before touching the working DB. |

**Gate:** `git status` clean, `lab3-staging` exists, 63/63 tests still green, backup taken.

---

## 3. The Evidence Harness — built once, used by every issue **[R]**

This is the single highest-leverage change from v1. v1 scheduled ~66 screenshots
as a manual final phase. Instead:

`e2e/lab-03/capture.ts` — a Playwright script that logs in as a given seeded role,
drives a named screen into a named state, and writes to
`artifacts/lab-03/screenshots/<folder>/<Figure>.png` at viewports
`[1280, 768, 375]`.

**Rules:**
- Built in Phase 0, extended by *each* feature issue.
- **No feature PR merges until its own screenshots and its own Playwright spec are in the branch.**
- Re-running the entire manifest after any change costs ~90 seconds, not an evening.

**Folders — exactly the four the handout names** **[R]** (v1 invented a fifth,
`responsive/`; structural mismatches are the cheapest deduction a TA makes):

```
artifacts/lab-03/screenshots/
├── authentication/      ├── staff-ticket-detail/
├── staff-queue/         └── user-management/
```

Responsive variants live *inside* each folder, suffixed `@1280 / @768 / @375`.

---

## 4. Data Model and the Dangerous Migration

Schema as designed in v1 (`User`, `Ticket` + `itPriority`/`ownerId`/
`requesterResolvedAt`, `PublicComment`, `InternalNote`, enums `Role` /
`Priority` / `TicketStatus`), with `@@map("RequesterUser")` on `User` per D-03.

**[R] Mandatory procedure for migration `1_add_enums_and_backfill`:**

Prisma has no rename detection and generates a destructive column replacement for
String → native enum. Left alone it will drop every `status` and `priority` value
in the database.

1. Generate the migration with `--create-only`. **Do not apply it.**
2. Open the SQL. If it contains `DROP COLUMN` on `status` or `priority`, delete
   those lines.
3. Hand-write the safe form:
   ```sql
   CREATE TYPE "TicketStatus" AS ENUM (...);
   ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus"
     USING (CASE "status" WHEN 'In_Progress' THEN 'IN_PROGRESS'
                          WHEN 'New' THEN 'NEW' ... END)::"TicketStatus";
   ```
4. Restore `db-backup-pre-lab3.sql` into a scratch database, apply, and assert
   row counts and value distributions are unchanged.
5. Only then apply to the working database.

Repeat for every subsequent migration. The generated SQL is a draft, never the
artifact.

**Migration sequence:** `0_init` → `1_add_enums_and_backfill` →
`2_add_user_auth_fields` → `3_add_ticket_workflow_fields` →
`4_add_comments_and_notes`.

**Regression proof:** ticket row count and every `requesterId` identical before
and after, captured as terminal output in `tests.md`.

**Seed (idempotent, upsert by email):** 4 active + 1 inactive Requester; 3 active
+ 1 inactive IT Staff; **2 active Administrators** (one to deactivate, one to
prove the last-admin block); ≥25 tickets spanning all 8 statuses, both priority
axes, assigned and unassigned; example comments and notes. Credentials documented
in `README.md` and `specification.md` as local-development-only.

---

## 5. Issue Decomposition

`feature/*` → `lab3-staging` → `main` release PR + tag `lab3-release`.
One active issue at a time. @NinjoMUDA reviews *and* merges every PR.

**[R] Every feature issue's Definition of Done now includes four things v1 left
unassigned:** its own screenshots, its own Playwright spec, an appended
`reviewer.md` entry, and an appended `ai-use.md` prompt log.

| # | Issue | Branch | Delivers | Part |
|---|---|---|---|---|
| I-1 | Sprint 3 engineering contract | `docs/lab3-spec-and-test-plan` | specification / api-spec / ui-spec / tests `.md` | 2, 3 |
| I-2 | Data model, migration, seed | `feature/lab3-user-model-and-migration` | Schema, the hand-edited migrations of §4, seed | 2 |
| I-3 | Authentication foundation | `feature/lab3-auth-foundation` | Login/logout/me/change-password, hashing, `requireAuth` / `requireRole` / **`requirePasswordChanged` (D-12)**, auth + authorization tests | 5 |
| I-4 | Auth shell + Requester regression | `feature/lab3-auth-shell-and-regression` | Router, Login, ChangePassword, role nav, logout, Dev Requester selector deleted, **[R] rewrite of the existing 63 tests from `?requesterId=` to cookie auth — budget this as real work, it is the largest hidden cost in the sprint** | 5 |
| I-5 | Requester comments + resolution | `feature/lab3-requester-comments` | Public Comments, "Problem Appears Resolved" | 7 |
| I-6 | IT Staff Ticket Queue | `feature/lab3-staff-queue` | Queue API + UI, search/filter/sort/pagination | 6 |
| I-7 | IT Staff Ticket Detail | `feature/lab3-staff-ticket-detail` | Ownership, IT Priority, status workflow, comments, notes, **[R] + the §6 authorization transcripts** | 7 |
| I-8 | Administrator User Management | `feature/lab3-user-administration` | Admin list/create/edit/activate/initial-password + safety rules | 8 |
| I-9 | E2E and visual inspection | `feature/lab3-e2e-and-visual` | 3 Playwright specs, full manifest re-run, visual checklist | 3, 9 |
| I-10 | Release integration | `lab3-staging` → `main` | Release PR, tag `lab3-release` | 1 |
| **I-11** | **[R] Final report evidence** | `docs/lab3-report-final` | Final `reviewer.md` (incl. the I-10 merge), final `tests.md` status, Kanban Done screenshot, the PDF | 1, 3, 4 |

**[R] Why I-11 exists:** `reviewer.md` cannot document the merge of the PR that
contains it, and the Kanban screenshot cannot show its own card as Done. v1 tried
to close this loop inside I-10 and could not. Budget one extra review cycle.

---

## 6. Part 7's "Direct API Authorization Evidence" **[R]**

Explicitly owned by **I-7**. v1 left it unassigned.

**A green Vitest line is not this evidence.** The grader needs raw
request/response transcripts. And because D-01 puts the JWT in an httpOnly
cookie, **there is no bearer token to paste** — `curl` must use a cookie jar:

```bash
curl -c jar.txt -X POST localhost:3000/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"jennifer.anderson@toktick.internal","password":"..."}'
curl -b jar.txt -i localhost:3000/api/tickets/42/internal-notes
```

Capture transcripts — method, URL, acting role, status, body — for: Requester →
internal notes (403, empty body), Requester → staff queue (403), Requester →
another Requester's ticket (**404**, captioned as deliberate masking per D-11),
IT Staff → admin users (403), unauthenticated → anything (401), and
`mustChangePassword` user → any app route (403).

Additionally: one **authorization matrix test** printing a role × endpoint grid.
That single output serves Part 7's evidence, Part 3's authorization tests, and
Part 2's authorization matrix at once.

---

## 7. Business Rules, API Contract, Test Plan

Unchanged from v1 and carried forward in full: the 8-row status transition
matrix; business rules across auth, authorization, ownership, comments/notes and
admin safety; the ~18-endpoint API contract; the queue query contract (searchable
/ filterable / sortable fields, pageSize 10 default 50 max, invalid → 400); and
the error taxonomy (400 / 401 / 403 / 404-masked / 409 / 500).

Test files: 9 server (`password.unit`, `status-transitions.unit`, `auth.api`,
`authorization.api`, `staff-queue.api`, `staff-ticket-detail.api`,
`comments-notes.api`, `users-admin.api`, `migration-regression.api`), 5 client
(`Login`, `ChangePassword`, `StaffTicketQueue`, `StaffTicketDetail`,
`UserManagement`), 3 E2E (`authentication`, `staff-ticket-flow`,
`user-administration`).

Traceability columns exactly as the handout specifies: **Test ID · Type ·
Requirement/AC · What It Tests · Expected Result · Automated Test File · Final**.

**[R] `tests.md` must correct the Lab 2 record.** Lab 2's docs report "Playwright
34/34 passing" for a suite that does not exist in the repo — the actual script
lived outside it in `lab2/`. Part 3 invites the grader into these documents.
State plainly what Lab 2's E2E actually was and that Lab 3 introduces
`@playwright/test` properly. An inherited false claim on final `main` is worse
than the gap it covers.

---

## 8. The PDF — where 35 points are won or lost **[R]**

v1 assumed links were enough. They are not. Parts 1, 2, 3, 4 and 9 all say
*rendered*, and a TA marking ~200 submissions clicks nothing.

- **Embed every required `.md` as readable content** under its "Answer Part N:"
  heading — `reviewer.md` (Part 1), `specification.md` (Part 2), `tests.md`
  (Part 3), `ai-use.md` (Part 4), `ui-spec.md` (Part 9). Links go *alongside*
  the content, never instead of it.
- **Part 2 needs a printed timestamp table.** You know I-1 merged first; the
  grader cannot know without running `git log`. Print: I-1 spec PR merged
  `<date/time>` against the merge dates of I-3, I-6, I-7, I-8 — plus a screenshot
  of the merged spec PR header. Without this, a correct spec still reads as
  backfilled, which is the exact failure the rubric was written to catch.
- **Caption authorization screenshots inline**, at the image, not in an appendix.
  Especially every 404 (D-11).
- **Budget the page count.** Six embedded documents plus ~66 screenshots is a very
  large PDF. Screenshots must stay readable without extreme zoom — that is an
  explicit rule and it competes directly with volume. Crop aggressively; one
  screenshot per figure, not contact sheets.
- Headings literally `Answer Part 1:` … `Answer Part 9:`, in order. Build with the
  Lab 2 toolchain and `shared-tools/md/pdf_report_style.md`.

---

## 9. Rubric Traceability

| Part | Pts | Owner | Evidence |
|---|---|---|---|
| 1. Git & Workflow | 10 | I-1..I-11 | Commit graph `feature/*` → `lab3-staging` → `main`; Kanban all Done (screenshot taken in I-11); `reviewer.md` **appended at every merge**; README + `.gitignore`; directory tree |
| 2. Spec DD | 5 | I-1 | Embedded `specification.md` + **merge-timestamp table** proving spec-before-code |
| 3. Test DD | 10 | I-1, I-9, I-11 | Embedded `tests.md`, traceability table, full passing output from `main`, Lab 2 record corrected |
| 4. AI Use | 5 | all issues | `ai-use.md` **appended as prompts happen**, 6–10 key prompts, "My Reflection" |
| 5. Login & Password Change | 5 | I-3, I-4 | `authentication/` screenshots + `auth.api.test.ts` |
| 6. Staff Queue | 5 | I-6 | `staff-queue/` screenshots + `staff-queue.api.test.ts` |
| 7. Staff Ticket Detail | 10 | I-5, I-7 | `staff-ticket-detail/` screenshots + 2 API suites + **§6 cookie-jar transcripts** |
| 8. Admin User Management | 5 | I-8 | `user-management/` screenshots + `users-admin.api.test.ts` |
| 9. Zen Green & Responsive | 5 | I-9 | Embedded `ui-spec.md` + responsive variants + completed visual checklist |

---

## 10. Ranked Risks

1. **Reviewer availability.** Eleven serialized merges through one classmate.
   Mitigated only by step 0.0. Unfixable by code.
2. **The enum migration.** §4 step 2 is the difference between a clean sprint and
   an unrecoverable data loss. Never apply generated SQL unread.
3. **The 63-test rewrite in I-4.** The largest hidden cost. Ripping out
   `?requesterId=` touches ownership setup in nearly every existing test.
4. **PDF legibility.** Embedding six documents and ~66 screenshots while keeping
   everything readable without zoom is a real constraint, not a formatting detail.
5. **Hidden-button authorization.** The handout says it three times. Every
   restriction needs a server test *and* a transcript, never just a missing button.

---

## 11. Open Items

- **No deadline is stated in the handout.** Confirm it — it determines whether
  eleven serialized review cycles are feasible at all, and it is the input to
  step 0.0.
- **Lab 2 E2E backport** — optionally port `lab2/test_all_features_e2e.mjs` into
  `e2e/lab-02/requester-ticket-flow.spec.ts`. Not graded in Lab 3, but it makes
  §7's correction a fix rather than a confession. ~1 hour.
- **Deliberate "Fixing" column cycle** — considered and **rejected**. An empty
  Fixing column costs nothing in the rubric, and manufacturing a
  changes-requested round adds latency to the one resource already on the
  critical path. If a real one occurs, document it well.
