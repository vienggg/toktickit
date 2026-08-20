# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude Opus 4.6 & Gemini 3.7 Flash via Antigravity Coding Assistant

---

## 1. Selected Key Prompts (6–10 Exact Prompts Typed)

| # | Exact Prompt Typed | What I Did with the Result |
|---|---|---|
| 1 | `Define sprint 2 specification, API contracts, UI specification, and test plan covering all 13 business rules and 15 acceptance criteria in docs/lab-02/.` | Authored `docs/lab-02/specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` prior to code implementation. |
| 2 | `Extend Prisma schema to support RequesterUser, RelatedSystem, Ticket, and Attachment with soft removal fields, and create an idempotent seed script.` | Generated database migration and seed script for 4 active requesters, 1 inactive requester, 4 categories, and 6 systems. |
| 3 | `Implement GET /api/dev/requesters and React DevRequesterContext with navbar user display and Change Requester action.` | Implemented simulated login context, local storage persistence, and modal selector. |
| 4 | `Implement POST /api/tickets with Multer file upload handling, duplicate submission prevention, and Zen Green Create Ticket form UI.` | Added backend ticket creation route, file constraint checks, form validation, and busy button states. |
| 5 | `Implement GET /api/tickets with requesterId isolation, keyword search, category/status/priority filters, sorting, and pagination.` | Built backend query handler and responsive My Tickets table/card UI with empty and no-results states. |
| 6 | `Implement Ticket Detail view and Attachment lifecycle (upload, download, soft removal with reason, retained metadata, and cross-requester 403 protection).` | Built read-only detail view, attachment endpoints, soft-delete modal, and ownership validation guards. |
| 7 | `Implement Playwright E2E test suite covering full requester flow and multi-viewport responsive layout assertions.` | Automated end-to-end user verification and captured multi-viewport screenshots. |
| 8 | `Compile Lab 2 9-Part Submission Report adhering to minimal Poppins design and grading rubric.` | Generated `report_lab02_67070503404.docx` and `.pdf` with complete evidence captions. |

---

## 2. Reflection

Structuring requests around clear acceptance criteria allowed the AI assistant to produce exact code matches for both Express routes and React component tests. Breaking tasks into issue-focused branches ensured clean Git history and straightforward Pull Requests without breaking existing files.

Establishing custom project governance rules in `shared-tools/md/_AI_EXECUTION_RULES.md` alongside comprehensive Spec DD documentation in `docs/lab-02/` ensured strict alignment with the sprint scope. Specifying test cases upfront across all six required test levels prevented hallucinations and ensured that every edge case (such as soft-removal reason retention and cross-requester access blocking) was rigorously verified before opening Pull Requests.
