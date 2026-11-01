# Lab 4 — Peer Review Record

**Author:** Garunyapas Danpitakkul (Student ID: 67070503404, GitHub: @vienggg)
**Reviewer:** Phuttipong Phankitnirundorn (Student ID: 67070503430), reviewing through their AI review agent ("phut-ai"); reviews and merges appear on GitHub under [@projectnewy](https://github.com/projectnewy). The author never merges their own PR.
**Peer whose PRs the author reviews:** Dechayut Panyawutvorakul (Student ID: 67070503414, GitHub: [@NinjoMUDA](https://github.com/NinjoMUDA)), repository [NinjoMUDA/Dechayut_3414Lab1](https://github.com/NinjoMUDA/Dechayut_3414Lab1).
**Project Repository:** https://github.com/vienggg/toktickit
**Flow:** `feature/*` → `lab4-staging` → `main` (release PR, tag `lab4-release`)

> This log is appended after every PR, not written at the end of the sprint.

## 1. Pull Requests Authored

| Issue | PR | Branch | Reviews | Status |
|---|---|---|---|---|
| I-1 Sprint 4 engineering contract (#75) | [#84](https://github.com/vienggg/toktickit/pull/84) | `docs/lab4-spec-and-test-plan` → `lab4-staging` | Approved with 4 notes | Merged by @projectnewy |
| I-1 follow-up: review notes (#75) | [#85](https://github.com/vienggg/toktickit/pull/85) | `docs/lab4-spec-review-notes` → `lab4-staging` | Approved | Merged by @projectnewy |
| I-2 Actions Taken data foundation (#76) | [#86](https://github.com/vienggg/toktickit/pull/86) | `feature/lab4-actions-data` → `lab4-staging` | Changes requested, then approved | Merged by @projectnewy |
| I-3 Actions Taken API and workflow (#77) | [#87](https://github.com/vienggg/toktickit/pull/87) | `feature/lab4-actions-and-workflow-api` → `lab4-staging` | Approved | Merged by @projectnewy |
| I-4 Actions Taken and workflow UI (#78) | [#88](https://github.com/vienggg/toktickit/pull/88) | `feature/lab4-actions-ui` → `lab4-staging` | Approved with 1 note | Merged by @projectnewy |
| I-5 Role dashboards (#79) | [#89](https://github.com/vienggg/toktickit/pull/89) | `feature/lab4-dashboards` → `lab4-staging` | Approved | Merged by @projectnewy |
| I-6 Hardening and regression (#80) | [#90](https://github.com/vienggg/toktickit/pull/90) | `feature/lab4-hardening` → `lab4-staging` | Approved | Merged by @projectnewy |
| I-7 Responsive, accessibility, visual inspection (#81) | [#91](https://github.com/vienggg/toktickit/pull/91) | `feature/lab4-visual-a11y` → `lab4-staging` | Approved | Merged by @projectnewy |
| I-8 Release (#82) | [#92](https://github.com/vienggg/toktickit/pull/92) | `release/lab4` → `main` | Approved | Merged by @projectnewy; tag `lab4-release` |
| I-9 Final report (#83) | this PR | `docs/lab4-report-final` → `main` | see the PR | see the PR |

## 2. Review Comments Received and Responses

### PR #84 — Sprint 4 engineering contract (I-1) — Approved with 4 non-blocking notes (@projectnewy)

| # | Reviewer note | Response and where it was fixed |
|---|---|---|
| 1 | AC-22 says every drill-down href lists exactly the card count, but `myOpenActions` links to a capped 5-row anchor list. | Agreed. AC-22, DASH-07 and E2E-06 now apply the count-parity check only to filter-based hrefs; the `#my-actions` anchor is excluded (`specification.md`, `tests.md`, `api-spec.md` §4). |
| 2 | api-spec 409 table omits `OPEN_ACTIONS_BLOCK_CANCEL`. | Added to the status-code table in `api-spec.md`. |
| 3 | `sprint-plan.md` is stale against the spec (hrefs, 300 vs 500 ms). | Marked as a historical plan with a note that the spec documents are the source of truth; threshold and hrefs corrected. |
| 4 | MIG-01 hardcodes real DB row counts. | MIG-01 now reads its baseline from `artifacts/lab-04/pre-migration-snapshot.json` (taken from the pre-migration dump); no literals in the test. |

The author replied on the PR ([comment](https://github.com/vienggg/toktickit/pull/84#issuecomment-6546610097)). Fixes 1–3 are in the docs follow-up PR for Issue #75; fix 4 lands with the I-2 test file.

### PR #85 — I-1 review notes (@projectnewy) — Approved

One wording fix before merge: "his AI review agent" became "their AI review agent". The reviewer identity entry was confirmed correct by the reviewer. Merged by @projectnewy.

### PR #86 — Actions Taken data foundation (I-2) — Changes requested, then approved (@projectnewy)

| # | Reviewer note | Response and where it was fixed |
|---|---|---|
| 1 | **Blocking.** Migration 5 added only one foreign key (`ActionTaken_ticketId_fkey`); `schema.prisma` declares six. Without the others, creator/assignee/history rows have no referential integrity and `prisma migrate dev` would detect drift. | Agreed, my mistake: I extracted the SQL from `prisma migrate diff` with a `sed` range that stopped at the first `RESTRICT ON UPDATE CASCADE;` line. Migration 5 now has all six foreign keys, with the hand-written CHECK constraints and backfill kept (commit 20ecbbf). I added MIG-07, MIG-08 and MIG-09 (the six constraints exist, no schema drift, orphan rows are rejected) and redid the rehearsal: restored the pre-Lab-4 dump, ran `prisma migrate deploy`, seeded, ran the suite. |
| 2 | Typo in the review text ("RemoveUser (RequesterUser)"). | Noted by the reviewer, no change needed. |

Second review: approved after re-reviewing 20ecbbf. **Lesson:** never trim generated SQL by line range, and compare a migration against `prisma migrate diff` before opening the PR.

### PR #87 — Actions Taken API and Ticket workflow (I-3) — Approved (@projectnewy)

No change requests. The reviewer checked the status route (row lock, version, resolution gate and history in one transaction) and the action POST/PATCH locks, and said they did not run the tests and relied on the reported numbers. To make that checkable I re-ran every suite from `main` after the release (see the final report).

### PR #88 — Actions Taken and workflow UI (I-4) — Approved with one note (@projectnewy)

| # | Reviewer note | Response and where it was fixed |
|---|---|---|
| 1 | Non-blocking: Edit and Complete stay enabled while Start or Cancel is in flight. | Agreed. Fixed in PR #90 (I-6): Edit, Complete, Start and Cancel are all disabled while a row action is in flight; test UI-09c. |

### PR #89 — Role dashboards, routing and drill-down (I-5) — Approved (@projectnewy)

No change requests. The reviewer checked that the dashboard endpoints take their scope from the session, that all 8 statuses and 4 priorities are returned, and that the `ACTIVE` and `followUp` filters match the card counts. The reviewer read the diff and did not run the suites. During this work I fixed one defect myself: the Pending Follow-ups link listed closed tickets, so its href now includes `status=ACTIVE`.

### PR #90 — Hardening, README and row-action locking (I-6) — Approved (@projectnewy)

No change requests. The reviewer confirmed the `rowBusy` fix, the UI-09c test and the README additions. I left the signed-out `GET /api/auth/me` 401 in the console because Lab 3 tests API-07 and API-15 require it, and said so in the PR.

### PR #91 — Responsive, accessibility and visual inspection (I-7) — Approved (@projectnewy)

No change requests. The reviewer confirmed the 44 px and reduced-motion CSS, the per-viewport assertions, and that V-12 (contrast) is honestly marked "not measured". The reviewer did not open the screenshots.

### PR #92 — Lab 4 release (I-8) — Approved (@projectnewy)

No change requests. `release/lab4` equals `lab4-staging` (b8026f3) and all 23 commits come from the reviewed PRs #84 to #91. Merged into `main` (merge commit dd73d12); I tagged `lab4-release` on it.

**Not tested by the reviewer:** in every round the reviewer read the diff and did not run the tests. The test results in this report are my own runs.

## 3. Reviewer Availability Agreement

The reviewer is reachable through a message relay; the author sends the repository and PR number after opening each PR and asks for a reply when the review is finished. Issues move through `Backlog → Specified → Started → PR Review → Fixing → Done` (tracked on the GitHub Project board "TokTickIT Kanban"), one active Issue at a time. After each merge the author comments back on the PR.
