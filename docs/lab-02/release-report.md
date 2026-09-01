# Lab 2 Sprint Release Report — TokTickIT

* **Sprint:** Sprint 2 (Lab 2 — TokTickIT Requester Ticketing MVP)
* **Author:** Garunyapas Danpitakkul (Student ID: 67070503404, GitHub: @vienggg)
* **Peer Reviewer:** Dechayut (Student ID: 67070503414, GitHub: @NinjoMUDA)
* **Base Integration Branch:** `lab2-staging`
* **Release Target Branch:** `main`

---

## 1. Executive Summary & Capabilities Delivered

Sprint 2 delivers the full Requester-facing IT support ticketing experience with multi-user isolation:
1. **Development Requester Simulated Login:** Loaded dynamically from PostgreSQL (`GET /api/dev/requesters`), excluding inactive users, persisted in `localStorage`.
2. **Ticket Creation & Multipart Attachments:** Multer-backed file upload (max 5 files, &le; 5MB each, JPG/PNG/WEBP/PDF), unique `TKT-YYYY-XXXXXX` pure ticket number generator, inline field validation, and duplicate-submission prevention via busy states.
3. **My Tickets Multi-Criteria Dashboard:** Paginated ticket catalog with real-time search, multi-criteria filtering (Category, Priority, Status), sorting, and strict requester data isolation.
4. **Ticket Detail & In-Place Edit Mode:** Read-only inspection with priority and status badges, in-place edit mode, and active attachment downloads.
5. **Attachment Soft-Removal Audit Lifecycle:** Soft-removal modal requiring an optional removal reason (`isRemoved: true`), retained metadata, and blocked downloads for soft-removed files.
6. **Cross-Requester Security Protection:** Rejecting non-owned ticket/attachment requests with HTTP 403 Forbidden.

---

## 2. Integrated Feature Pull Requests on `lab2-staging`

| PR # | Title | Branch | Status |
|---|---|---|:---:|
| **#36** | Docs: Sprint 2 Engineering Contracts and Test Plan | `docs/lab2-spec-and-test-plan` | Merged by @NinjoMUDA |
| **#37** | Feat: Database Schema Extension and Seed Data | `feature/database-schema-and-seed` | Merged by @NinjoMUDA |
| **#38** | Feat: Development Requester Context and Simulated Login | `feature/dev-requester-context` | Merged by @NinjoMUDA |
| **#39** | Feat: Create Ticket API, Validation, and Zen Green Form UI | `feature/create-ticket-and-zen-ui` | Merged by @NinjoMUDA |
| **#40** | Feat: My Tickets Screen with Search, Filter, Sort and Pagination | `feature/my-tickets-search-and-filters` | Merged by @NinjoMUDA |
| **#41** | Feat: Ticket Detail Screen, Attachment Lifecycle, and In-Place Edit | `feature/ticket-detail-attachments-and-edit` | Merged by @NinjoMUDA |

---

## 3. Automated Verification & Test Results (29/29 Tests Passing)

* **Server Test Suite (Supertest + Vitest):** 7 test files, 18 tests passing.
* **Client Test Suite (Vitest + React Testing Library):** 5 test files, 11 tests passing.
* **Total:** 29 automated tests passing (100% green).
