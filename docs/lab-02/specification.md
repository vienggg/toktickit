# Lab 2 Sprint Engineering Specification — TokTickIT Requester Ticketing MVP

## 1. Sprint Goal
Deliver a robust, responsive, and secure Requester (End-User) ticketing MVP for the TokTickIT service desk application. This sprint establishes a simulated multi-user Development Requester context, Ticket Creation with attachment uploads and validation, My Tickets list with search/filtering/sorting/pagination and strict requester isolation, read-only Ticket Detail view, and an Attachment lifecycle with soft-removal and reason retention, all wrapped in a consistent Zen Green design system.

---

## 2. Stakeholder Request Interpretation
The IT department requires a full-featured Requester interface enabling employees to submit IT support requests with attachments, track their submitted tickets, and manage evidence without unauthorized cross-user access. Before full authentication (passwords/sessions/roles) arrives in Lab 3, a Development Requester selector simulates user login, allowing thorough testing of multi-user ownership and isolation.

---

## 3. Scope

### Included Work
* **Development Requester Selector:** Simulated login modal/selector loading active requesters from PostgreSQL, persisting the active identity in context, displaying it in the application header, and supporting switching.
* **Ticket Creation:** Form capturing Category, Related System, Summary, Requested Priority, Description, and Attachments; generating unique `TKT-YYYY-XXXXXX` numbers and preventing duplicate submissions.
* **My Tickets View:** Listing tickets strictly owned by the active Requester, with real-time text search, filtering by Category, Status, Priority, sorting by date/priority/ticket number, responsive pagination, and empty/no-results states.
* **Ticket Detail & Attachment Lifecycle:** Read-only ticket display, active file downloading, uploading new attachments to existing tickets, and soft-removal requiring a removal reason (retaining metadata while blocking downloads).
* **Cross-Requester Security:** Enforcing strict backend ownership checks to block unauthorized access across users (returning HTTP 403 Forbidden or 404 Not Found).
* **Zen Green Design System:** Cohesive UI tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`) responsive across Desktop (>= 992px), Tablet (768–991px), and Mobile (< 768px).

### Explicitly Excluded Work
* Real authentication: Passwords, password hashing (bcrypt), JWT, sessions, cookie auth, login/logout mechanisms.
* IT Staff workflows: Staff dashboards, queue management, ticket assignment/claiming, changing IT Priority.
* Ticket lifecycle updates beyond creation: Status transitions beyond initial `New` status, resolving, closing, or reopening tickets.
* Collaboration features: Public Comments, Internal Notes, and Actions Taken.

---

## 4. Functional Requirements

* **FR-01 (Development Requester Context):** The system shall provide a Development Requester selector that queries active requesters from the database, allows selection, and establishes the active user testing context.
* **FR-02 (Context Persistence & Switching):** The system shall persist the selected Requester identity across page reloads, display the current identity in the navigation header, and provide a Change Requester action.
* **FR-03 (Ticket Number Generation):** The system shall generate a permanent, unique, official Ticket Number formatted as `TKT-YYYY-XXXXXX` upon ticket creation.
* **FR-04 (Create Ticket Form):** The system shall provide a ticket creation form pre-populated with the active Requester, supporting dropdown selection of active Categories and Related Systems, Summary, Requested Priority, Description, and Attachment upload.
* **FR-05 (Input Validation & Error Recovery):** The system shall validate all form inputs on both client and server, display field-level error messages, and preserve user input values in the event of an API or submission failure.
* **FR-06 (Duplicate Submission Prevention):** The system shall prevent accidental duplicate ticket submissions by disabling the submit button, showing a loading spinner, and rejecting concurrent identical submissions.
* **FR-07 (My Tickets Listing & Isolation):** The system shall display a paginated list of tickets owned exclusively by the active Requester, preventing any tickets belonging to other requesters from appearing.
* **FR-08 (Search, Filter & Sort):** The system shall allow requesters to search tickets by keyword, filter by Category, Status, Priority, and sort by created date, priority, or ticket number.
* **FR-09 (Ticket Detail View):** The system shall display complete, read-only ticket details (header, status badge, priority badge, category, system, description, timestamps) for tickets owned by the active Requester.
* **FR-10 (Attachment Management & Soft Removal):** The system shall allow uploading attachments (up to 5 active, <= 5MB each, JPG/PNG/WEBP/PDF), downloading active files, and soft-removing attachments with a mandatory removal reason.

---

## 5. Mandatory Business Rules (BR)

* **BR-01 (Unique Ticket Number):** The official Ticket Number is generated by the backend database/service, must follow the format `TKT-YYYY-XXXXXX` (where YYYY is the 4-digit year and XXXXXX is a sequential 6-digit zero-padded number), and must be globally unique and immutable.
* **BR-02 (Initial Ticket Status):** Every newly created ticket automatically begins with Current Status `New`. Status changes beyond `New` are out of scope for Lab 2.
* **BR-03 (Testing-Only Requester Selector):** Lab 2 uses a Development Requester selector instead of login. The selected identity is for testing multi-user behavior only and is not secure authentication.
* **BR-04 (Locked Requester & Defaults):** When creating a ticket, the Requester field is pre-populated from the active Development Requester context and cannot be edited. Ticket Date defaults to current timestamp.
* **BR-05 (Requester Switching):** When the active Development Requester is changed, all requester-specific data (My Tickets list, current view) must immediately reload to reflect the newly selected requester.
* **BR-06 (Strict Data Isolation & Ownership):** A Requester can only view, search, open, and manage attachments for tickets they own. Any attempt to access a ticket or attachment belonging to another Requester must be rejected with HTTP 403 Forbidden or 404 Not Found.
* **BR-07 (Search & Filter Behavior):** Search queries match case-insensitively against `summary`, `description`, and `ticketNumber`. Filtering narrows results conjunctively (AND logic).
* **BR-08 (Validation Limits & Duplicate Prevention):** 
  - `summary`: Required, string, 5 to 200 characters, trimmed.
  - `description`: Required, string, 10 to 2000 characters, trimmed.
  - `categoryId`: Required, must match an existing Category ID.
  - `relatedSystemId`: Required, must match an existing active Related System ID.
  - `requestedPriority`: Required, must be one of `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
  - Duplicate Prevention: Submit action is disabled immediately on click; rapid duplicate clicks must not create duplicate records.
* **BR-09 (Safe Failure & Retained Data):** If ticket creation or backend communication fails, an accessible error alert is displayed, and all user-entered field values and selected attachments remain intact in the form.
* **BR-10 (Attachment Rules & Soft Removal):**
  - Allowed MIME types: `image/jpeg` (.jpg/.jpeg), `image/png` (.png), `image/webp` (.webp), `application/pdf` (.pdf).
  - Size limit: Maximum 5 MB (5,242,880 bytes) per file.
  - Quantity limit: Maximum 5 active attachments per ticket.
  - Soft Removal: Removed files are not deleted from the filesystem/DB; instead, `isRemoved` is set to `true`, `removedAt` is recorded, and `removedReason` is required.
  - Download Protection: Removed files remain visible in the UI as metadata (strikethrough/badge with removal reason) but cannot be downloaded (returns 410 Gone / 404).
* **BR-11 (Inactive Requesters):** Requesters marked with `isActive: false` in the database must not appear in the Development Requester selector and cannot be used as the active testing context.
* **BR-12 (Empty States vs. No-Results States):** 
  - An empty state ("No tickets created yet — Click 'Create Ticket' to submit your first request") is displayed when the requester has 0 total tickets.
  - A no-results state ("No tickets found matching your search and filter criteria — Try clearing filters") is displayed when filter criteria return 0 results.
* **BR-13 (Transition to Lab 3 Authentication):** All ownership checks rely on the `requesterId` passed via request context/headers, designed to be seamlessly replaced by JWT/session user claims in Lab 3 without changing core ticket domain models.

---

## 6. UI Specification Summary & Zen Green Theme

* **Design System Tokens:**
  - `Primary Green` (`#006B3C`): App header bar, primary action buttons, focused input borders.
  - `Secondary Green` (`#0B7A46`): Active tabs, hover states, accent links.
  - `Pale Green` (`#EAF6EF`): Selected rows, success alerts, subtle pill badge backgrounds.
  - `Page Background` (`#F5F7F6`): Neutral near-white background.
  - `Surface Cards` (`#FFFFFF`): White cards with subtle `1px solid #E2E8F0` border and light shadow.
  - `Text Primary` (`#1A2E22`): Dark charcoal-green for high contrast readability.
* **Responsive Breakpoints:**
  - **Desktop (>= 992px):** Multi-column form layout, structured data table with sortable column headers, centered layout (max-width 1280px).
  - **Tablet (768px – 991px):** Two-column form layout, responsive table with scroll wrapper or stacked columns.
  - **Mobile (< 768px):** Single-column vertically stacked fields, card-based ticket list, touch-friendly tap targets (min height 44px), zero horizontal scrolling.
* **Field State Rules:**
  - Editable fields: White background, neutral border, dark text.
  - Read-only fields: Soft ivory/gray-green background (`#F1F5F3`), non-interactive, clearly distinct.
  - Error fields: `#DC2626` red border with error text placed immediately below the field.

---

## 7. Data Changes (Prisma Schema)

### Models & Relationships
1. **`RequesterUser`**:
   - `id` (Int, PK, autoincrement)
   - `name` (String, not null)
   - `email` (String, unique, not null)
   - `isActive` (Boolean, default true)
   - `createdAt` (DateTime, default now())
   - *Relation:* `tickets Ticket[]`
2. **`Category`**:
   - `id` (Int, PK, autoincrement)
   - `name` (String, unique, not null)
   - `createdAt` (DateTime, default now())
   - *Relation:* `tickets Ticket[]`
3. **`RelatedSystem`**:
   - `id` (Int, PK, autoincrement)
   - `name` (String, unique, not null)
   - `description` (String, nullable)
   - `isActive` (Boolean, default true)
   - `createdAt` (DateTime, default now())
   - *Relation:* `tickets Ticket[]`
4. **`Ticket`**:
   - `id` (Int, PK, autoincrement)
   - `ticketNumber` (String, unique, not null, indexed)
   - `summary` (String, not null)
   - `description` (String, not null)
   - `requestedPriority` (Enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`, not null)
   - `currentStatus` (String, default "New", not null)
   - `requesterId` (Int, FK -> `RequesterUser.id`, indexed, not null)
   - `categoryId` (Int, FK -> `Category.id`, not null)
   - `relatedSystemId` (Int, FK -> `RelatedSystem.id`, not null)
   - `createdAt` (DateTime, default now(), indexed)
   - `updatedAt` (DateTime, updated now())
   - *Relations:* `requester RequesterUser`, `category Category`, `relatedSystem RelatedSystem`, `attachments Attachment[]`
5. **`Attachment`**:
   - `id` (Int, PK, autoincrement)
   - `ticketId` (Int, FK -> `Ticket.id`, indexed, not null)
   - `fileName` (String, not null)
   - `storedFileName` (String, unique, not null)
   - `fileSize` (Int, not null)
   - `mimeType` (String, not null)
   - `isRemoved` (Boolean, default false, not null)
   - `removedReason` (String, nullable)
   - `removedAt` (DateTime, nullable)
   - `createdAt` (DateTime, default now())
   - *Relation:* `ticket Ticket`

---

## 8. REST API Contract Overview

| Endpoint | Method | Purpose | Auth / Guard | Status Codes |
|---|---|---|---|---|
| `/api/dev/requesters` | `GET` | List active development requesters | Public / Dev | `200`, `500` |
| `/api/categories` | `GET` | List active ticket categories | Public | `200`, `500` |
| `/api/systems` | `GET` | List active related systems | Public | `200`, `500` |
| `/api/tickets` | `POST` | Create new ticket with optional attachments | `requesterId` | `201`, `400`, `500` |
| `/api/tickets` | `GET` | List paginated tickets owned by requester | `requesterId` | `200`, `400`, `500` |
| `/api/tickets/:id` | `GET` | Get read-only ticket details and attachments | Owner Check | `200`, `403`, `404`, `500` |
| `/api/tickets/:id/attachments` | `POST` | Upload attachment to existing ticket | Owner Check | `201`, `400`, `403`, `404`, `500` |
| `/api/attachments/:id/download` | `GET` | Download active attachment file | Owner Check | `200`, `403`, `404`, `410`, `500` |
| `/api/attachments/:id` | `DELETE` | Soft-remove attachment with reason | Owner Check | `200`, `400`, `403`, `404`, `500` |

---

## 9. Acceptance Criteria (AC-01 to AC-15)

* **AC-01 (Ticket Creation Success):** Given a valid ticket payload and active requester context, when submitted, then one Ticket is saved with status `New`, an official unique `TKT-YYYY-XXXXXX` number is generated, matching `requesterId` is stored, and HTTP 201 is returned.
* **AC-02 (Dev Requester Selection):** Given the application loads with no requester selected, when the selector is opened, then only active requesters (`isActive: true`) are displayed, and selecting one stores the identity in context.
* **AC-03 (Pre-populated Requester & Reference Data):** Given the Create Ticket screen is opened, then the Requester field is pre-populated and locked, and Category and Related System dropdowns contain active options loaded from the database.
* **AC-04 (Form Validation Failure):** Given required fields (Summary, Description, Category, System, Priority) are empty or violate length limits, when submitted, then submission is halted, field-level error messages appear, and HTTP 400 is returned.
* **AC-05 (Attachment Constraints & Rejection):** Given a file exceeding 5MB or with an unsupported extension (e.g. `.exe`), when selected, then it is rejected with a clear error; given valid files (<= 5MB, JPG/PNG/WEBP/PDF), up to 5 are accepted.
* **AC-06 (My Tickets Requester Isolation):** Given Requester A is selected, when opening My Tickets, then only tickets belonging to Requester A are returned; when switching to Requester B, Requester A's tickets disappear and only Requester B's tickets are shown.
* **AC-07 (Search & Filtering):** Given a keyword or filter is entered in My Tickets, when applied, then only tickets matching the search string and selected Category/Status/Priority are displayed.
* **AC-08 (Sorting & Pagination):** Given a list of tickets exceeding page size, when clicking page numbers or column sort headers, then the correct paginated and sorted slice is displayed with total count metadata.
* **AC-09 (Cross-Requester Ticket Detail Guard):** Given Requester B is active, when requesting Ticket Detail for a ticket owned by Requester A, then access is denied with HTTP 403 Forbidden or 404 Not Found.
* **AC-10 (Add Attachment to Existing Ticket):** Given an owned ticket with fewer than 5 active attachments, when a valid file is uploaded via Ticket Detail, then it is saved and appears in the attachments list.
* **AC-11 (Attachment Soft Removal with Reason):** Given an active attachment on an owned ticket, when the user confirms soft-removal and provides a removal reason, then `isRemoved` is set to `true`, `removedReason` and `removedAt` are saved, and the file row displays strikethrough metadata.
* **AC-12 (Blocked Download of Soft-Removed File):** Given an attachment that has been soft-removed, when attempting to download it, then the request is rejected with HTTP 410 Gone or 404 Not Found.
* **AC-13 (Responsive Layout & Viewport Conformance):** Given the application is rendered on Desktop (1440px), Tablet (768px), and Mobile (375px), then layouts adapt cleanly, fields stack on mobile, and zero horizontal page scrolling occurs.
* **AC-14 (Accessibility & Non-Color Indicators):** Given form controls and buttons are navigated via keyboard, then visible focus rings are maintained, and all validation errors include explicit text messages rather than color alone.
* **AC-15 (Empty and No-Results States):** Given a requester with 0 tickets or a search query matching 0 tickets, then appropriate empty-state or no-results messages with actionable guidance are rendered.

---

## 10. Product Definition of Done

1. **Scope Completion:** All 10 Functional Requirements and 13 Business Rules are fully implemented.
2. **Acceptance Satisfaction:** All 15 Acceptance Criteria pass with verified automated tests.
3. **Passing Test Suite:** 100% of automated tests (Unit, API, UI Component, UI Style, Responsive, and E2E) pass on the final `main` branch with zero skipped or flaky tests.
4. **Visual & Responsive Verification:** Layout verified across Desktop (1440px), Tablet (768px), and Mobile (375px) with all 25 screenshot artifacts captured.
5. **Code & Architecture Quality:** Clean TypeScript code, Prisma migrations applied, idempotent seeding verified, and zero lint errors.
6. **Documentation & Traceability:** `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, and `ai-use.md` fully completed and traceable.
7. **Peer Review & Git Compliance:** All 7 GitHub Issues progressed through the 6-column Kanban, PRs peer-reviewed and merged by @NinjoMUDA into `lab2-staging`, and released to `main`.

---

## 11. Assumptions and Decisions

* **Attachment Storage:** Attachments are stored on local disk under `toktickit/server/uploads/` with UUID-prefixed filenames (`storedFileName`) to prevent filesystem collision, while retaining original `fileName` in database metadata.
* **Idempotency Strategy:** Client-side button disables immediately upon submission; backend wraps Ticket + Attachment creation inside a `prisma.$transaction`.
* **Soft Removal Policy:** Physical files are retained in storage for audit trails, but API routes strictly disallow binary streaming once `isRemoved === true`.
