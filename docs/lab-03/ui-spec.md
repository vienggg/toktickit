# Lab 3 UI Specification — Zen Green Design System Extension

This document extends `docs/lab-02/ui-spec.md`. All Lab 2 tokens, form
conventions, button hierarchy, and priority badges remain unchanged and in
force. This document adds only what Lab 3 introduces: authentication screens,
role badges, status badges for the 8-state workflow, the IT Staff screens, and
the Administrator screen.

---

## 1. New Design Tokens

| Token Name | Hex Code | Purpose |
|---|---|---|
| `--color-role-requester` | `#0B7A46` | Requester role badge (reuses secondary green) |
| `--color-role-staff` | `#1D4ED8` | IT Staff role badge |
| `--color-role-admin` | `#7C2D92` | Administrator role badge |
| `--color-status-open` | `#EAF6EF` bg / `#006B3C` text | `NEW`, `OPEN` |
| `--color-status-progress` | `#DBEAFE` bg / `#1D4ED8` text | `IN_PROGRESS` |
| `--color-status-waiting` | `#FEF3C7` bg / `#B45309` text | `WAITING_FOR_REQUESTER` |
| `--color-status-resolved` | `#D1FAE5` bg / `#047857` text | `RESOLVED` |
| `--color-status-closed` | `#F1F5F9` bg / `#475569` text | `CLOSED` |
| `--color-status-reopened` | `#FFEDD5` bg / `#C2410C` text | `REOPENED` |
| `--color-status-cancelled` | `#FEE2E2` bg / `#991B1B` text | `CANCELLED` |
| `--color-internal-note-bg` | `#FDF4E7` | Internal Note panel background — visually distinct from Public Comment |
| `--color-public-comment-bg` | `#F5F7F6` | Public Comment panel background (matches page canvas) |

All existing Requested/IT Priority badges from Lab 2 §4 are reused unchanged
for both Requested Priority and IT Priority — the two are distinguished by a
label ("Requested" vs "IT Priority"), never by a different color scale.

---

## 2. Screen: Login

* Centered card, max-width 420px, on the Zen Green pale background.
* Fields: Email, Password (masked, with a show/hide toggle).
* Primary button: "Log In" (`.btn-zen-primary`), full width.
* **States:** idle → busy (spinner, "Logging in...", button disabled) → success
  (redirect) or error (inline banner above the form, `--color-error-bg`,
  generic "Invalid email or password" or "This account has been deactivated.").
* No indication of which field was wrong (BR-06).

## 3. Screen: Change Password (mandatory first-login)

* Same card treatment as Login. Not dismissible — no navigation away is
  possible until submitted successfully.
* Fields: Current Password, New Password, Confirm New Password.
* Inline password rules shown as a checklist that ticks green as satisfied
  (≥8 chars, contains a letter, contains a digit, matches confirmation).
* On success: redirect into the application shell with a brief success toast.

## 4. Application Shell (all authenticated screens)

* Navbar (extends Lab 2's `Navbar.tsx`): replaces the "Requester: Name
  (Department)" pill and "Change Requester" button with:
  - The current user's name and a role badge (`--color-role-*`).
  - Role-specific navigation links — a Requester never sees "Ticket Queue" or
    "User Management"; an IT Staff never sees "User Management"; an
    Administrator sees "User Management" only.
  - A "Logout" button (`.btn-zen-secondary`), always visible.
* Direct navigation to a route outside the current role's permitted set
  redirects to `/login` (if unauthenticated) or to the role's default screen
  (if authenticated but forbidden) — never a blank page or a client-side crash.

## 5. Requester Screens (Lab 2 continuation)

* Create Ticket, My Tickets, Ticket Detail — unchanged visually from Lab 2.
* Ticket Detail adds:
  - A **Public Comments** panel below Attachments: a chronological list of
    `{ author, timestamp, body }`, an add-comment textarea, "Post Comment"
    button. Background `--color-public-comment-bg`.
  - A **"Problem Appears Resolved"** button (`.btn-zen-secondary`), visible
    only while status is not already `RESOLVED`/`CLOSED`/`CANCELLED`. After
    use, replaced with a small "You indicated this is resolved on {date}"
    note; does not alter the visible status badge.

## 6. Screen: IT Staff Ticket Queue

* **Desktop (≥992px):** data table — Ticket Number, Created Date, Summary,
  Category, Requested Priority, IT Priority, Status, Owner, Last Updated,
  action ("Open"). Chosen over a wider grid to keep every column legible
  without horizontal scroll at 1280px.
* **Tablet (768–991px):** condensed table (Ticket Number, Summary, Status, IT
  Priority, Owner, Open) inside a horizontal-scroll container, or a card list
  — implementation may choose either provided zero page-level overflow.
* **Mobile (<768px):** Ticket Cards — Ticket Number, Summary, Status badge, IT
  Priority badge, Owner ("Unassigned" in muted gray if null), tap to open.
* **Controls:** search box; filters for Status, IT Priority, Category, Owner
  (including an explicit "Unassigned" option); column-header sort on
  supported fields; pagination controls (page size fixed at 10, per
  `api-spec.md`).
* **Feedback states:** loading skeleton rows; empty state ("No tickets in the
  queue yet"); no-results state ("No tickets match your filters" + Clear
  Filters); forbidden state (if reached by a non-staff role, redirect rather
  than render); safe failure banner on API error.
* Unassigned rows show an "Unassigned" pill in `--color-border-subtle` gray;
  assigned rows show the owner's name.

## 7. Screen: IT Staff Ticket Detail

Extends the Requester Ticket Detail layout with an operational panel, grouped
distinctly from the read-only Ticket information:

* **Ownership & Priority panel:** current owner (or "Unassigned" + "Claim"
  button), a reassign dropdown (active IT Staff/Administrator only), IT
  Priority selector (independent of the read-only Requested Priority shown
  alongside it).
* **Status control:** a dropdown/segmented control offering *only* the
  transitions permitted from the current status (per the transition matrix);
  attempting an out-of-band change is prevented client-side and rejected
  server-side regardless.
* **Public Comments panel:** identical to the Requester's, editable by staff
  too.
* **Internal Notes panel:** visually distinct — `--color-internal-note-bg`
  background, a small "🔒 Internal — not visible to Requester" label pinned to
  the panel header, so it cannot be mistaken for the Public Comments panel
  above/below it.
* Existing Lab 2 Attachments panel is unchanged and continues to function.
* All edits show inline validation, a saving spinner state, a success toast,
  and a safe failure banner (no raw error text) on API failure.

## 8. Screen: Administrator User Management

A single screen, list + modal forms — deliberately minimal per scope:

* **List (desktop table / mobile cards):** Name, Email, Role badge, Status
  badge (Active/Inactive), Edit action.
* **Search bar** (name or email) + **optional role filter** dropdown
  (`All`/Requester/IT Staff/Administrator). No pagination, no multi-column
  sort, no multiple simultaneous filters — matches the excluded scope.
* **Create User modal:** Name, Email, Role (single-select), Active toggle,
  Initial Password field. Duplicate-email and invalid-role errors render
  inline beneath the offending field.
* **Edit User modal:** Name, Email, Role, Active toggle, and a separate "Set
  New Initial Password" action (its own confirmation step, since it forces
  the target user's next login into Change Password).
* Self-deactivation and last-Administrator-removal attempts are blocked with
  an inline error banner explaining why, never a silent no-op.
* Non-Administrator access redirects away before the screen renders.

## 9. Responsive Rules

Same breakpoints as Lab 2 (`ui-spec.md` §5): Desktop ≥992px, Tablet 768–991px,
Mobile <768px, with zero horizontal scrolling at 375px as a hard rule for every
new screen listed above.

## 10. Visual Inspection Checklist (Lab 3 additions)

- [ ] Role badges (`--color-role-*`) render consistently in the Navbar across
      every authenticated screen. (Not verified as written: the Navbar
      component — and its role badge — is only mounted on the Requester's
      screens (`RequesterWorkspace` at `/`). The Staff Queue, Staff Ticket
      Detail, and Administrator User Management screens are each
      self-contained pages with their own header and do not render the
      shared `Navbar` or any role badge at all — see the comment at the top
      of `UserManagement.tsx` acknowledging this directly. Confirmed by
      inspection of `client/src/App.tsx`, `Navbar.tsx`,
      `StaffTicketQueue.tsx`, and `UserManagement.tsx` during I-9; not a
      Playwright-checkable "true" until role-specific navigation is built
      into those screens.)
- [x] Status badges use the 7-color scale in §1 and never reuse a Priority
      badge color for a Status value. Verified in
      `e2e/lab-03/visual-inspection.spec.ts` ("status badges never reuse a
      priority badge's background color") by comparing the computed
      `background-color` of a `[data-testid=status-badge]` and a
      `[data-testid=priority-badge]` on the Staff Queue — they differ.
- [x] Public Comments and Internal Notes panels are visually distinguishable
      at a glance, including on a 375px screen where they stack vertically.
      Verified in `e2e/lab-03/visual-inspection.spec.ts` ("panel backgrounds
      differ on a mobile viewport") by comparing computed background colors
      of the Internal Notes panel (`--color-internal-note-bg`) and the
      Public Comments section at a 375px viewport on Staff Ticket Detail.
- [x] Editable vs. read-only fields (Requested Priority vs. IT Priority; Ticket
      Owner select vs. static "Unassigned" text) are distinguishable using the
      Lab 2 read-only background convention. Verified in
      `e2e/lab-03/visual-inspection.spec.ts` ("Requested Priority renders as
      static text while IT Priority renders as a select") by asserting the
      Requested Priority container contains no `<select>`/`<input>` while
      `#it-priority-select` is a real, interactive `<select>`.
- [ ] Validation errors render beneath their field on every new form (Login,
      Change Password, Create/Edit User). (Only partially true, not checked
      off wholesale: `UserManagement.tsx`'s Create/Edit User modals do
      render field-level errors beneath the offending input (confirmed by
      code inspection — `fieldErrorsFromCode` + per-field `<div
      className="text-danger small">` under Name/Email/Role/Initial
      Password). Login and Change Password, however, only ever show a
      single banner above the form — per `ui-spec.md` §2's own description
      ("error (inline banner above the form...)") and confirmed against
      `Login.tsx`/`ChangePassword.tsx`, neither has any beneath-field error
      rendering to check. The checklist item as written ("every new form")
      does not hold for those two forms by the design itself, not by an
      implementation gap.)
- [ ] Focus states are visible on every new interactive control (buttons,
      selects, the status dropdown). (Not verified: no `outline: none` or
      focus-ring override was found in `client/src/index.css` or any
      component during inspection, so Bootstrap's default focus rings are
      presumably intact, but this checklist item asks for a visible focus
      ring on every new control and that was not exercised end-to-end with
      a real keyboard-focus assertion in Playwright — left unchecked rather
      than checked on inspection alone.)
- [x] No clipping of role badges, status badges, or owner names at 375px.
      Verified in `e2e/lab-03/visual-inspection.spec.ts` ("mobile ticket
      cards keep status/priority badges and owner name within the
      viewport") via each ticket card's `boundingBox()` at a 375px viewport
      on the Staff Queue.
- [x] No horizontal overflow on the Staff Queue table at any breakpoint.
      Verified in `e2e/lab-03/visual-inspection.spec.ts` at all three
      viewports (1280/768/375px) by asserting
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- [x] Forbidden and not-found states never render a blank screen or an
      unstyled browser error page. Verified in
      `e2e/lab-03/visual-inspection.spec.ts`: an IT Staff session hitting
      the Administrator-only `/admin/users` is redirected (not blank, and
      the resulting page has non-empty body text), and an unauthenticated
      session hitting `/staff/queue` lands on a rendered `/login` form
      rather than a blank page.
