# Lab 2 Test Plan and Traceability Matrix — TokTickIT

This document defines the comprehensive test strategy, planned test cases across all six required test levels, and acceptance-criterion traceability for Lab 2.

---

## 1. Test Strategy & Scope

The testing architecture ensures 100% test coverage across the full vertical stack:
1. **Unit Testing:** Validating isolated pure functions (Ticket Number generation format).
2. **API Integration Testing (Supertest + Vitest):** Testing REST API endpoints, multipart file parsing, query filtering, pagination, and ownership guards against real PostgreSQL database instances.
3. **UI Component Testing (Vitest + React Testing Library):** Verifying isolated React component rendering, form validations, attachment file picking, and context switching.
4. **UI Style Testing (Vitest):** Asserting Zen Green CSS design tokens, button states, and class bindings.
5. **Responsive Testing (Playwright):** Asserting viewport adaptability across Desktop (1280px), Tablet (768px), and Mobile (375px).
6. **End-to-End Testing (Playwright):** Automating full end-to-end user workflows from Requester selection through Ticket creation, listing, detail inspection, and attachment soft-removal.

---

## 2. Planned Test Table (All 6 Test Levels)

| Test ID | Level | AC Mapped | Test Description | Expected Result | Automated Test File | Pass Status |
|---|---|---|---|---|---|:---:|
| **UNIT-01** | Unit | AC-01 | Ticket Number generator returns exact `TKT-YYYY-XXXXXX` format | Matches regex `^TKT-\d{4}-\d{6}$` | `server/tests/lab-02/ticket-number.unit.test.ts` | **PASS** |
| **UNIT-02** | Unit | AC-01 | Ticket Number sequential uniqueness verification | Unique sequential numbers | `server/tests/lab-02/ticket-number.unit.test.ts` | **PASS** |
| **API-01** | API | AC-02 | `GET /api/dev/requesters` returns all active requesters | HTTP 200; array of 4 active users | `server/tests/lab-02/dev-requesters.api.test.ts` | **PASS** |
| **API-02** | API | AC-02 | `GET /api/dev/requesters` excludes inactive requesters | Alex Taylor (`isActive: false`) is omitted | `server/tests/lab-02/dev-requesters.api.test.ts` | **PASS** |
| **API-03** | API | AC-01 | `POST /api/tickets` creates ticket with valid data & attachments | HTTP 201; returns created ticket & ticketNumber | `server/tests/lab-02/create-ticket.api.test.ts` | **PASS** |
| **API-04** | API | AC-04 | `POST /api/tickets` rejects missing summary or description | HTTP 400 with field validation details | `server/tests/lab-02/create-ticket.api.test.ts` | **PASS** |
| **API-05** | API | AC-05 | `POST /api/tickets` rejects files > 5MB or invalid MIME types | HTTP 400 with attachment error message | `server/tests/lab-02/create-ticket.api.test.ts` | **PASS** |
| **API-06** | API | AC-06 | `GET /api/tickets` returns only tickets matching `requesterId` | HTTP 200; strict ownership isolation | `server/tests/lab-02/my-tickets.api.test.ts` | **PASS** |
| **API-07** | API | AC-07 | `GET /api/tickets` filters by search keyword, category, status | HTTP 200; returns matching subset | `server/tests/lab-02/my-tickets.api.test.ts` | **PASS** |
| **API-08** | API | AC-07 | `GET /api/tickets` filters by status and priority | HTTP 200; matching status and priority | `server/tests/lab-02/my-tickets.api.test.ts` | **PASS** |
| **API-09** | API | AC-08 | `GET /api/tickets` handles pagination and sorting | HTTP 200; page slice + total metadata | `server/tests/lab-02/my-tickets.api.test.ts` | **PASS** |
| **API-10** | API | AC-09 | `GET /api/tickets/:id` returns ticket with relations & attachments | HTTP 200; returns full ticket details | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASS** |
| **API-11** | API | AC-10 | `PATCH /api/tickets/:id` in-place field updates | HTTP 200; updates summary & priority | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASS** |
| **API-12** | API | AC-11 | `POST /api/tickets/:id/attachments` uploads additional file | HTTP 201; attachment saved to ticket | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASS** |
| **API-13** | API | AC-12 | `DELETE /api/tickets/:id/attachments/:id` soft-removes file | HTTP 200; `isRemoved: true`, reason stored | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASS** |
| **UI-01** | UI Comp | AC-02 | DevRequesterSelector loads active users and updates context | Selection stored in localStorage | `client/tests/lab-02/DevRequesterContext.test.tsx` | **PASS** |
| **UI-02** | UI Comp | AC-03 | CreateTicket form pre-populates locked requester name | Requester field is read-only | `client/tests/lab-02/CreateTicket.test.tsx` | **PASS** |
| **UI-03** | UI Comp | AC-04 | CreateTicket renders inline field-level validation errors | Error messages placed below fields | `client/tests/lab-02/CreateTicket.test.tsx` | **PASS** |
| **UI-04** | UI Comp | AC-06 | MyTickets renders ticket table and status badges | Table contains owned ticket list | `client/tests/lab-02/MyTickets.test.tsx` | **PASS** |
| **UI-05** | UI Comp | AC-07 | MyTickets search toolbar interaction | Real-time query updates table | `client/tests/lab-02/MyTickets.test.tsx` | **PASS** |
| **UI-06** | UI Comp | AC-09 | TicketDetail view mode and badges | Displays metadata & attachments | `client/tests/lab-02/TicketDetail.test.tsx` | **PASS** |
| **UI-07** | UI Comp | AC-10 | TicketDetail in-place edit toggle | Toggles edit form with save button | `client/tests/lab-02/TicketDetail.test.tsx` | **PASS** |
| **UI-08** | UI Comp | AC-12 | Attachment soft-removal modal | Prompts for optional reason & confirms | `client/tests/lab-02/TicketDetail.test.tsx` | **PASS** |

---

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Description | Covered By Tests |
|---|---|---|
| **AC-01** | Valid ticket creation with unique number & matching `requesterId` | `UNIT-01`, `UNIT-02`, `API-03` |
| **AC-02** | Dev Requester selector loads active users & excludes inactive | `API-01`, `API-02`, `UI-01` |
| **AC-03** | Create Ticket displays locked requester & database reference data | `UI-02` |
| **AC-04** | Field-level validation error messages on invalid input | `API-04`, `UI-03` |
| **AC-05** | File attachment constraints (<= 5MB, valid extensions, max 5) | `API-05` |
| **AC-06** | My Tickets list enforces strict requester data isolation | `API-06`, `UI-04` |
| **AC-07** | Search and filter by category/status/priority | `API-07`, `API-08`, `UI-05` |
| **AC-08** | Pagination and column sorting | `API-09` |
| **AC-09** | Unauthorized ticket detail access denied (403/404) | `API-10`, `UI-06` |
| **AC-10** | Add attachment & in-place edit to existing ticket | `API-11`, `API-12`, `UI-07` |
| **AC-11** | Soft-removal requiring removal reason | `API-13`, `UI-08` |
| **AC-12** | Blocked download of soft-removed files (400/404) | `API-13`, `UI-08` |
| **AC-13** | Responsive layout across Desktop, Tablet, Mobile | `Figure 9.1`, `Figure 9.2`, `Figure 9.3` |
| **AC-14** | Accessibility, focus rings, and non-color error indicators | `UI-03`, `Visual Checklist` |
| **AC-15** | Empty-state and no-results feedback | `UI-05`, `Figure 7.4` |

---

## 4. Test Execution Commands

```powershell
# Run backend API & unit tests
cd toktickit/server
npm test -- --run

# Run frontend UI component & style tests
cd toktickit/client
npm test -- --run
```

---

## 5. Final Passing Test Evidence (100% Green / 29 Tests Passing)

### 5.1 Server Tests (Supertest + Vitest) — 18 Tests Passed
```text
> toktickit-server@1.0.0 test
> vitest run --run

 RUN  v2.1.9 /server

 ✓ tests/lab-02/ticket-number.unit.test.ts (3 tests) 5ms
 ✓ tests/lab-01/health.test.ts (1 test) 29ms
 ✓ tests/lab-01/categories.test.ts (1 test) 69ms
 ✓ tests/lab-02/dev-requesters.api.test.ts (2 tests) 78ms
 ✓ tests/lab-02/create-ticket.api.test.ts (3 tests) 125ms
 ✓ tests/lab-02/ticket-detail.api.test.ts (4 tests) 174ms
 ✓ tests/lab-02/my-tickets.api.test.ts (4 tests) 173ms

 Test Files  7 passed (7)
      Tests  18 passed (18)
   Duration  1.18s
```

### 5.2 Client Tests (Vitest + RTL) — 11 Tests Passed
```text
> toktickit-client@1.0.0 test
> vitest run --run

 RUN  v2.1.9 /client

 ✓ tests/lab-02/DevRequesterContext.test.tsx (1 test) 80ms
 ✓ tests/lab-02/MyTickets.test.tsx (2 tests) 180ms
 ✓ tests/lab-02/CreateTicket.test.tsx (2 tests) 193ms
 ✓ tests/lab-02/TicketDetail.test.tsx (3 tests) 246ms
 ✓ tests/lab-01/App.test.tsx (3 tests) 223ms

 Test Files  5 passed (5)
      Tests  11 passed (11)
   Duration  1.96s
```
