# Lab 3 REST API Contract — TokTickIT

All endpoints are prefixed `/api`. Authentication is a JWT carried in an httpOnly,
`SameSite=Lax` cookie named `toktickit_session` (2-hour expiry). There is no
bearer-token header; every authenticated request relies on the browser (or a
`curl` cookie jar) sending that cookie automatically.

## Conventions

* **Content type:** `application/json` request and response bodies unless noted.
* **Error shape:** `{ "error": { "code": string, "message": string } }`. Messages
  are safe for display and never leak stack traces, ORM errors, or another
  user's data.
* **Status codes:**
  | Code | Meaning |
  |---|---|
  | 400 | Validation failure — malformed body or query parameter |
  | 401 | No valid session |
  | 403 | Authenticated but not permitted for this role/action |
  | 404 | Resource not found, **or** deliberately masked (see BR-32) |
  | 409 | Conflict — duplicate email, illegal status transition, last-Administrator rule |
  | 500 | Unexpected server error — generic message only |

---

## 1. Authentication

### `POST /api/auth/login`
Public. Body: `{ email, password }`.
* 200 → `{ user: { id, name, email, role, mustChangePassword } }`, sets the
  session cookie.
* 401 → generic invalid-credentials error (BR-06) — identical whether the email
  exists or not.
* 403 → `{ error: { code: "ACCOUNT_INACTIVE", ... } }` when the password is
  correct but the account is deactivated (BR-07).

### `POST /api/auth/logout`
Requires a session. Clears the cookie. 204. Idempotent — succeeds even if
already logged out (BR-08).

### `GET /api/auth/me`
Requires a session. 200 → `{ id, name, email, role, department, mustChangePassword }`.
Never returns `passwordHash`. 401 if no valid session.

### `POST /api/auth/change-password`
Requires a session. Body: `{ currentPassword, newPassword, confirmPassword }`.
* 200 → clears `mustChangePassword`, returns the refreshed user object.
* 400 → password policy violation (BR-09), mismatch (BR-11), or new equals
  initial password on a forced change (BR-10).

---

## 2. Requester Ticket and Attachment APIs (Lab 2 continuation, re-scoped)

All `requesterId` query/body parameters from Lab 2 are **removed**. Ownership is
derived exclusively from the session (BR-03, FR-08).

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/tickets` | Lists only the authenticated Requester's Tickets. Same search/filter/sort/pagination contract as Lab 2. |
| `POST` | `/api/tickets` | Creates a Ticket owned by the authenticated Requester. |
| `GET` | `/api/tickets/:id` | 404 if the Ticket does not belong to the authenticated Requester (BR-32) — not 403. |
| `PATCH` | `/api/tickets/:id` | Edits summary/description/priority before IT triage; 404 if not owned. |
| `POST` | `/api/tickets/:id/attachments` | Unchanged from Lab 2, ownership-scoped. |
| `DELETE` | `/api/tickets/:id/attachments/:attId` | Soft-removal, unchanged from Lab 2, ownership-scoped. |
| `GET` | `/api/tickets/:id/attachments/:attId/download` | Unchanged from Lab 2, ownership-scoped. |

### `POST /api/tickets/:id/resolution-signal`
Requester only, must own the Ticket. No body. 200 → sets `requesterResolvedAt`
and creates an auto-generated Public Comment. Does not change `status` (BR-05,
D-10). 404 if not owned.

---

## 3. Public Comments (shared) and Internal Notes (staff-only)

### `GET /api/tickets/:id/comments`
Requester (own Ticket only), IT Staff, Administrator. 200 → array of
`{ id, ticketId, authorId, authorName, body, createdAt }`.

### `POST /api/tickets/:id/comments`
Same roles as above. Body: `{ body }`, 1–2000 chars, non-blank (BR-23). 201 on
success, 400 on validation failure.

### `GET /api/tickets/:id/internal-notes`
**IT Staff and Administrator only.** A Requester request returns 403 with
**no note data of any kind** in the body (AC-04, BR-24).

### `POST /api/tickets/:id/internal-notes`
Same restriction as above. Body: `{ body }`, same validation as comments.

---

## 4. IT Staff Ticket Queue and Operations

### `GET /api/staff/tickets`
IT Staff, Administrator only. Query parameters:

| Param | Type | Notes |
|---|---|---|
| `search` | string | Matches ticket number, summary, description, requester name/email |
| `status` | enum | One of the 8 `TicketStatus` values, or `All` |
| `itPriority` | enum | `LOW`/`MEDIUM`/`HIGH`/`URGENT`, or `All` |
| `categoryId` | int | |
| `ownerId` | int \| `"unassigned"` | |
| `sort` | enum | `createdAt`, `updatedAt`, `itPriority`, `status`, `ticketNumber` |
| `order` | enum | `asc` \| `desc`, default `desc` |
| `page` | int | default 1 |
| `pageSize` | int | default 10, max 50 |

Response: `{ data: Ticket[], pagination: { page, pageSize, total, totalPages } }`.
An invalid parameter (unknown enum value, non-numeric `page`, `pageSize` > 50)
returns 400 naming the offending field. Default ordering is `updatedAt desc`.

### `GET /api/staff/tickets/:id`
IT Staff, Administrator only. Full operational view including owner, IT
Priority, status, comments, and internal notes.

### `PATCH /api/staff/tickets/:id/owner`
Body: `{ ownerId: number | null }`. `null` unassigns. `ownerId` must reference an
active IT Staff or Administrator user (BR-13) or 400 is returned.

### `PATCH /api/staff/tickets/:id/it-priority`
Body: `{ itPriority }`. IT Staff, Administrator only (BR-16).

### `PATCH /api/staff/tickets/:id/status`
Body: `{ status }`. Validated against the transition matrix in
`specification.md` §6.5. An illegal transition returns 409 with
`{ error: { code: "ILLEGAL_TRANSITION", permitted: [...] } }`. Entering
`IN_PROGRESS` while `ownerId` is null returns 409 (BR-17).

---

## 5. Administrator User Management

### `GET /api/admin/users`
Administrator only. Query: `search` (name or email substring), `role` (optional
filter). No pagination required by scope. 200 → array of
`{ id, name, email, role, isActive }`.

### `POST /api/admin/users`
Body: `{ name, email, role, isActive, initialPassword }`. 201 on success.
409 on duplicate email (case-insensitive, BR-26). 400 on invalid role (BR-24)
or missing fields. New user is created with `mustChangePassword: true`.

### `PATCH /api/admin/users/:id`
Body: any of `{ name, email, role, isActive }`. 409 on duplicate email. 403 if
the request would deactivate or demote the acting Administrator's own account
(BR-27) or leave zero active Administrators (BR-28).

### `POST /api/admin/users/:id/initial-password`
Body: `{ initialPassword }`. Sets a new password hash and
`mustChangePassword: true`. 200 on success.

---

## 6. Authorization Enforcement Summary

Every route above (except `POST /api/auth/login`) passes through:
1. `requireAuth` — 401 if no valid session cookie.
2. `requirePasswordChanged` — 403 if `mustChangePassword` is true and the route
   is not `/api/auth/me`, `/api/auth/change-password`, or `/api/auth/logout`.
3. `requireRole([...])` — 403 if the authenticated role is not in the allowed
   set for that route.
4. Resource-level ownership check where applicable (Requester Ticket routes) —
   404, per BR-32, rather than 403.

This ordering guarantees that a hidden or disabled client control is never the
only thing standing between a user and a forbidden operation.
