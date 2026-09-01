# Lab 2 Test Plan and Traceability Matrix — TokTickIT

This document defines the comprehensive test strategy, planned test cases across all six required test levels, and acceptance-criterion traceability for Lab 2.

---

## 1. Test Strategy & Scope

The testing architecture ensures 100% test coverage across the full vertical stack:
1. **Unit Testing:** Validating isolated pure functions (Ticket Number generation format).
2. **API Integration Testing (Supertest + Vitest):** Testing REST API endpoints, multipart file parsing, query filtering, pagination, and ownership guards against real PostgreSQL database instances.
3. **UI Component Testing (Vitest + React Testing Library):** Verifying isolated React component rendering, form validations, attachment file picking, and context switching.
4. **UI Style Testing (Vitest):** Asserting Zen Green CSS design tokens, button states, and class bindings.
5. **Responsive Testing (Playwright):** Asserting viewport adaptability across Desktop (1440px), Tablet (768px), and Mobile (375px).
6. **End-to-End Testing (Playwright):** Automating full end-to-end user workflows from Requester selection through Ticket creation, listing, detail inspection, and attachment soft-removal.

---

## 2. Planned Test Table (All 6 Test Levels)

| Test ID | Level | AC Mapped | Test Description | Expected Result | Automated Test File | Pass Status |
|---|---|---|---|---|---|:---:|
| **UNIT-01** | Unit | AC-01 | Ticket Number generator returns exact `TKT-YYYY-XXXXXX` format | Matches regex `^TKT-\d{4}-\d{6}$` | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| **API-01** | API | AC-02 | `GET /api/dev/requesters` returns all active requesters | HTTP 200; array of active users | `server/tests/lab-02/dev-requesters.api.test.ts` | Planned |
| **API-02** | API | AC-02 | `GET /api/dev/requesters` excludes inactive requesters | Alex Taylor (`isActive: false`) is omitted | `server/tests/lab-02/dev-requesters.api.test.ts` | Planned |
| **API-03** | API | AC-01 | `POST /api/tickets` creates ticket with valid data & attachments | HTTP 201; returns created ticket & ticketNumber | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-04** | API | AC-04 | `POST /api/tickets` rejects missing summary or description | HTTP 400 with field validation details | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-05** | API | AC-05 | `POST /api/tickets` rejects files > 5MB or invalid MIME types | HTTP 400 with attachment error message | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-06** | API | AC-06 | `GET /api/tickets` returns only tickets matching `requesterId` | HTTP 200; strict ownership isolation | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-07** | API | AC-07 | `GET /api/tickets` filters by search keyword, category, status | HTTP 200; returns matching subset | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-08** | API | AC-08 | `GET /api/tickets` handles pagination and sorting | HTTP 200; page slice + total metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-09** | API | AC-09 | `GET /api/tickets/:id` rejects unauthorized non-owner access | HTTP 403 Forbidden or 404 Not Found | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| **API-10** | API | AC-10 | `POST /api/tickets/:id/attachments` uploads file to existing ticket | HTTP 201; attachment saved to ticket | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-11** | API | AC-11 | `DELETE /api/attachments/:id` soft-removes file requiring reason | HTTP 200; `isRemoved: true`, reason stored | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-12** | API | AC-12 | `GET /api/attachments/:id/download` blocks soft-removed files | HTTP 410 Gone / 404 Not Found | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **UI-01** | UI Comp | AC-02 | DevRequesterSelector loads active users and updates context | Selection stored in localStorage | `client/tests/lab-02/DevRequesterContext.test.tsx` | Planned |
| **UI-02** | UI Comp | AC-03 | CreateTicket form pre-populates locked requester name | Requester field is read-only | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-03** | UI Comp | AC-04 | CreateTicket renders inline field-level validation errors | Error messages placed below fields | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-04** | UI Comp | AC-06 | MyTickets renders ticket table and status badges | Table contains owned ticket list | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| **UI-05** | UI Comp | AC-10..12 | AttachmentSection handles add, download, and soft-remove modal | Modal prompts for removal reason | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| **STYLE-01** | UI Style | AC-14 | Zen Green CSS tokens, button hierarchy, and disabled states | Tokens `#006B3C`, `#0B7A46` applied correctly | `client/tests/lab-02/ZenGreenTheme.test.tsx` | Planned |
| **RESP-01** | Responsive | AC-13 | Responsive layout assertions on Desktop, Tablet, and Mobile | Zero horizontal scroll on 375px viewport | `e2e/lab-02/responsive.spec.ts` | Planned |
| **E2E-01** | E2E | AC-01..15 | Full Requester journey (Select -> Create -> List -> Detail -> Soft Remove) | 100% flow passes successfully | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Description | Covered By Planned Tests |
|---|---|---|
| **AC-01** | Valid ticket creation with unique number & matching `requesterId` | `UNIT-01`, `API-03`, `E2E-01` |
| **AC-02** | Dev Requester selector loads active users & excludes inactive | `API-01`, `API-02`, `UI-01`, `E2E-01` |
| **AC-03** | Create Ticket displays locked requester & database reference data | `UI-02`, `E2E-01` |
| **AC-04** | Field-level validation error messages on invalid input | `API-04`, `UI-03`, `E2E-01` |
| **AC-05** | File attachment constraints (<= 5MB, valid extensions, max 5) | `API-05`, `E2E-01` |
| **AC-06** | My Tickets list enforces strict requester data isolation | `API-06`, `UI-04`, `E2E-01` |
| **AC-07** | Search and filter by category/status/priority | `API-07`, `UI-04`, `E2E-01` |
| **AC-08** | Pagination and column sorting | `API-08`, `UI-04`, `E2E-01` |
| **AC-09** | Unauthorized ticket detail access denied (403/404) | `API-09`, `E2E-01` |
| **AC-10** | Add attachment to existing ticket | `API-10`, `UI-05`, `E2E-01` |
| **AC-11** | Soft-removal requiring removal reason | `API-11`, `UI-05`, `E2E-01` |
| **AC-12** | Blocked download of soft-removed files (410/404) | `API-12`, `UI-05`, `E2E-01` |
| **AC-13** | Responsive layout across Desktop, Tablet, Mobile | `RESP-01`, `E2E-01` |
| **AC-14** | Accessibility, focus rings, and non-color error indicators | `STYLE-01`, `UI-03`, `RESP-01` |
| **AC-15** | Empty-state and no-results feedback | `UI-04`, `API-07`, `E2E-01` |

---

## 4. Test Execution Commands

```powershell
# Run backend API & unit tests
cd toktickit/server
npm test -- --run

# Run frontend UI component & style tests
cd toktickit/client
npm test -- --run

# Run Playwright E2E & responsive tests
cd toktickit
npm run test:e2e
```

---

## 5. Final Passing Test Evidence (Placeholders for Main Branch Release)

### 5.1 Client Tests (Vitest)
```text
[ INSERT CLIENT VITEST OUTPUT FROM MAIN ]
```

### 5.2 Server Tests (Supertest + Vitest)
```text
[ INSERT SERVER SUPERTEST OUTPUT FROM MAIN ]
```

### 5.3 Playwright E2E Tests
```text
[ INSERT PLAYWRIGHT E2E OUTPUT FROM MAIN ]
```
