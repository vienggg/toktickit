# Lab 4 — AI Use Log

**LLM used:** Claude (Anthropic) via Claude Code — Opus 5.5 for planning and specification, Sonnet 5.5 for later implementation work.
**Roles:** *Specification agent* (turns the handout into the contract) and *coding agent* (implements against the contract and tests). A separate AI reviewer ("phut-ai") reviews PRs.

## Selected Key Prompts

| # | Prompt (summary) | What it produced | What I checked or changed |
|---|---|---|---|
| 1 | "Continue Lab 4 work, start by planning everything." | Read the labsheet, codebase and Lab 3 plan; wrote `sprint-plan.md` with decisions, data model, metrics and issue list. | Compared with the rubric and found fields the handout body does not list (assignee, action status, append-only history). |
| 2 | "How many issues are we using? 11 or 9 better?" | Compared 11 and 9; recommended 9 with a split rule if a PR exceeds ~1500 lines. | Chose 9 (merged API+workflow and dashboard API+UI). |
| 3 | "Clarify what you understand before start" (workflow: issue in Backlog, move in order, open PR, tell reviewer, continue). | Restated the loop, flagged the missing GitHub Project scope, no AI attribution rule. | Confirmed; labels are used for status until the project scope is granted. |
| 4 | "Write the Lab 4 specification, API spec, UI spec and test plan." | Four consistent documents with FR/BR/AC numbering, matrices, and AC-to-test traceability. | Cross-checked endpoints against `app.ts` (existing error shape, `ownerId=unassigned` filter, `normalizeStatus`) and adjusted drill-down filters to fit the code. |

_(more prompts are added as later issues are completed)_

## My Reflection
_(written in the final report issue, I-9)_
