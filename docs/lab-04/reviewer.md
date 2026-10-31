# Lab 4 — Peer Review Record

**Author:** Garunyapas Danpitakkul (Student ID: 67070503404, GitHub: @vienggg)
**Reviewer:** Phuttipong Phankitnirundorn (Student ID: 67070503430), reviewing through their AI review agent ("phut-ai"); reviews and merges appear on GitHub under [@projectnewy](https://github.com/projectnewy). The author never merges their own PR.
**Peer whose PRs the author reviews:** Dechayut Panyawutvorakul (Student ID: 67070503414, GitHub: [@NinjoMUDA](https://github.com/NinjoMUDA)), repository [NinjoMUDA/Dechayut_3414Lab1](https://github.com/NinjoMUDA/Dechayut_3414Lab1).
**Project Repository:** https://github.com/vienggg/toktickit
**Flow:** `feature/*` → `lab4-staging` → `main` (release PR, tag `lab4-release`)

> This log is appended after every PR, not written at the end of the sprint.

## 1. Pull Requests Authored

| Issue | PR | Branch | Status |
|---|---|---|---|
| I-1 Sprint 4 engineering contract (#75) | [#84](https://github.com/vienggg/toktickit/pull/84) | `docs/lab4-spec-and-test-plan` → `lab4-staging` | Approved and merged by @projectnewy |

## 2. Review Comments Received and Responses

### PR #84 — Sprint 4 engineering contract (I-1) — Approved with 4 non-blocking notes (@projectnewy)

| # | Reviewer note | Response and where it was fixed |
|---|---|---|
| 1 | AC-22 says every drill-down href lists exactly the card count, but `myOpenActions` links to a capped 5-row anchor list. | Agreed. AC-22, DASH-07 and E2E-06 now apply the count-parity check only to filter-based hrefs; the `#my-actions` anchor is excluded (`specification.md`, `tests.md`, `api-spec.md` §4). |
| 2 | api-spec 409 table omits `OPEN_ACTIONS_BLOCK_CANCEL`. | Added to the status-code table in `api-spec.md`. |
| 3 | `sprint-plan.md` is stale against the spec (hrefs, 300 vs 500 ms). | Marked as a historical plan with a note that the spec documents are the source of truth; threshold and hrefs corrected. |
| 4 | MIG-01 hardcodes real DB row counts. | MIG-01 now reads its baseline from `artifacts/lab-04/pre-migration-snapshot.json` (taken from the pre-migration dump); no literals in the test. |

The author replied on the PR ([comment](https://github.com/vienggg/toktickit/pull/84#issuecomment-6546610097)). Fixes 1–3 are in the docs follow-up PR for Issue #75; fix 4 lands with the I-2 test file.

## 3. Reviewer Availability Agreement

The reviewer is reachable through a message relay; the author sends the repository and PR number after opening each PR and asks for a reply when the review is finished. Issues move through `Backlog → Specified → Started → PR Review → Fixing → Done` (tracked on the GitHub Project board "TokTickIT Kanban"), one active Issue at a time. After each merge the author comments back on the PR.
