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

| 5 | "Before continue you need to follow every rule in the workflow guide; issue needs to link to the PR and the branch too; put issues on the Kanban board." | Re-read the guide PDF and restated the rules; linked each issue to its branch (`gh issue develop`) and its PR (Development panel); added all issues to the board. | Verified each link with `gh` after the AI said it was done; I had to correct it once for acting before I said to go ahead. |
| 6 | "Phut's AI said the migration is missing foreign keys." (review of PR #86) | Found the cause (a `sed` range that cut the generated SQL after the first foreign key), regenerated migration 5 with all six, added MIG-07 to MIG-09, redid the restore-and-migrate rehearsal. | Checked the rehearsal counts against the pre-migration snapshot myself; recorded the lesson in `reviewer.md`. |
| 7 | "Can you use gh instead of Chrome for the Kanban board?" | Switched board moves to `gh project item-edit`; Chrome is used only for the PR Development-panel link. | Confirmed on the board after each move. |
| 8 | "Phut is sleeping, his AI might not; find a way to connect." and "give me one prompt for Phut's AI". | Opened a Cloudflare tunnel to the relay, explained why the old address was dead, and wrote one short prompt with a GitHub-only backup. | Phut's AI connected on the new address and merged PRs #89 and #90. |
| 9 | "Take the screenshots now." (I-7) | Wrote a Playwright inspection that photographs each Lab 4 screen at three widths and checks overflow, console errors and touch targets; fixed the 44 px and reduced-motion defects it found. | Opened two screenshots and read the measurements; contrast (V-12) was not measured and the checklist says so. |

## What the AI got wrong, and how I caught it
- Migration 5 had one of six foreign keys. The AI trusted its own `sed` extract; the reviewer caught it, not the AI.
- The AI started work (assignees, acceptance criteria, linking a PR) before I said to continue, and I told it to stop and wait.
- The Pending Follow-ups card linked to a list that included closed tickets; a drill-down parity test caught this.

## My Reflection
> **Draft by the AI. Replace this with your own words before you submit.**

Working with an AI agent on this lab made the planning easier and the checking harder. It wrote the specification, tests and code quickly, but it also made confident mistakes: it left five foreign keys out of a migration, and it acted before I told it to. What worked was a fixed routine: one issue at a time, tests first, a pull request for every change, and a second reviewer who is not the author. The reviewer found the missing foreign keys; I would not have caught them by reading the code.

What I would do differently: check every generated migration against the schema before opening the PR, and ask for test counts from a fresh run instead of trusting a number in a message. I also learned that the reviewer read the code but did not run the tests, so the passing results in this report are only as good as my own runs from `main`.
