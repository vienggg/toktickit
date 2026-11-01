# Lab 4 REST API Contract — TokTickIT

Extends `docs/lab-03/api-spec.md`. Everything in Lab 3 (cookie session, `/api` prefix, role checks, error shape) stays in force. This document lists only new or changed endpoints. Rule references (BR-xx, AC-xx) point to `specification.md`.

## Conventions

* **Auth:** all endpoints below require the `toktickit_session` cookie and a completed password change (`requireAuth` + `requirePasswordChanged`); otherwise 401 / 403 as in Lab 3.
* **Error shape:** `{ "error": { "code": string, "message": string, ...extra } }`. Extra fields: `permitted` (legal destinations), `blockers` (resolution blockers), `current` (latest record after a conflict), `field` (offending field on 400). Messages are safe to display and never contain stack traces or another user's data.
* **Timestamps:** ISO-8601 UTC strings. Dashboard windows are computed in Asia/Bangkok (BR-30).
* **Versioning:** records that can be edited by several people carry `version` (integer). Writes send `expectedVersion`.
* **Status codes:**

| Code | Meaning in Lab 4 |
|---|---|
| 200 | Success; also an idempotent replay of an earlier create (AC-10) |
| 201 | Created |
| 400 | `VALIDATION_ERROR` — bad or missing field (`error.field` names it) |
| 401 | No valid session |
| 403 | Role not permitted (`FORBIDDEN`) or password change pending |
| 404 | Not found, or masked because the Ticket belongs to another Requester (BR-04) |
| 409 | Conflict: `STALE_UPDATE`, `ILLEGAL_TRANSITION`, `ILLEGAL_ACTION_TRANSITION`, `RESOLUTION_BLOCKED`, `OPEN_ACTIONS_BLOCK_CANCEL`, `TICKET_LOCKED`, `ACTION_LOCKED` |
| 422 | `INVALID_ASSIGNEE` — well-formed request, unacceptable assignee |
| 500 | `INTERNAL_ERROR` — generic message only |

---

## 1. Actions Taken

### Object shapes

**Staff view** (`ActionTaken`)
```json
{
  "id": 12, "ticketId": 340,
  "actionAt": "2026-11-02T03:15:00.000Z",
  "description": "Replaced the faulty network cable at desk 4.",
  "result": "Link restored; speed test 940 Mbps.",
  "status": "COMPLETED",
  "followUpRequired": true,
  "followUpNote": "Check again after the Friday cabling audit.",
  "attachmentNotes": "Photo of the new cable label is in the shared IT folder 'Nov-2026/desk4'.",
  "createdBy": { "id": 7, "name": "Michael Chen" },
  "assignee":  { "id": 9, "name": "Aom Prasert" },
  "updatedBy": null,
  "createdAt": "2026-11-02T03:20:11.000Z",
  "updatedAt": "2026-11-02T03:20:11.000Z",
  "completedAt": "2026-11-02T03:20:11.000Z",
  "version": 1
}
```
**Requester view** has the same fields except `version`, `updatedBy` and `clientRequestId` (never returned).

### `GET /api/tickets/:id/actions`
* **Roles:** Requester (own Ticket), IT Staff, Administrator.
* **200** → `{ "items": ActionTaken[], "total": number }`, ordered `actionAt` asc then `id` asc (AC-12). A Ticket with none returns `{ "items": [], "total": 0 }`.
* **404** — Ticket missing, or owned by another Requester (BR-04).

### `POST /api/staff/tickets/:id/actions`
* **Roles:** IT Staff, Administrator (Requester → 403, BR-03).
* **Body:**

| Field | Type | Rule |
|---|---|---|
| `description` | string | required, 1–2000 after trim (BR-07) |
| `actionAt` | ISO string | optional; default now; ≤ now + 5 min; ≥ Ticket `createdAt` (BR-06) |
| `status` | enum | optional; `PLANNED` (default), `IN_PROGRESS`, `COMPLETED`; `CANCELLED` → 400 (BR-11) |
| `result` | string | optional; **required** (1–2000) when `status = COMPLETED` (BR-08) |
| `assigneeId` | int | optional; default = caller; must be an active `IT_STAFF`/`ADMINISTRATOR` (BR-05) |
| `followUpRequired` | boolean | optional, default `false` |
| `followUpNote` | string | required (1–1000) when `followUpRequired`; ignored/null otherwise (BR-09) |
| `attachmentNotes` | string | optional, ≤ 1000 (BR-10) |
| `clientRequestId` | string | optional, 8–64 chars; idempotency key (BR-26) |

  Any `createdBy`, `createdById`, `ticketId`, `version` in the body is ignored.
* **201** → `ActionTaken` (new row; `createdBy` = caller). Side effect: the Ticket's `updatedAt` is touched in the same transaction.
* **200** → the existing `ActionTaken` when `(ticketId, clientRequestId)` already exists (idempotent replay).
* **400** `VALIDATION_ERROR` · **404** Ticket not found · **409** `TICKET_LOCKED` (BR-14) · **422** `INVALID_ASSIGNEE`.

### `PATCH /api/staff/tickets/:id/actions/:actionId`
* **Roles:** IT Staff, Administrator.
* **Body:** `expectedVersion` (**required** int) plus any subset of `actionAt`, `description`, `result`, `status`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`, validated with the same rules as create, evaluated on the resulting record (e.g. moving to `COMPLETED` needs a result either sent or already stored).
* **200** → updated `ActionTaken` (`version` + 1, `updatedBy` = caller, `completedAt` set on `COMPLETED`).
* **400** missing/invalid `expectedVersion` or field · **404** action not found **for this Ticket** (an `actionId` from another Ticket is 404) · **409** `STALE_UPDATE` (`error.current` = latest record) / `ILLEGAL_ACTION_TRANSITION` (`error.permitted`) / `ACTION_LOCKED` (terminal action, BR-12) / `TICKET_LOCKED` · **422** `INVALID_ASSIGNEE`.
* The update is one `UPDATE … WHERE id = ? AND version = ?`; zero rows updated means stale.

There is **no** `DELETE` for Actions Taken (BR-13): `DELETE` returns 404 (route does not exist).

---

## 2. Ticket Workflow and History

### `GET /api/staff/tickets/:id` (changed)
Adds to the Lab 3 response: `version`, `resolvedAt`, `closedAt`, `resolutionBlockers` (array of codes `NO_OWNER`, `NO_COMPLETED_ACTION`, `OPEN_ACTIONS`; empty when Resolve is allowed), `actionsSummary` `{ total, planned, inProgress, completed, cancelled }`. `permittedStatusTransitions` now already has every gate that can be decided from data applied (e.g. `RESOLVED` is absent while blockers exist, so the UI can show it disabled with the reason from `resolutionBlockers`).

### `PATCH /api/staff/tickets/:id/status` (changed)
* **Body:** `{ status, reason?, expectedVersion? }`.
  * `reason` required (1–500) for `CANCELLED` and `REOPENED` (BR-20, BR-21); optional otherwise.
  * `expectedVersion` optional for Lab 3 compatibility; the Lab 4 client always sends it (BR-25).
* **200** → updated staff Ticket detail (new `status`, `version`, `permittedStatusTransitions`).
* **400** `VALIDATION_ERROR` (unknown status, missing reason).
* **409** — one of:
  * `ILLEGAL_TRANSITION` with `permitted` (Lab 3 behaviour; also for BR-18 owner rule on `IN_PROGRESS`);
  * `RESOLUTION_BLOCKED` with `blockers` (BR-19) — also covers a missing owner for `RESOLVED`;
  * `OPEN_ACTIONS_BLOCK_CANCEL` (BR-20) with `blockers: ["OPEN_ACTIONS"]`;
  * `STALE_UPDATE` with `current` (the latest Ticket detail).
* **Atomicity:** inside one transaction the Ticket row is locked (`SELECT … FOR UPDATE`), the gate is evaluated, the status/version/`resolvedAt`/`closedAt` are updated and one `TicketStatusHistory` row is inserted. Either all happen or none.
* **403** for a Requester.

### `PATCH /api/staff/tickets/:id/owner` and `/it-priority` (changed)
Accept optional `expectedVersion`; on success `version` increases; on mismatch `409 STALE_UPDATE` with `current`. Otherwise unchanged from Lab 3.

### `GET /api/tickets/:id/history`
* **Roles:** Requester (own Ticket, 404 otherwise), IT Staff, Administrator.
* **200** → `{ "items": [ { "id", "fromStatus", "toStatus", "changedBy": { "id", "name" }, "createdAt", "reason" } ] }` ordered `createdAt` asc then `id` asc. `reason` is **omitted for Requesters** (BR-24). Legacy Tickets with no history return `{ "items": [] }`.
* No `POST`/`PATCH`/`DELETE` exists; those methods return 404 (BR-24, AC-18).

---

## 3. Dashboards

Both endpoints are `GET`, return a fixed concise document (no Ticket collections), and set `generatedAt` and `timeZone: "Asia/Bangkok"`. Every `href` is a client route that opens the detailed screen (drill-down). Counts are never null (BR-32).

### `GET /api/dashboard/requester`
* **Roles:** Requester only. IT Staff/Administrator → 403 (AC-23). The scope is always the session user (BR-28); any `requesterId` parameter is ignored.
* **200:**
```json
{
  "generatedAt": "2026-11-02T09:00:00.000Z", "timeZone": "Asia/Bangkok",
  "metrics": {
    "openTickets":         { "count": 3, "href": "/tickets?status=ACTIVE" },
    "waitingForRequester": { "count": 1, "href": "/tickets?status=WAITING_FOR_REQUESTER" },
    "resolved":            { "count": 2, "href": "/tickets?status=RESOLVED" },
    "closed":              { "count": 12, "href": "/tickets?status=CLOSED" }
  },
  "recentlyUpdated":  [ { "id": 1, "ticketNumber": "TKT-2026-000123", "summary": "…", "status": "IN_PROGRESS", "updatedAt": "…", "href": "/tickets/1" } ],
  "recentlyResolved": [ { "id": 2, "ticketNumber": "…", "summary": "…", "status": "RESOLVED", "resolvedAt": "…", "href": "/tickets/2" } ]
}
```

| Metric | Definition |
|---|---|
| `openTickets` | own Tickets with status in the active set (BR-29) |
| `waitingForRequester` | own Tickets with `WAITING_FOR_REQUESTER` |
| `resolved` | own Tickets with `RESOLVED` |
| `closed` | own Tickets with `CLOSED` |
| `recentlyUpdated` | own Tickets, `updatedAt` desc, `id` desc, max 5 |
| `recentlyResolved` | own Tickets with `resolvedAt` in the last 7 Bangkok days and status `RESOLVED`/`CLOSED`, `resolvedAt` desc, max 5 |

### `GET /api/dashboard/staff`
* **Roles:** IT Staff, Administrator. Requester → 403.
* **200:**
```json
{
  "generatedAt": "…", "timeZone": "Asia/Bangkok",
  "metrics": {
    "unassigned":          { "count": 4, "href": "/staff/queue?ownerId=unassigned&status=ACTIVE" },
    "myOwnedTickets":      { "count": 6, "href": "/staff/queue?ownerId=7&status=ACTIVE" },
    "myOpenActions":       { "count": 3, "href": "#my-actions" },
    "pendingFollowUps":    { "count": 2, "href": "/staff/queue?followUp=true&status=ACTIVE" },
    "waitingForRequester": { "count": 5, "href": "/staff/queue?status=WAITING_FOR_REQUESTER" }
  },
  "byStatus":     [ { "status": "NEW", "count": 14, "href": "/staff/queue?status=NEW" } ],
  "byItPriority": [ { "priority": "URGENT", "count": 2, "href": "/staff/queue?itPriority=URGENT&status=ACTIVE" } ],
  "attention":    [ { "id": 5, "ticketNumber": "…", "summary": "…", "status": "OPEN", "itPriority": "URGENT", "requesterSignalledResolved": false, "updatedAt": "…", "href": "/staff/tickets/5" } ],
  "myOpenActionsList": [ { "actionId": 12, "ticketId": 5, "ticketNumber": "…", "description": "first 120 chars…", "status": "IN_PROGRESS", "actionAt": "…", "href": "/staff/tickets/5#actions" } ],
  "recentlyUpdated": [ { "id": 5, "ticketNumber": "…", "summary": "…", "status": "OPEN", "updatedAt": "…", "href": "/staff/tickets/5" } ],
  "userCounts": { "byRole": { "REQUESTER": 440, "IT_STAFF": 7, "ADMINISTRATOR": 4 }, "active": 440, "inactive": 11, "href": "/admin/users" }
}
```
`userCounts` is present **only** for Administrators (BR-37). `byStatus` always has all 8 statuses; `byItPriority` always has all 4 priorities (active Tickets only, BR-35).

| Metric | Definition |
|---|---|
| `unassigned` | active Tickets with `ownerId` null |
| `myOwnedTickets` | active Tickets with `ownerId` = caller |
| `myOpenActions` | Actions Taken with `assigneeId` = caller and status `PLANNED`/`IN_PROGRESS` (BR-33) |
| `pendingFollowUps` | distinct active Tickets with ≥ 1 non-cancelled action where `followUpRequired` (BR-34) |
| `waitingForRequester` | Tickets with `WAITING_FOR_REQUESTER` |
| `attention` | BR-36, max 5 |
| `myOpenActionsList` | caller's open actions, `actionAt` asc, max 5 |
| `recentlyUpdated` | all Tickets, `updatedAt` desc, `id` desc, max 5 |

---

## 4. Changed list filters (drill-down support)

| Endpoint | Change |
|---|---|
| `GET /api/tickets` (Requester) | `status` additionally accepts `ACTIVE` (BR-29 set). Unknown values keep the Lab 3 behaviour (ignored). |
| `GET /api/staff/tickets` | `status` additionally accepts `ACTIVE`; new `followUp=true` (Tickets with ≥ 1 non-cancelled action with follow-up required; any other value → 400). `ownerId=unassigned\|<id>` is unchanged. |

Together these guarantee that each filter-based dashboard `href` leads to a list whose total equals the card count (AC-22). The `#my-actions` anchor on *My Open Actions* is an on-page list capped at 5 rows and is excluded from that guarantee.

---

## 5. Unchanged from Lab 3 (regression scope)
Authentication, change password, categories, systems, Requester Tickets and attachments, Public Comments, Internal Notes, resolution signal, staff queue and detail, owner and IT priority changes, administrator user management, and `GET /api/health`. Their tests run unchanged in intent (AC-30).
