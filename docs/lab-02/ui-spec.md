# Lab 2 UI Specification — Zen Green Design System

This document defines the design tokens, component rules, form states, responsive breakpoints, and visual inspection checklist for Lab 2.

---

## 1. Zen Green Color Palette & Design Tokens

| Token Name | Hex Code | Purpose / Usage |
|---|---|---|
| `--color-primary-green` | `#006B3C` | App header bar, primary buttons, primary focus indicators |
| `--color-secondary-green` | `#0B7A46` | Active navigation tabs, links, button hover states |
| `--color-pale-green` | `#EAF6EF` | Selected table rows, success badge backgrounds, subtle card accents |
| `--color-bg-page` | `#F5F7F6` | Global page background (soft near-white) |
| `--color-surface` | `#FFFFFF` | Card backgrounds, modal backgrounds, input backgrounds |
| `--color-border-subtle` | `#E2E8F0` | Card borders, dividers, subtle table grid lines |
| `--color-border-input` | `#CBD5E1` | Normal input field borders |
| `--color-text-primary` | `#1A2E22` | Body text, headings, primary form labels |
| `--color-text-muted` | `#64748B` | Helper text, secondary metadata, table headers |
| `--color-read-only-bg` | `#F1F5F3` | Background shading for read-only / locked inputs |
| `--color-error-text` | `#DC2626` | Field validation error text and error borders |
| `--color-error-bg` | `#FEF2F2` | Error callout banners and alert backgrounds |
| `--color-warning-amber` | `#D97706` | Medium priority pill badges, warning callouts |
| `--color-danger-red` | `#DC2626` | High / Urgent priority badges, soft-removal triggers |

---

## 2. Typography & Form Styling Rules

* **Font Family:** `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Headings:** Bold weight (600–700), `#1A2E22` text color.
* **Form Labels:** Placed strictly **above** input controls, weight 500, with a visible red asterisk (`<span class="text-danger">*</span>`) for required fields.
* **Input Controls:**
  - Single-line inputs (`input`, `select`): Fixed height `42px`, `8px` border-radius, `1px solid #CBD5E1`.
  - Focus State: Visible green ring (`box-shadow: 0 0 0 3px rgba(0, 107, 60, 0.25)`), `border-color: #006B3C`.
  - Multiline Description (`textarea`): Minimum height `120px`, vertical-only resize, padding `10px 12px`.
  - Read-Only Inputs: Distinct ivory/gray-green background (`#F1F5F3`), disabled cursor, non-editable.
* **Validation Error Messages:**
  - Displayed immediately beneath the offending input field.
  - Formatted with text color `#DC2626`, font size `0.85rem`, font-weight 500.
  - Accompanied by a red input border (`#DC2626`).

---

## 3. Button Hierarchy & Interactive States

1. **Primary Action (`.btn-zen-primary`):** Background `#006B3C`, text white, hover `#0B7A46`. Used for Create Ticket submission, Continue in modal, and primary confirmations.
2. **Secondary Action (`.btn-zen-secondary`):** Outline `#006B3C` with text `#006B3C`, hover background `#EAF6EF`. Used for "Clear Filters", "Cancel", and secondary navigation.
3. **Destructive Action (`.btn-danger`):** Red outline or solid red for soft-removal actions.
4. **Busy / Submitting State:** Submit button disabled, pointer events none, displaying an inline loading spinner and text `Submitting...`.

---

## 4. Priority & Status Badges

* **Current Status `New`:** Pale green background (`#EAF6EF`), dark green text (`#006B3C`), `border: 1px solid #A7F3D0`.
* **Requested Priority `LOW`:** Soft gray background (`#F1F5F9`), text `#475569`.
* **Requested Priority `MEDIUM`:** Pale amber background (`#FEF3C7`), text `#B45309`.
* **Requested Priority `HIGH`:** Pale orange background (`#FFEDD5`), text `#C2410C`.
* **Requested Priority `URGENT`:** Pale red background (`#FEE2E2`), text `#B91C1C`, font-weight 600.

---

## 5. Responsive Layout Specifications

### 5.1 Desktop Viewport (Width >= 992px)
* Max content width: `1280px` centered with auto margins.
* Create Ticket Form: 2-column grid for Category/System and Priority/Date fields; full-width Summary, Description, and Attachments.
* My Tickets: Full responsive data table with columns (Ticket No, Date, Summary, Category, Priority, Status, Actions).

### 5.2 Tablet Viewport (Width 768px – 991px)
* Content padding: `24px` horizontal.
* Create Ticket: 2-column or stacked layout with generous touch padding.
* My Tickets: Table with horizontal scroll container or condensed column views.

### 5.3 Mobile Viewport (Width < 768px)
* Content padding: `16px` horizontal.
* Create Ticket: Single-column vertically stacked fields, full-width touch-friendly buttons (height >= `44px`).
* My Tickets: Replaces data table with clean **Ticket Cards** displaying Ticket No, Date, Priority badge, Status badge, Summary, and View Details link.
* **Strict Rule:** Zero horizontal scrolling on 375px mobile screens.

---

## 6. Visual Inspection Checklist

- [x] **Color Tokens:** Zen Green palette `#006B3C`, `#0B7A46`, `#EAF6EF` used consistently across all screens.
- [x] **Field State Clarity:** Read-only fields visually distinguished from editable inputs.
- [x] **Validation Placement:** Field-level error messages rendered directly beneath the field.
- [x] **Button States:** Busy spinner on submit, disabled button during async operations.
- [x] **Zero Overflow:** No horizontal scrollbars on desktop, tablet, or mobile (375px).
- [x] **No Text Clipping:** Labels, badges, and summaries wrap or truncate gracefully.
- [x] **Accessibility:** High contrast text on backgrounds, visible keyboard focus indicators.
