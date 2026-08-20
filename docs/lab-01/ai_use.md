# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Opus 4.6 & Gemini 3.6 Flash via Antigravity Coding Assistant

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Establish AI execution rules and project handoff specifications | Defined `_AI_EXECUTION_RULES.md` (Ask-First protocol, peer review, mode toggles) that evolve alongside the project, and `docs/session_state.md` to capture full project structure and context so if I stop using Antigravity and switch to another AI tool, the new AI assistant can seamlessly take over |
| 2 | Plan Lab 1 implementation and review requirements | Verified the four issues, branch strategy, and acceptance criteria |
| 3 | Setup GitHub CLI and authenticate using PAT | Successfully authenticated `gh` CLI for `vienggg` account |
| 4 | Create private GitHub repo and initialize git flow | Created `toktickit` repo, pushed scaffold to `main`, created `lab1-staging` and `feature/1-project-foundation` |
| 5 | Issue 1: Install dependencies and configure env files | Installed `npm` dependencies for server/client, created `.env` files from `.env.example` |
| 6 | Issue 2: Implement `/api/health` check endpoint | Updated `server/src/app.ts` to return HTTP 200 `{ status: "ok", service: "TokTickIT API" }` |
| 7 | Issue 3: Define Prisma `Category` model & seed script | Updated `schema.prisma` with `Category` model and `seed.ts` with idempotent upserts |
| 8 | Issue 4: Implement `/api/categories` & React UI | Added `/api/categories` endpoint, `checkSystem()` API fetch, React loading/success/error UI, and Vitest component tests |
| 9 | PR Workflow, Release PR, and partner peer reviews | Merged PRs #1-4 into `lab1-staging`, merged release PR #5 to `main`, and reviewed partner PRs on `NinjoMUDA/Dechayut_3414Lab1` |
| 10 | Create PDF report styling and submission specifications | Defined `shared-tools/md/pdf_report_style.md` to enforce standardized LEB2 submission reports, Poppins typography, single accent color, and 4-part structure |

## Reflection
Structuring requests around clear acceptance criteria allowed the AI assistant to produce exact code matches for both Express routes and React component tests. Breaking tasks into issue-focused branches ensured clean Git history and straightforward Pull Requests without breaking existing files.

Establishing custom project governance rules in `_AI_EXECUTION_RULES.md` (such as the Ask-First protocol, mandatory peer review approvals before merge, markdown edit transparency, and dynamic mode toggles) alongside `docs/session_state.md` created an evolving project memory. As project rules improved and expanded across sessions, these living documents ensured that if I stop using Antigravity and switch to another AI tool altogether, any new AI assistant can immediately comprehend the full codebase history, git state, and execution standards without friction.
