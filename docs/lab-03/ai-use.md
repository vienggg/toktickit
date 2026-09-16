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
