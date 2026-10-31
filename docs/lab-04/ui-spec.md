# Lab 4 UI Specification — Zen Green Final Application Shell

Extends `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`. Every existing token, button, badge, form, table, card, loading, empty and error convention stays in force and is reused. This document adds only what Lab 4 introduces.

---

## 1. New Design Tokens

| Token | Value | Purpose |
|---|---|---|
| `--color-action-planned` | `#F1F5F9` bg / `#475569` text | Action status `PLANNED` |
| `--color-action-progress` | `#DBEAFE` bg / `#1D4ED8` text | `IN_PROGRESS` |
| `--color-action-completed` | `#D1FAE5` bg / `#047857` text | `COMPLETED` |
| `--color-action-cancelled` | `#FEE2E2` bg / `#991B1B` text | `CANCELLED` |
| `--color-followup` | `#FEF3C7` bg / `#B45309` text | "Follow-up" chip |
| `--zen-metric-value` | `2rem`, weight 700, `--zen-neutral-dark` | Metric number |

Status is never conveyed by colour alone: each badge carries its text label and a leading symbol (○ planned, ◐ in progress, ● completed, ✕ cancelled, ⚑ follow-up).

## 2. Application Shell and Navigation

| Role | Links (in order) | Landing page |
|---|---|---|
| Requester | Dashboard · My Tickets · Create Ticket | `/dashboard` |
| IT Staff | Dashboard · Ticket Queue | `/dashboard` |
| Administrator | Dashboard · Ticket Queue · Users | `/dashboard` |

* The current page link has `aria-current="page"` and the Lab 3 active style (underline + bold); Ticket Detail keeps its parent (My Tickets / Ticket Queue) active.
* The brand link goes to `/dashboard`. The footer's "MVP" wording is replaced by "TokTickIT IT Helpdesk — CPE 334".
* Requester routes: `/dashboard`, `/tickets` (reads `?status=`), `/tickets/new`, `/tickets/:id`. Staff routes: `/dashboard`, `/staff/queue` (reads `status`, `ownerId`, `itPriority`, `followUp`), `/staff/tickets/:id`, `/admin/users`. Unknown role/route combinations show the Lab 3 forbidden or not-found screen; direct URLs work after login.

## 3. Shared Metric Card

* A `<a>` styled as a card (whole card is the link) with: label (small, uppercase), value (`--zen-metric-value`), and a "View all →" affordance. Accessible name: "`<label>`: `<count>`. View list".
* Minimum 44 × 44 px target, visible focus ring (`--zen-focus-ring`), hover darkens the border only.
* **Loading:** skeleton block with `aria-busy="true"`. **Empty (count 0):** value `0` plus a short hint ("No tickets waiting for you"); the card stays a link when a destination exists. **Error:** the card row is replaced by one alert (§8).
* Grid: 5 cards per row ≥ 1200 px, 3 per row ≥ 768 px, 1 per row below 576 px (2 per row between).

## 4. Screen: Requester Dashboard (`/dashboard`, Requester)

1. Heading "Welcome back, *name*" and subtitle "Here's the latest on your requests."; **Refresh** button (re-fetch, disabled while loading).
2. Metric row (4 cards): **My Open Tickets** → `/tickets?status=ACTIVE`, **Waiting for You** → `…=WAITING_FOR_REQUESTER`, **Resolved** → `…=RESOLVED`, **Closed** → `…=CLOSED`. The Waiting card uses the waiting colour accent and the text "Needs your reply" when > 0 (attention cue not based on colour only).
3. **Recently Updated** list (≤ 5): ticket number, summary (truncated with ellipsis, full text in `title`), status badge, updated time; each row links to `/tickets/:id`. Link "View all" → `/tickets`.
4. **Recently Resolved** list (≤ 5) with the same row format and resolved time.
5. **Quick Actions:** Create Ticket, View My Tickets.
* Empty lists show "Nothing here yet." with a Create Ticket link for Recently Updated.
* Does not duplicate My Tickets: no search, filters or pagination.

## 5. Screen: IT Staff / Administrator Dashboard (`/dashboard`)

1. Heading "Welcome back, *name*", subtitle "Here's what's happening with your queue today.", **Refresh**.
2. Metric row (5 cards): **Unassigned**, **My Owned Tickets**, **My Open Actions** (scrolls to the actions list and moves focus to it), **Pending Follow-ups**, **Waiting for Requester**.
3. **By Status** strip (8 chips with counts, each a link) and **By IT Priority** strip (4 chips). Zero counts stay visible (dimmed, still text "0").
4. **Needs Attention** list (≤ 5): number, summary, IT Priority badge, status badge, a "Requester says resolved" badge when applicable.
5. **My Open Actions** list (≤ 5, `id="my-actions"`): ticket number, description (first line), action status badge, action time; row → `/staff/tickets/:id#actions`.
6. **Recently Updated** list (≤ 5).
7. **Administrator only:** a "Users" strip: counts by role and active/inactive, link to `/admin/users`.
8. **Quick Actions:** Ticket Queue, Unassigned Tickets (→ `/staff/queue?ownerId=unassigned&status=ACTIVE`).
* Layout: metrics full width; below, two columns ≥ 992 px (Attention + My Open Actions | Recently Updated + Quick Actions); one column below.
* **Forbidden:** a Requester opening the staff dashboard is redirected to their own dashboard; an API 403 shows the forbidden alert.

## 6. Screen: Staff Ticket Detail additions (`/staff/tickets/:id`)

### 6.1 Ticket summary and status control
* The summary header shows status badge, IT Priority, owner and a version-aware **Status** control.
* The control lists only `permittedStatusTransitions` from the API. If `RESOLVED` is not offered because of blockers, a disabled "Resolve" button is shown with an adjacent message built from `resolutionBlockers` ("Needs an owner", "Needs at least one completed action", "Finish or cancel open actions") linked to the Actions Taken section.
* **Cancel** and **Reopen** open a small confirm panel *inside the page flow* (not a modal): a required Reason textarea (0/500 counter), Confirm and Back buttons, focus moved to the textarea on open and back to the trigger on close.
* While a change is saving the control is disabled and shows "Saving…" (FR-19). On success a polite live region announces "Status changed to *X*" and the summary badge, permitted list and version refresh. On `STALE_UPDATE` a conflict banner appears: "This ticket was changed by someone else. [Reload latest]" — reloading keeps any reason text typed.

### 6.2 Actions Taken section (`id="actions"`)
* Heading "Actions Taken (n)" with **Add Action** button (hidden for terminal-status Tickets; a notice "Actions are locked while the ticket is Resolved/Closed/Cancelled — reopen it to add actions" is shown instead).
* **Desktop ≥ 768 px:** table columns — Date/Time · Description · Result · Status · Assignee (Performed by under it) · Follow-up · Attachment Notes · row action "View/Edit". **Below 768 px:** each action is a stacked card with the same fields as labelled rows. No horizontal page scroll in either layout (long text wraps).
* Rows ordered oldest first (matches the API), newest highlighted briefly after creation (respects `prefers-reduced-motion`).
* Follow-up column shows the ⚑ chip and the note; Attachment Notes show the text, never a file link.
* **Empty state:** "No actions recorded yet." with Add Action.

### 6.3 Create mode (inline form, opens above the list)
| Field | Control | Notes |
|---|---|---|
| Action Date/Time | `datetime-local`, default now | error if in the future or before ticket creation |
| Description * | textarea, 0/2000 | required |
| Status | select (Planned default, In Progress, Completed) | |
| Result | textarea, 0/2000 | becomes required (marked *) when Status = Completed |
| Assignee | select of **active** IT Staff/Admin, default me | inactive users are not listed; server still validates |
| Follow-Up Required? | checkbox | |
| Follow-up Note | textarea, 0/1000 | appears when checked and is then required |
| Attachment Notes | textarea, 0/1000 | helper: "Say which file or image to look for and where it is stored. Files cannot be uploaded here." |
* Helper text under the form: "Everything here is visible to the requester. Use an Internal Note for staff-only remarks."
* "Recorded by" is shown read-only (current user) and is not editable.
* Buttons: **Save action** (primary, disabled + "Saving…" while pending), **Cancel**. A new `clientRequestId` is generated when the form opens and reused for retries.
* Validation messages sit directly under their field (`aria-describedby`, `aria-invalid`), and the first invalid field receives focus on submit.

### 6.4 View / edit mode
* Clicking a row opens it in **view mode** (read-only fields, all details, history of who last edited).
* **Edit** switches the same panel to editable fields (not offered for `COMPLETED`/`CANCELLED`, which show a "Locked" note). Status buttons in the panel show only legal next states: *Start* (Planned → In Progress), *Complete* (needs Result), *Cancel action*.
* Read-only vs editable fields are visually different (plain text vs bordered controls) and announced with `readonly`/`aria-readonly`.
* **Save failure** (validation, network, conflict): the panel stays open, all typed values are preserved, an alert explains the problem; on `STALE_UPDATE` the banner offers "Reload latest" which refreshes the version while keeping the user's text visible for copying.
* **Inactive-assignee** rejection (422) is shown under the Assignee field.

### 6.5 Status History timeline
* A vertical list below the actions: date/time · "*from* → *to*" with status badges · actor name · reason (staff only). Oldest first. Empty: "History is recorded from Lab 4 onward."

## 7. Screen: Requester Ticket Detail additions (`/tickets/:id`)
* A read-only **Actions Taken** section with the same table/cards as §6.2 but **no** Add/Edit controls, no assignee-edit, no version info, and the helper line "These are the steps IT has taken on your ticket."
* A read-only **Status History** timeline without reasons.
* Existing Lab 2/3 blocks (details, attachments, Public Comments, Problem Appears Resolved) are unchanged; Internal Notes never appear.

## 8. Shared States and Messages

| State | Pattern |
|---|---|
| Loading | spinner or skeleton, `aria-busy`, no layout jump |
| Validation | inline under field + summary alert at top of the form when ≥ 2 errors |
| Success | green alert / toast with `role="status"`, auto-hides after 5 s but remains in a live region |
| Empty / no results | neutral card with message and next step |
| Forbidden | "You do not have access to this page." + link to Dashboard |
| Not found | "That ticket could not be found." + link back (also used for masked 404) |
| Conflict | warning alert + "Reload latest" |
| Safe failure | "Something went wrong. Your changes are still here — try again." — never raw error text or stack traces |

## 9. Responsive, Accessibility and Visual Checklist (completed in I-7)

**Breakpoints:** 1280 px desktop · 768 px tablet · 375 px mobile.

| # | Check | Applies to |
|---|---|---|
| V-01 | No horizontal page scroll at 1280/768/375 | all Lab 4 screens |
| V-02 | No clipped or overlapping text/controls (long ticket summaries, long descriptions, 4-digit counts) | dashboards, Actions Taken, status control |
| V-03 | Metric cards reflow 5→3→1 and stay legible | both dashboards |
| V-04 | Actions Taken switches table ↔ cards at 768 px with all fields reachable | ticket detail |
| V-05 | Every interactive element reachable and operable by keyboard; logical tab order | all |
| V-06 | Visible focus ring on cards, links, buttons, inputs | all |
| V-07 | Every input has a label; errors linked with `aria-describedby`; icons have text alternatives | forms |
| V-08 | Status/priority/follow-up never colour-only (text + symbol) | badges |
| V-09 | Editable vs read-only fields clearly distinguishable | Actions Taken |
| V-10 | Validation messages adjacent to their fields; first error focused | forms |
| V-11 | Zen Green tokens only; no stray colours, fonts or spacing; no leftover dev/placeholder UI | all |
| V-12 | Text contrast ≥ 4.5:1 (3:1 for large text and UI borders) | all |
| V-13 | Touch targets ≥ 44 px on mobile | all |
| V-14 | `prefers-reduced-motion` honoured | highlights, spinners |
| V-15 | No console errors or warnings during the flow | all |
| V-16 | Dashboard drill-down lands on the right filtered list with matching count | both dashboards |
| V-17 | Role navigation shows only permitted links; active page marked | shell |

Results are recorded per screen and viewport in `artifacts/lab-04/screenshots/` and summarised in the final report.
