# Lab 3 Sprint Engineering Specification — TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Sprint Goal
Replace the Lab 2 Development Requester selector with real, session-based authentication, and deliver server-enforced role-based authorization for three roles — Requester, IT Staff, and Administrator. This sprint adds a first-login mandatory password change, a professional IT Staff Ticket Queue and operational Ticket Detail (ownership, IT Priority, an 8-state status workflow, Public Comments, and Internal Notes), a minimalist Administrator User Management screen, and continued regression-safe operation of every Lab 2 Requester function under the authenticated identity.

---

## 2. Stakeholder Request Interpretation
The Development Requester selector was a useful stand-in during Lab 2 but the system now needs real users. Every Requester ticket operation must be driven by an authenticated identity rather than a client-supplied identifier. IT Staff need a shared queue to find and triage work, claim or reassign ownership, set an internal IT Priority independent of what the Requester asked for, and move a Ticket through a defined status lifecycle while communicating with the Requester through Public Comments and privately through Internal Notes. Administrators need a deliberately minimal screen to create accounts, assign exactly one role, edit basic details, activate or deactivate accounts, and issue a new initial password — never to delete a user or manage anything IT Staff already own. Every protected action must be enforced by the backend; a hidden or disabled button is feedback, not a security control.

---

## 3. Scope

### Included Work
* **Authentication:** Email + password login, logout, current-user retrieval, and a mandatory first-login password change that blocks all other application use until satisfied.
* **Role-Based Authorization:** Three roles (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`), each with server-enforced route access; role-specific client navigation that never exposes destinations a role cannot use.
* **Identity Migration:** Evolution of the Lab 2 `RequesterUser` model into the authenticated `User` model without moving any existing row or breaking any existing `Ticket.requesterId` foreign key; removal of the Development Requester selector and its client-side context.
* **Requester Regression:** All Lab 2 Ticket and Attachment functions (create, list, search/filter/sort/pagination, detail, edit, attachment upload/soft-removal/download) continued under the authenticated Requester identity, with ownership derived from the session, never from client input.
* **Requester Communication:** Public Comments on a Requester's own Ticket, and a "Problem Appears Resolved" signal that flags the Ticket without changing its status.
* **IT Staff Ticket Queue:** Search, filters, sorting, and pagination over all Tickets, with clear ownership and status/priority indicators.
* **IT Staff Ticket Detail:** Claim, assign, or reassign ownership; set IT Priority; move status through a defined transition matrix; post Public Comments; record Internal Notes; continued access to Lab 2 Attachments.
* **Administrator User Management:** A single minimalist screen — list with search and optional role filter, create a user with one role and an initial password, edit name/email/role/activation state, set a new initial password, and the three Administrator safety rules (no duplicate email, no self-deactivation, no removing the last active Administrator).
* **Zen Green UI Continuity:** All new screens reuse the existing Zen Green design tokens, form conventions, badges, and responsive rules established in Lab 2.

### Explicitly Excluded Work
* Email invitations, password-reset email, multi-factor authentication, social login, and single sign-on.
* Self-registration or Requester-created accounts.
* Actions Taken by IT Staff (deferred to Lab 4, along with any rule blocking resolution while Actions Taken remain incomplete).
* Formal SLA calculation, escalation rules, and notification services.
* Dashboards and KPI analytics beyond simple queue counts.
* Multi-tenant organizations, departments as a managed concept, and customer administration.
* Multiple roles assigned to one user.
* User deletion, bulk user operations, user import/export, and account-history screens.
* Department, organization, profile-photo, and other extended user-profile management.
* Email delivery of initial passwords or reset links.
* Account unlocking, administrator-approval workflows, and advanced identity-management functions.
* Mandatory pagination, multi-column sorting, and multiple simultaneous filters on the Administrator user list.
* Production-grade deployment or cloud infrastructure changes.

---

## 4. Functional Requirements

### Authentication (FR-01 – FR-06)
* **FR-01:** The system shall authenticate a user by email and password and establish a session on success.
* **FR-02:** The system shall reject authentication for an inactive account without granting a session.
* **FR-03:** The system shall expose a current-user endpoint returning identity, role, and password-change state, and shall never return the password hash.
* **FR-04:** The system shall block access to all application routes except the change-password flow while `mustChangePassword` is true.
* **FR-05:** The system shall allow a user to change their own password, clearing `mustChangePassword` on success.
* **FR-06:** The system shall allow a user to log out, invalidating the client-held session token.

### Authorization (FR-07 – FR-09)
* **FR-07:** Every protected server route shall verify the caller's authenticated identity and role before performing the operation.
* **FR-08:** Requester-scoped operations shall determine ownership solely from the authenticated identity, never from a client-supplied identifier.
* **FR-09:** The client shall render only the navigation and actions permitted for the current user's role; the server shall independently enforce the same restriction regardless of what the client renders.

### Requester Regression and Communication (FR-10 – FR-13)
* **FR-10:** The system shall continue to support Requester Ticket creation, listing, searching, filtering, sorting, pagination, detail viewing, editing, and Attachment upload/soft-removal/download exactly as delivered in Lab 2, scoped to the authenticated Requester.
* **FR-11:** The system shall allow a Requester to post a Public Comment on a Ticket they own.
* **FR-12:** The system shall allow a Requester to indicate that a problem appears resolved without changing the Ticket's status.
* **FR-13:** The system shall prevent a Requester from reading Internal Notes or performing any IT Staff or Administrator operation.

### IT Staff Operations (FR-14 – FR-19)
* **FR-14:** The system shall provide a Ticket Queue to IT Staff and Administrators showing all Tickets with search, filters, sorting, and pagination.
* **FR-15:** The system shall allow an IT Staff or Administrator to claim an unassigned Ticket or reassign an assigned one to any active IT Staff or Administrator user.
* **FR-16:** The system shall allow an IT Staff or Administrator to set IT Priority independently of Requested Priority.
* **FR-17:** The system shall allow an IT Staff or Administrator to change Ticket status only along the permitted transition matrix (§5.5).
* **FR-18:** The system shall allow an IT Staff or Administrator to post Public Comments and Internal Notes on any Ticket.
* **FR-19:** The system shall reject a status change that does not follow the permitted transition matrix, returning the currently permitted set.

### Administrator User Management (FR-20 – FR-26)
* **FR-20:** The system shall provide a user list to Administrators with search by name or email and optional role filtering.
* **FR-21:** The system shall allow an Administrator to create a user with a name, unique email, one role, an activation state, and an initial password.
* **FR-22:** The system shall allow an Administrator to edit a user's name, email, role, and activation state.
* **FR-23:** The system shall allow an Administrator to set a new initial password for a user, forcing a password change at that user's next login.
* **FR-24:** The system shall reject account creation or edits that would produce a duplicate email address or an invalid role value.
* **FR-25:** The system shall prevent an Administrator from deactivating or demoting their own account.
* **FR-26:** The system shall prevent an operation that would leave zero active Administrator accounts.

---

## 5. Business Rules

### Authentication and Session (BR-01 – BR-08)
* **BR-01:** Only an active user with valid credentials may authenticate.
* **BR-02:** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
* **BR-03:** The authenticated user identity, not a `requesterId` supplied by the client, determines ownership of Requester operations.
* **BR-04:** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.
* **BR-05:** A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
* **BR-06:** An invalid email/password combination always returns an identical generic 401 response, regardless of whether the email exists, to avoid revealing account existence.
* **BR-07:** A correct password against an inactive account returns 403 with a deactivation message — the account's existence has already been proven by the correct credential, so this does not leak new information.
* **BR-08:** Logout is idempotent and always succeeds; the session cookie is cleared and expires no later than 2 hours after issuance regardless of activity.

### Password Rules (BR-09 – BR-12)
* **BR-09:** A password must be at least 8 characters and contain at least one letter and one digit.
* **BR-10:** A new password set during a mandatory change must differ from the initial password.
* **BR-11:** A password change requires the new password and its confirmation to match exactly.
* **BR-12:** Passwords are never stored or transmitted in plaintext; only a bcrypt hash is persisted.

### Ownership, Assignment, and Priority (BR-13 – BR-17)
* **BR-13:** A Ticket may have at most one primary Ticket Owner, who must be an active IT Staff or Administrator user.
* **BR-14:** A Ticket may initially be unassigned; claiming sets the owner to the acting IT Staff/Administrator; reassignment may set the owner to any other active IT Staff/Administrator.
* **BR-15:** Requested Priority remains the value submitted by the Requester and is never edited after creation.
* **BR-16:** IT Priority initially copies Requested Priority at Ticket creation and may thereafter be changed only by IT Staff or Administrator.
* **BR-17:** A Ticket may not enter `IN_PROGRESS` while unassigned.

### Status Workflow (BR-18 – BR-20)
* **BR-18:** The required Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
* **BR-19:** A status change is permitted only along the transition matrix in §5.5; any other requested transition is rejected with HTTP 409 and the list of currently permitted destinations.
* **BR-20:** Only IT Staff and Administrator may change Ticket status; a Requester can set no status at all.

### Comments and Notes (BR-21 – BR-24)
* **BR-21:** Public Comments and Internal Notes are append-only in Lab 3; editing and deletion are excluded.
* **BR-22:** Each Comment or Note records its author and creation time from the backend; the client cannot set either value.
* **BR-23:** Empty or whitespace-only content is rejected; content is limited to 1–2000 characters and is rendered as plain text, never as HTML.
* **BR-24:** A request for Internal Notes made by a Requester is rejected with HTTP 403 and returns no note content of any kind.

### Administrator Safety (BR-25 – BR-29)
* **BR-25:** Every user has exactly one role at a time: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
* **BR-26:** An email address must be unique across all users (case-insensitive comparison).
* **BR-27:** An Administrator cannot deactivate or change the role of their own account.
* **BR-28:** The system shall reject any update that would leave zero active Administrator accounts.
* **BR-29:** Deactivation is used instead of deletion; no user account is ever removed.

### Migration and Regression (BR-30 – BR-32)
* **BR-30:** Every `RequesterUser` row from Lab 2 is evolved into a `User` row with `role = REQUESTER`, a documented local-development initial password, and `mustChangePassword = true`; no row is deleted or recreated, and every existing `Ticket.requesterId` continues to reference the same row.
* **BR-31:** No Lab 1 or Lab 2 automated test may regress as a result of the Lab 3 identity migration; ownership-dependent tests are updated to authenticate rather than to pass a raw identifier.
* **BR-32:** A cross-requester request for another Requester's Ticket returns HTTP 404 (not 403), so the response does not reveal whether the Ticket exists; this is a deliberate exception to using 403 for authorization failures, reserved for resource-existence masking only.

---

## 6. Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|
| Login / logout / current user / change password | ✅ (own account) | ✅ (own account) | ✅ (own account) |
| Create / list / view own Tickets | ✅ | — | — |
| Edit own Ticket, manage own Attachments | ✅ | — | — |
| Post Public Comment on own/any Ticket | ✅ (own only) | ✅ (any) | ✅ (any) |
| Indicate "Problem Appears Resolved" | ✅ (own only) | — | — |
| View/read Internal Notes | ❌ (403, no content) | ✅ | ✅ |
| Create Internal Note | ❌ | ✅ | ✅ |
| View IT Staff Ticket Queue | ❌ | ✅ | ✅ |
| Claim / reassign Ticket ownership | ❌ | ✅ | ✅ |
| Set IT Priority | ❌ | ✅ | ✅ |
| Change Ticket status | ❌ | ✅ (per §5.5) | ✅ (per §5.5) |
| View/search/filter User Management list | ❌ | ❌ | ✅ |
| Create / edit user, set initial password | ❌ | ❌ | ✅ |
| Activate / deactivate a user | ❌ | ❌ | ✅ (not self; not last active Admin) |

For Lab 3, Administrator and IT Staff responsibilities remain conceptually separate: an Administrator does not gain IT Staff Ticket operations by role alone, and this matrix is the sole source of truth for what each role may do. Hiding a client control is a usability aid, never a substitute for the server checks in this table.

---

## 6.5. Status Transition Matrix

| From \ To | NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER | RESOLVED | CLOSED | REOPENED | CANCELLED |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **NEW** | — | ✅ | ✅ | — | — | — | — | ✅ |
| **OPEN** | — | — | ✅ | ✅ | ✅ | — | — | ✅ |
| **IN_PROGRESS** | — | — | — | ✅ | ✅ | — | — | ✅ |
| **WAITING_FOR_REQUESTER** | — | — | ✅ | — | ✅ | — | — | ✅ |
| **RESOLVED** | — | — | — | — | — | ✅ | ✅ | — |
| **CLOSED** | — | — | — | — | — | — | ✅ | — |
| **REOPENED** | — | — | ✅ | ✅ | ✅ | — | — | ✅ |
| **CANCELLED** | — | — | — | — | — | — | — | — |

`CANCELLED` is terminal. A Ticket cannot enter `IN_PROGRESS` while `ownerId` is null (BR-17). Any cell not marked ✅ returns HTTP 409 with the row's permitted destinations.

---

## 7. UI Specification Summary
See `ui-spec.md` for the full screen-by-screen specification. In summary: a Login screen and a mandatory Change Password screen gate entry to the application; the authenticated shell replaces the Lab 2 Navbar's Development Requester pill with the current user's name, role badge, and Logout; role-specific navigation shows only permitted destinations; the IT Staff Ticket Queue and Ticket Detail extend the Lab 2 Ticket Detail with ownership, priority, status, and the Public Comment / Internal Note panels rendered as visually distinct blocks; the Administrator screen is a single list-with-modal-forms pattern consistent with Lab 2's card and form conventions. All screens remain usable at 1280px, 768px, and 375px.

---

## 8. Data Changes
* **`User`** (Prisma model, `@@map("RequesterUser")` to preserve the existing physical table and avoid any row movement): adds `role` (enum `Role`), `passwordHash`, `mustChangePassword`, `isActive` (already present), `lastLoginAt`. Retains `name`, `email` (unique), `department`.
* **`Ticket`**: adds `itPriority` (enum `Priority`, backfilled from the existing `priority` column, renamed at the Prisma-field level to `requestedPriority` via `@map("priority")` — no column rename at the database level), `ownerId` (nullable FK to `User`), `requesterResolvedAt` (nullable timestamp). `status` and `priority` are converted from `String` to native Prisma enums (`TicketStatus`, `Priority`) via a hand-verified migration (see below).
* **`PublicComment`** and **`InternalNote`** (new, separate tables): `id`, `ticketId` (FK, cascade delete), `authorId` (FK to `User`), `body` (1–2000 chars), `createdAt`.
* **Enums**: `Role` (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`), `Priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), `TicketStatus` (the 8 values in BR-18).
* **Indexes**: `User(role)`, `User(isActive)`, `Ticket(ownerId)`, `Ticket(itPriority)`, `Ticket(updatedAt)`, `PublicComment(ticketId, createdAt)`, `InternalNote(ticketId, createdAt)`.

### Migration Strategy
Migrations are managed with `prisma migrate` from a `0_init` baseline of the existing Lab 2 schema (verified to contain no destructive statements before being marked applied). Because Prisma's generated SQL for a `String → native enum` conversion issues a destructive `DROP COLUMN`/`ADD COLUMN` pair, every enum-introducing migration is generated with `--create-only`, hand-edited to use `CREATE TYPE` + `ALTER COLUMN ... TYPE ... USING` casts that preserve existing values, and rehearsed against a restored `pg_dump` backup before being applied to the working database. Migration sequence: `0_init` (baseline) → `1_add_enums_and_backfill` → `2_add_user_auth_fields` → `3_add_ticket_workflow_fields` → `4_add_comments_and_notes`. Regression evidence is a before/after row count and `requesterId` comparison, captured in `tests.md`.

### Seed Data
Idempotent (upsert by email): 4 active + 1 inactive Requester (evolved from the 5 existing Lab 2 `RequesterUser` rows); 3 active + 1 inactive IT Staff; 2 active Administrators (to demonstrate both the allowed deactivation case and the last-Administrator block); at least 25 Tickets spanning all 8 statuses, both priority axes, and assigned/unassigned ownership; representative Public Comments and Internal Notes containing no sensitive information. All seeded credentials are for local development only and are documented in `README.md`, never committed as real secrets.

---

## 9. API Contract
See `api-spec.md` for the full endpoint-by-endpoint contract, request/response shapes, and status codes.

---

## 10. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access and returns the permitted user identity and role. |
| AC-02 | Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved. |
| AC-03 | Given an authenticated Requester, when the client supplies another `requesterId`, then the backend still applies the authenticated identity and does not return another Requester's data. |
| AC-04 | Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected without exposing note content. |
| AC-05 | Given invalid credentials, when login is attempted, then the response is a generic 401 that does not reveal whether the email exists. |
| AC-06 | Given an inactive account with a correct password, when login is attempted, then the response is 403 with a deactivation message. |
| AC-07 | Given an authenticated session, when logout is called, then the session cookie is cleared and a subsequent protected request returns 401. |
| AC-08 | Given an unassigned Ticket, when IT Staff claims it, then `ownerId` is set to the acting user and the Ticket becomes eligible for `IN_PROGRESS`. |
| AC-09 | Given a Ticket in `NEW`, when IT Staff requests a transition to `RESOLVED`, then the request is rejected with 409 and the permitted destination set is returned. |
| AC-10 | Given a Requester's own Ticket, when the Requester indicates the problem appears resolved, then a flag is set and the status is unchanged. |
| AC-11 | Given a duplicate email on user creation, when an Administrator submits the form, then the request is rejected with 409 and no user is created. |
| AC-12 | Given the only active Administrator, when that Administrator attempts to deactivate their own account, then the request is rejected. |
| AC-13 | Given the only active Administrator, when an attempt is made to deactivate or demote a different user leaving zero active Administrators, then the request is rejected. |
| AC-14 | Given a user with a newly set initial password, when that user next logs in, then they are forced into the change-password flow before reaching the application. |
| AC-15 | Given a logged-out session, when a client attempts to navigate directly to a protected route, then the client redirects to `/login` and the server independently returns 401 for the underlying API call. |
| AC-16 | Given the Requester Ticket Queue-equivalent (My Tickets) after migration, when an evolved Requester logs in, then all Tickets originally owned by their `RequesterUser` row are still visible and correctly attributed. |
| AC-17 | Given a Requester querying another Requester's Ticket by ID, when the request is made, then the response is 404, not 403, and does not confirm the Ticket's existence. |
| AC-18 | Given the IT Staff Ticket Queue, when an invalid query parameter is supplied, then the response is 400 naming the offending field. |

---

## 11. Definition of Done
* All Functional Requirements (§4) and Business Rules (§5) are implemented and covered by at least one automated test named in `tests.md`.
* The authorization matrix (§6) and status transition matrix (§6.5) are enforced identically on the server regardless of client UI state.
* All 63 pre-existing Lab 1/Lab 2 automated tests pass unmodified in intent (rewritten only to authenticate instead of passing a raw identifier), with zero regression in ticket/attachment behavior.
* The `0_init` → `4_add_comments_and_notes` migration sequence applies cleanly to a restored copy of the pre-Lab-3 database with zero data loss, verified by matching row counts.
* `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are merged into `lab3-staging` before any implementation Issue (I-2 onward) is merged, with a printed timestamp/PR-merge comparison as evidence.
* Every required screen (Login, Change Password, My Tickets/Create/Detail, Staff Queue, Staff Ticket Detail, Administrator User Management) is usable at 1280px, 768px, and 375px with no horizontal overflow.
* `reviewer.md` and `ai-use.md` are updated at every merged PR, not reconstructed at the end of the sprint.
* The final `main` branch contains all ten feature/docs branches merged through `lab3-staging`, tagged `lab3-release`, with the GitHub Project board showing all Issues in `Done`.

---

## 12. Assumptions and Decisions
* **Session mechanism:** JWT (HS256) carried in an httpOnly, `SameSite=Lax` cookie, 2-hour expiry. Chosen because httpOnly eliminates XSS token theft and `SameSite=Lax` covers CSRF without a separate token exchange. Accepted trade-off: a stateless JWT cannot be revoked server-side before expiry; logout clears the cookie client-side and the short expiry bounds the exposure window.
* **Password hashing:** `bcryptjs` at cost factor 10 — pure JavaScript, avoiding native build tooling in the development environment.
* **User identity migration:** `RequesterUser` is renamed to `User` at the Prisma-model level only (`@@map("RequesterUser")`), guaranteeing zero row movement and zero risk to existing `Ticket.requesterId` foreign keys.
* **Comments vs. Notes:** implemented as two separate tables rather than one table with a visibility flag, so a Requester query can never structurally return Internal Note rows.
* **Client routing:** `react-router-dom` v7 (declarative mode: `BrowserRouter`/`Routes`/`Route`, the same API surface as v6) is introduced specifically so that "direct access blocked after logout" (AC-15) is demonstrable via the browser address bar, which was not possible under Lab 2's tab-state navigation. v7 was installed because v6 is no longer npm's published `latest` and is not actively maintained; declarative mode keeps the implementation identical to what a v6-based build would have looked like.
* **Requester resolution signal:** implemented as a boolean/timestamp flag plus an auto-generated Public Comment, never as a status value, so BR-05 cannot be bypassed by a client sending a status field.
* **Error masking exception:** 403 is used for role/permission failures throughout; 404 is used only for the single case of a Requester requesting another Requester's own-Ticket resource, per BR-32, to avoid confirming the Ticket's existence. This is documented here so it is not mistaken for an unenforced route.
