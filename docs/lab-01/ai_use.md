# Lab 1 — AI Use and Reflection

**LLM/agent used:** Gemini 3.6 Flash (Medium) via Antigravity Coding Assistant

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Plan Lab 1 implementation and review requirements | Verified the four issues, branch strategy, and acceptance criteria |
| 2 | Setup GitHub CLI and authenticate using PAT | Successfully authenticated `gh` CLI for `vienggg` account |
| 3 | Create private GitHub repo and initialize git flow | Created `toktickit` repo, pushed scaffold to `main`, created `lab1-staging` and `feature/1-project-foundation` |
| 4 | Issue 1: Install dependencies and configure env files | Installed `npm` dependencies for server/client, created `.env` files from `.env.example` |
| 5 | Issue 2: Implement `/api/health` check endpoint | Updated `server/src/app.ts` to return HTTP 200 `{ status: "ok", service: "TokTickIT API" }` |
| 6 | Issue 3: Define Prisma `Category` model & seed script | Updated `schema.prisma` with `Category` model and `seed.ts` with idempotent upserts |
| 7 | Issue 4: Implement `/api/categories` & React UI | Added `/api/categories` endpoint, `checkSystem()` API fetch, React loading/success/error UI, and Vitest component tests |
| 8 | PR Workflow and Git Flow release | Merged PRs #1, #2, #3, #4 into `lab1-staging`, opened and merged release PR #5 to `main` |

## Reflection
Structuring requests around clear acceptance criteria allowed the AI assistant to produce exact code matches for both Express routes and React component tests. Breaking tasks into issue-focused branches ensured clean Git history and straightforward Pull Requests without breaking existing files.
