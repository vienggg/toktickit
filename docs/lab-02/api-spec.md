# Lab 2 REST API Specification — TokTickIT

This document defines the REST API endpoints, request/response formats, query parameters, error responses, and HTTP status codes for Lab 2.

---

## 1. Global Conventions & Standards

* **Base URL:** `/api`
* **Content-Type:** `application/json` (unless multipart/form-data for uploads)
* **Standard Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | BAD_REQUEST | INTERNAL_ERROR",
    "message": "Human-readable safe error message",
    "details": [
      {
        "field": "summary",
        "message": "Summary is required and must be between 5 and 200 characters"
      }
    ]
  }
}
```

---

## 2. Endpoints Specification

### 2.1 GET `/api/dev/requesters`
* **Purpose:** List all active Development Requesters for the testing selector (inactive requesters excluded).
* **Request:** No parameters.
* **Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.local",
    "isActive": true
  },
  {
    "id": 2,
    "name": "Michael Brown",
    "email": "michael.brown@toktickit.local",
    "isActive": true
  }
]
```

---

### 2.2 GET `/api/categories`
* **Purpose:** Retrieve all ticket categories.
* **Success Response (200 OK):**
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

---

### 2.3 GET `/api/systems`
* **Purpose:** Retrieve all active Related Systems.
* **Success Response (200 OK):**
```json
[
  { "id": 1, "name": "Email", "description": "Corporate Exchange & Webmail" },
  { "id": 2, "name": "Campus Wi-Fi", "description": "Secure campus wireless network" },
  { "id": 3, "name": "VPN", "description": "Remote access gateway" },
  { "id": 4, "name": "LEB2 App", "description": "Learning platform" },
  { "id": 5, "name": "Grade Submission App", "description": "Registrar grading portal" },
  { "id": 6, "name": "Printer", "description": "Network multi-function printers" },
  { "id": 7, "name": "Corporate Laptop", "description": "Standard issue hardware" }
]
```

---

### 2.4 POST `/api/tickets`
* **Purpose:** Create a new ticket with optional initial attachments.
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  - `requesterId` (number, required)
  - `categoryId` (number, required)
  - `relatedSystemId` (number, required)
  - `summary` (string, 5-200 chars, required)
  - `description` (string, 10-2000 chars, required)
  - `requestedPriority` (enum: `LOW` | `MEDIUM` | `HIGH` | `URGENT`, required)
  - `attachments` (files, optional, max 5, <= 5MB each, types: `JPG`, `PNG`, `WEBP`, `PDF`)
* **Success Response (201 Created):**
```json
{
  "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains in less than 30 minutes after update.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "New",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "createdAt": "2026-08-20T10:00:00.000Z",
  "updatedAt": "2026-08-20T10:00:00.000Z",
  "requester": { "id": 1, "name": "Jennifer Anderson" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "attachments": [
    {
      "id": 1,
      "fileName": "battery-report.pdf",
      "fileSize": 1048576,
      "mimeType": "application/pdf",
      "isRemoved": false
    }
  ]
}
```
* **Error Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid ticket data",
    "details": [
      { "field": "summary", "message": "Summary must be at least 5 characters" }
    ]
  }
}
```

---

### 2.5 GET `/api/tickets`
* **Purpose:** List paginated tickets owned by the active Requester with search, filter, and sort.
* **Query Parameters:**
  - `requesterId` (number, required)
  - `search` (string, optional, matches summary/description/ticketNumber)
  - `categoryId` (number, optional)
  - `relatedSystemId` (number, optional)
  - `priority` (string, optional: `LOW` | `MEDIUM` | `HIGH` | `URGENT`)
  - `status` (string, optional: `New`)
  - `sortBy` (string, default `createdAt`, optional: `createdAt` | `requestedPriority` | `ticketNumber`)
  - `sortOrder` (string, default `desc`, optional: `asc` | `desc`)
  - `page` (number, default `1`)
  - `pageSize` (number, default `10`)
* **Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "ticketNumber": "TKT-2026-000001",
      "summary": "Laptop battery drains quickly",
      "requestedPriority": "MEDIUM",
      "currentStatus": "New",
      "createdAt": "2026-08-20T10:00:00.000Z",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "_count": { "attachments": 1 }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

---

### 2.6 GET `/api/tickets/:id`
* **Purpose:** Retrieve read-only ticket details and attachments for an owned ticket.
* **Headers / Query:** `requesterId` (to verify ownership).
* **Success Response (200 OK):**
```json
{
  "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains in less than 30 minutes after update.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "New",
  "createdAt": "2026-08-20T10:00:00.000Z",
  "updatedAt": "2026-08-20T10:00:00.000Z",
  "requester": { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@toktickit.local" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "attachments": [
    {
      "id": 1,
      "fileName": "battery-report.pdf",
      "fileSize": 1048576,
      "mimeType": "application/pdf",
      "isRemoved": false,
      "removedReason": null,
      "removedAt": null,
      "createdAt": "2026-08-20T10:00:00.000Z"
    }
  ]
}
```
* **Error Response (403 Forbidden / 404 Not Found):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view this ticket."
  }
}
```

---

### 2.7 POST `/api/tickets/:id/attachments`
* **Purpose:** Upload a new attachment to an existing owned ticket.
* **Content-Type:** `multipart/form-data`
* **Headers / Query:** `requesterId` (must match ticket owner).
* **Form Field:** `file` (single file, <= 5MB, JPG/PNG/WEBP/PDF).
* **Success Response (201 Created):**
```json
{
  "id": 2,
  "ticketId": 1,
  "fileName": "screenshot.png",
  "fileSize": 524288,
  "mimeType": "image/png",
  "isRemoved": false,
  "createdAt": "2026-08-20T10:15:00.000Z"
}
```

---

### 2.8 GET `/api/attachments/:id/download`
* **Purpose:** Stream active attachment file download.
* **Headers / Query:** `requesterId` (must match ticket owner).
* **Success Response (200 OK):** Binary file stream with `Content-Disposition: attachment; filename="battery-report.pdf"`.
* **Error Response (410 Gone / 404 Not Found):**
```json
{
  "error": {
    "code": "ATTACHMENT_REMOVED",
    "message": "This attachment has been removed and is no longer available for download."
  }
}
```

---

### 2.9 DELETE `/api/attachments/:id`
* **Purpose:** Soft-remove an attachment requiring a reason.
* **Headers / Query:** `requesterId` (must match ticket owner).
* **Request Body:**
```json
{
  "removedReason": "Uploaded incorrect log file."
}
```
* **Success Response (200 OK):**
```json
{
  "id": 1,
  "ticketId": 1,
  "fileName": "battery-report.pdf",
  "isRemoved": true,
  "removedReason": "Uploaded incorrect log file.",
  "removedAt": "2026-08-20T10:30:00.000Z"
}
```
