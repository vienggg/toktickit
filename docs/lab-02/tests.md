# Lab 2 Test Plan and Traceability Matrix — TokTickIT

This document defines the comprehensive test strategy, implemented test cases across all required test levels, and acceptance-criterion traceability for Lab 2.

---

## 1. Test Strategy & Scope

The testing architecture ensures 100% test coverage across the full vertical stack:
1. **Unit Testing:** Validating isolated pure functions (Ticket Number generation format `TKT-YYYY-XXXXXX`).
2. **API Integration Testing (Supertest + Vitest):** Testing REST API endpoints, multipart file parsing, query filtering, pagination, attachment downloading/soft-delete, and ownership guards against PostgreSQL.
3. **UI Component Testing (Vitest + React Testing Library):** Verifying isolated React component rendering, form validations, attachment file picking, and context switching.
4. **UI Style Testing (Vitest):** Asserting Zen Green CSS design tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`), button states, and class bindings.

---

## 2. Test Execution Summary

| Test Suite | Framework | Total Tests | Passed | Failed | Pass Rate |
|---|---|:---:|:---:|:---:|:---:|
| **Server Unit & API Tests** | Vitest + Supertest | 17 | 17 | 0 | **100%** |
| **Client UI & Style Tests** | Vitest + React Testing Library | 18 | 18 | 0 | **100%** |
| **Total Automated Tests** | — | **35** | **35** | **0** | **100%** |

---

## 3. Implemented Test Table & AC Mapping

| Test ID | Level | AC Mapped | Test Description | Automated Test File | Pass Status |
|---|---|---|---|---|:---:|
| **UNIT-01** | Unit | AC-01 | Ticket Number generator returns exact `TKT-YYYY-XXXXXX` format | `server/tests/lab-02/ticket-number.unit.test.ts` | **PASSED** |
| **API-01** | API | AC-02 | `GET /api/dev/requesters` returns all active requesters | `server/tests/lab-02/dev-requesters.api.test.ts` | **PASSED** |
| **API-02** | API | AC-02 | `GET /api/dev/requesters` excludes inactive requesters | `server/tests/lab-02/dev-requesters.api.test.ts` | **PASSED** |
| **API-03** | API | AC-01 | `POST /api/tickets` creates ticket with valid data & attachments | `server/tests/lab-02/create-ticket.api.test.ts` | **PASSED** |
| **API-04** | API | AC-04 | `POST /api/tickets` rejects missing summary or description | `server/tests/lab-02/create-ticket.api.test.ts` | **PASSED** |
| **API-05** | API | AC-05 | `POST /api/tickets` rejects files > 5MB or invalid MIME types | `server/tests/lab-02/create-ticket.api.test.ts` | **PASSED** |
| **API-06** | API | AC-06 | `GET /api/tickets` returns only tickets matching `requesterId` | `server/tests/lab-02/my-tickets.api.test.ts` | **PASSED** |
| **API-07** | API | AC-07 | `GET /api/tickets` filters by search keyword, category, status | `server/tests/lab-02/my-tickets.api.test.ts` | **PASSED** |
| **API-08** | API | AC-08 | `GET /api/tickets` handles pagination and sorting | `server/tests/lab-02/my-tickets.api.test.ts` | **PASSED** |
| **API-09** | API | AC-09 | `GET /api/tickets/:id` fetches ticket detail and downloads attachment | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASSED** |
| **API-10** | API | AC-11 | `DELETE /api/attachments/:id` soft-removes file setting `isRemoved: true` | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASSED** |
| **API-11** | API | AC-11 | `PUT /api/tickets/:id` updates ticket in New status and guards ownership | `server/tests/lab-02/ticket-detail.api.test.ts` | **PASSED** |
| **UI-01** | UI Comp | AC-02 | DevRequesterContext stores selection and fetches active users | `client/tests/lab-02/DevRequesterContext.test.tsx` | **PASSED** |
| **UI-02** | UI Comp | AC-02 | DevRequesterModal allows switching requesters and handles errors | `client/tests/lab-02/DevRequesterContext.test.tsx` | **PASSED** |
| **UI-03** | UI Comp | AC-03 | CreateTicket form pre-populates locked requester & reference data | `client/tests/lab-02/CreateTicket.test.tsx` | **PASSED** |
| **UI-04** | UI Comp | AC-04 | CreateTicket renders inline field-level validation errors | `client/tests/lab-02/CreateTicket.test.tsx` | **PASSED** |
| **UI-05** | UI Comp | AC-06 | MyTickets renders ticket table and status badges | `client/tests/lab-02/MyTickets.test.tsx` | **PASSED** |
| **UI-06** | UI Comp | AC-07..08 | MyTickets handles search filtering and no-results empty state | `client/tests/lab-02/MyTickets.test.tsx` | **PASSED** |
| **UI-07** | UI Comp | AC-09 | TicketDetail renders view mode with metadata and attachments | `client/tests/lab-02/TicketDetail.test.tsx` | **PASSED** |
| **UI-08** | UI Comp | AC-11 | TicketDetail toggles edit mode and validates/saves modifications | `client/tests/lab-02/TicketDetail.test.tsx` | **PASSED** |
| **STYLE-01** | UI Style | AC-14 | Zen Green CSS tokens, button hierarchy, and responsive layout rules | `client/tests/lab-02/ZenGreenTheme.test.tsx` | **PASSED** |

---

## 4. Test Execution Commands & Outputs

### 4.1 Server Tests (17/17 Passed)
```powershell
cd toktickit/server
npx vitest run
```
```text
 ✓ tests/lab-02/ticket-number.unit.test.ts (3 tests)
 ✓ tests/lab-01/health.test.ts (1 test)
 ✓ tests/lab-01/categories.test.ts (1 test)
 ✓ tests/lab-02/dev-requesters.api.test.ts (2 tests)
 ✓ tests/lab-02/create-ticket.api.test.ts (3 tests)
 ✓ tests/lab-02/my-tickets.api.test.ts (3 tests)
 ✓ tests/lab-02/ticket-detail.api.test.ts (4 tests)

 Test Files  7 passed (7)
      Tests  17 passed (17)
```

### 4.2 Client Tests (18/18 Passed)
```powershell
cd toktickit/client
npx vitest run
```
```text
 ✓ tests/lab-02/ZenGreenTheme.test.tsx (4 tests)
 ✓ tests/lab-02/DevRequesterContext.test.tsx (3 tests)
 ✓ tests/lab-02/TicketDetail.test.tsx (2 tests)
 ✓ tests/lab-02/MyTickets.test.tsx (2 tests)
 ✓ tests/lab-02/CreateTicket.test.tsx (4 tests)
 ✓ tests/lab-01/App.test.tsx (3 tests)

 Test Files  6 passed (6)
      Tests  18 passed (18)
```
