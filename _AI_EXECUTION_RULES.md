# AI EXECUTION RULES & PROJECT BOUNDARIES

## 1. The "Ask First" Protocol (CRITICAL)
To conserve tokens and prevent errors, operate in a strict step-by-step loop. Never execute a full Issue in one go.
1. **Plan:** Briefly list the exact files you will modify and the terminal commands you will run for the *current small step*.
2. **PAUSE:** Stop generating text entirely. End your response with exactly this phrase: `[Awaiting User Approval to Execute]`.
3. **Execute:** Only after the user replies with "yes", "go", or similar, make the file edits and run the commands.
4. **Report:** Briefly state if the step succeeded or failed, then propose the plan for the next step and PAUSE again.

## 2. Token Efficiency & Anti-Hallucination
* **Zero Yapping:** No conversational filler, pleasantries, or explanations of basic code syntax. Provide only the required output.
* **Strict Scope:** Do not add features outside the current Lab's instructions. Do NOT speculate on future features.
* **No Speculation:** Base all database models, API endpoints, and UI elements strictly on the provided instruction files. If a detail is missing, STOP and ask the user for clarification.
* **No Fabricated Evidence:** Never report a test as "passing" or a step as "done" without actually running the command and showing the real terminal output. Acceptance criteria are only satisfied when verified against the labsheet's exact wording — not assumed.
* **Modern UI:** Ensure the React frontend uses a clean, modern design style using Bootstrap, strictly avoiding any vintage aesthetics.

## 3. What NOT To Do
* **DO NOT** commit directly to `main` or `lab1-staging` (or future staging branches). All work must be done on specific `feature/*` branches, using the exact branch names given in the labsheet (e.g., `feature/2-health-check`).
* **DO NOT** run any file edit or terminal command (including `git commit`, `git push`, `gh pr create`) without first confirming via `git status` / `git branch` that you are on the correct branch for the current Issue.
* **DO NOT** commit `.env`, credentials, or anything matching `.gitignore`. Only `.env.example` (blank template) may be committed.
* **DO NOT** open a Pull Request with `main` as the base unless it is the final Lab 1 release PR. All feature-branch PRs target `lab1-staging` — GitHub defaults the base to `main`, so this must be checked explicitly before creating a PR.
* **DO NOT** start a new Issue until the previous Issue is fully tested, documented, and approved by the user.
* **DO NOT** overwrite or delete the existing starter scaffold unless explicitly replacing it with required logic.
* **DO NOT** combine multiple terminal commands if one depends on the success of the other (e.g., do not run tests if the build fails).

## 4. Silent Documentation Updates
To preserve context without wasting output tokens, silently update the following files, but **do not print their contents in the chat unless asked**. This is critical so a new AI session can instantly resume work.
* `docs/session_state.md` (Master Handoff Document) — update after every approved step, not just at the end of an Issue. It must strictly contain:
    * **Historical Lab/Session Summary:** Cumulative summary of what features, architecture, and configuration were completed in previous labs or sessions.
    * **Current Branch & Active Issue:** (e.g., `feature/1-project-foundation`, Issue 1).
    * **Kanban Status:** Exact placement in the board (Backlog, Specified, Started, PR Review, Fixing, Done) — only move to Done after the user confirms tests pass and PR is merged.
    * **Project Structure:** Updated tree-view of `/client`, `/server`, and `/prisma`, showing which files have been created or modified so far.
    * **Architecture & DB State:** Note if Prisma is initialized, migrations run, or seeding completed.
    * **Task Checklist:** Granular Kanban-style list of what is `[x]` DONE and what is `[ ]` PENDING for the current Issue.
    * **Last Executed Command:** The exact terminal command just run and its exit status (Pass/Fail).
* `docs/lab-01/ai_use.md` — log key prompts and actions taken (adjust folder for future labs).
* `docs/lab-01/tests.md` — update the table of Supertest and Vitest test cases as they're written and run (adjust folder for future labs).
* `docs/lab-01/reviewer.md` — prepare and update peer review details (reviewer name, PR links, comments given/received, and resolutions) as Pull Requests are managed (adjust folder for future labs).

## 5. Report Generation Protocol
* Whenever assigned or asked to create/generate a PDF report, you (and any subagents) MUST read `docs/pdf_report_style.md` first and strictly follow its build method, layout, font, and styling rules.