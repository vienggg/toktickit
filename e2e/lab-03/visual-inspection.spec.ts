import { test, expect, type Locator, type Page } from "@playwright/test";
import { login } from "./capture";
import {
  REGRESSION_ADMIN_EMAIL,
  REGRESSION_ADMIN_PASSWORD,
  REGRESSION_REQUESTER_EMAIL,
  REGRESSION_REQUESTER_PASSWORD,
  REGRESSION_STAFF_EMAIL,
  REGRESSION_STAFF_PASSWORD,
  apiLogin,
  createForcedChangeUser,
  createFreshTicketAsRequester,
  createFreshTicketWithAttachmentAsRequester,
} from "./api-fixtures";

async function expectVisibleKeyboardFocus(page: Page, target: Locator, label: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  let reachedByTab = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await page.keyboard.press("Tab");
    reachedByTab = await target.evaluate((element) => element === document.activeElement);
    if (reachedByTab) break;
  }

  expect(reachedByTab, `${label} should be reachable by Tab`).toBe(true);
  const indicator = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(":focus-visible"),
      hasOutline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      hasBoxShadow: style.boxShadow !== "none",
    };
  });
  expect(indicator.focusVisible, `${label} should reflect keyboard focus`).toBe(true);
  expect(indicator.hasOutline || indicator.hasBoxShadow, `${label} should show a visible focus indicator`).toBe(true);
}

async function auditEveryVisibleTabStop(page: Page, screen: string, scope: Locator = page.locator("body")) {
  const auditAttribute = "data-keyboard-audit-target";
  const targets = await scope.evaluate((container, attribute) => {
    const selector = "a[href], button, input, select, textarea, [tabindex], [contenteditable='true']";
    return Array.from(container.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const style = getComputedStyle(element);
        return element.tabIndex >= 0
          && !element.matches(":disabled")
          && element.getAttribute("aria-hidden") !== "true"
          && element.getClientRects().length > 0
          && style.visibility !== "hidden"
          && style.display !== "none";
      })
      .map((element, index) => {
        element.setAttribute(attribute, String(index));
        return {
          index,
          label: element.getAttribute("aria-label")
            || element.getAttribute("id")
            || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 60)
            || element.tagName.toLowerCase(),
        };
      });
  }, auditAttribute);

  expect(targets.length, `${screen} should expose at least one keyboard control`).toBeGreaterThan(0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  const visited = new Set<number>();
  const focusIssues: string[] = [];
  const unexpectedTabStops: string[] = [];
  for (let step = 0; step < targets.length + 2 && visited.size < targets.length; step += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate((attribute) => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return null;
      const style = getComputedStyle(element);
      return {
        target: element.getAttribute(attribute),
        label: element.getAttribute("aria-label") || element.id || element.tagName.toLowerCase(),
        focusVisible: element.matches(":focus-visible"),
        hasIndicator: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0)
          || style.boxShadow !== "none",
      };
    }, auditAttribute);

    if (state?.target == null) {
      // Chromium may focus <body> for one Tab at the document boundary.
      // It is not a control; all other unlisted stops must be reported.
      if (state?.label !== "body") unexpectedTabStops.push(state?.label ?? "no active element");
      continue;
    }
    const targetIndex = Number(state.target);
    if (!Number.isInteger(targetIndex)) continue;
    visited.add(targetIndex);
    const target = targets[targetIndex];
    if (!state.focusVisible || !state.hasIndicator) {
      focusIssues.push(`${target.label} (tab stop ${targetIndex + 1})`);
    }
  }

  const unreachable = targets.filter((target) => !visited.has(target.index)).map((target) => target.label);
  expect(unreachable, `${screen} controls should all be reachable by Tab`).toEqual([]);
  expect(unexpectedTabStops, `${screen} should not skip unlisted Tab stops`).toEqual([]);
  expect(focusIssues, `${screen} controls should all show a visible keyboard focus indicator`).toEqual([]);

  await scope.evaluate((container, attribute) => {
    container.querySelectorAll(`[${attribute}]`).forEach((element) => element.removeAttribute(attribute));
  }, auditAttribute);
}

async function expectNoPageHorizontalOverflow(page: Page, screen: string) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.pageWidth, `${screen} should not overflow the viewport horizontally`).toBeLessThanOrEqual(
    dimensions.viewportWidth
  );
}

/**
 * Dedicated lightweight checks backing the docs/lab-03/ui-spec.md §10
 * Visual Inspection Checklist (I-9, Issue #58). These are programmatic
 * assertions, not "eyeballing a screenshot" — each one maps to a specific
 * checklist line, checked off in ui-spec.md only once the assertion here
 * passes. Some checklist items are instead verified inline inside
 * authentication.spec.ts / staff-ticket-flow.spec.ts / user-administration.spec.ts;
 * this file covers the ones that don't naturally fall out of those flows.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;

test.describe("Visual inspection checklist — Staff Queue no horizontal overflow", () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
      await page.goto("/staff/queue");
      await expect(page.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        tableContainer: (() => {
          const element = document.querySelector(".queue-results-table");
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: style.overflowX,
          };
        })(),
        overflowingElements: Array.from(document.querySelectorAll("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              tag: element.tagName,
              className: typeof element.className === "string" ? element.className : "",
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              overflowX: style.overflowX,
              minWidth: style.minWidth,
            };
          })
          .filter((element) => element.right > document.documentElement.clientWidth + 1)
          .slice(0, 8),
        nonTableOverflow: Array.from(document.querySelectorAll("body *"))
          .map((element) => ({ element, right: element.getBoundingClientRect().right }))
          .filter(({ element, right }) => right > document.documentElement.clientWidth + 1 && !element.closest(".queue-results-table"))
          .slice(0, 8)
          .map(({ element, right }) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: Math.round(right) })),
      }));
      expect(
        overflow.scrollWidth,
        `scrollWidth (${overflow.scrollWidth}) should not exceed clientWidth (${overflow.clientWidth}) at ${vp.width}px; table container: ${JSON.stringify(overflow.tableContainer)}; non-table overflow: ${JSON.stringify(overflow.nonTableOverflow)}`
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
});

test.describe("Visual inspection checklist — status badge palette", () => {
  test("every status uses the matching UI-spec background and text tokens", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/queue");
    await page.waitForLoadState("networkidle");

    const expectedColors = [
      { status: "NEW", background: "rgb(234, 246, 239)", color: "rgb(0, 107, 60)" },
      { status: "OPEN", background: "rgb(234, 246, 239)", color: "rgb(0, 107, 60)" },
      { status: "IN_PROGRESS", background: "rgb(219, 234, 254)", color: "rgb(29, 78, 216)" },
      { status: "WAITING_FOR_REQUESTER", background: "rgb(254, 243, 199)", color: "rgb(180, 83, 9)" },
      { status: "RESOLVED", background: "rgb(209, 250, 229)", color: "rgb(4, 120, 87)" },
      { status: "CLOSED", background: "rgb(241, 245, 249)", color: "rgb(71, 85, 105)" },
      { status: "REOPENED", background: "rgb(255, 237, 213)", color: "rgb(194, 65, 12)" },
      { status: "CANCELLED", background: "rgb(254, 226, 226)", color: "rgb(153, 27, 27)" },
    ];

    for (const expected of expectedColors) {
      await page.locator("#queue-status").selectOption(expected.status);
      const badge = page.getByTestId("status-badge").first();
      await expect(badge).toHaveAttribute("data-status", expected.status);
      const colors = await badge.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      });
      expect(colors, `${expected.status} should use the declared UI-spec colors`).toEqual({
        background: expected.background,
        color: expected.color,
      });
    }
  });

  test("long status text fits the badge at the 992px desktop breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 992, height: 900 });
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/queue");
    await page.locator("#queue-status").selectOption("WAITING_FOR_REQUESTER");

    const badge = page.locator(".queue-data-table--desktop [data-status='WAITING_FOR_REQUESTER']").first();
    await expect(badge).toBeVisible();
    const bounds = await badge.evaluate((element) => {
      const badgeBounds = element.getBoundingClientRect();
      const cellBounds = element.closest("td")!.getBoundingClientRect();
      return {
        badgeRight: badgeBounds.right,
        cellRight: cellBounds.right,
        textFits: element.scrollWidth <= element.clientWidth,
      };
    });
    expect(bounds.badgeRight).toBeLessThanOrEqual(bounds.cellRight + 1);
    expect(bounds.textFits).toBe(true);
  });
});

test.describe("Visual inspection checklist — role-specific shell and landing routes", () => {
  test("Requester sees only requester destinations and lands on My Tickets", async ({ page }) => {
    await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await page.goto("/");

    const requesterRole = page.getByTestId("authenticated-user").getByTestId("role-badge");
    await expect(requesterRole).toHaveText("Requester");
    await expect(requesterRole).toHaveCSS("background-color", "rgb(11, 122, 70)");
    await expect(page.getByRole("button", { name: /create ticket/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /my tickets/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ticket queue/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /user management/i })).toHaveCount(0);

    await page.getByRole("button", { name: /create ticket/i }).click();
    await expect(page.getByLabel(/summary/i)).toBeVisible();
    await expect(page.getByTestId("authenticated-user").getByTestId("role-badge")).toHaveText("Requester");
  });

  test("IT Staff lands on the queue and does not see User Management", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/");

    await expect(page).toHaveURL(/\/staff\/queue$/);
    const staffRole = page.getByTestId("authenticated-user").getByTestId("role-badge");
    await expect(staffRole).toHaveText("IT Staff");
    await expect(staffRole).toHaveCSS("background-color", "rgb(29, 78, 216)");
    await expect(page.getByRole("link", { name: /ticket queue/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /user management/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();

    await page.getByRole("button", { name: /open/i }).first().click();
    await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);
    await expect(page.getByTestId("authenticated-user").getByTestId("role-badge")).toHaveText("IT Staff");
  });

  test("Administrator lands on the queue and sees both explicitly authorized destinations", async ({ page }) => {
    await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
    await page.goto("/");

    await expect(page).toHaveURL(/\/staff\/queue$/);
    const navbarRole = page.getByTestId("authenticated-user").getByTestId("role-badge");
    await expect(navbarRole).toHaveText("Administrator");
    await expect(navbarRole).toHaveCSS("background-color", "rgb(124, 45, 146)");
    await expect(page.getByRole("link", { name: /ticket queue/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /user management/i })).toBeVisible();

    await page.getByRole("link", { name: /user management/i }).click();
    await expect(page.getByRole("heading", { name: /administrator user management/i })).toBeVisible();
    await expect(navbarRole).toHaveText("Administrator");

    await page.getByRole("link", { name: /ticket queue/i }).click();
    await page.getByRole("button", { name: /open/i }).first().click();
    await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);
    await expect(navbarRole).toHaveText("Administrator");
  });
});

test("Login controls are keyboard reachable and show visible focus", async ({ page }) => {
  await page.goto("/login");

  await expectVisibleKeyboardFocus(page, page.locator("#login-email"), "Login email");
  await expectVisibleKeyboardFocus(page, page.locator("#login-password"), "Login password");
  await expectVisibleKeyboardFocus(page, page.getByRole("button", { name: /show password/i }), "Show password");
  await expectVisibleKeyboardFocus(page, page.getByRole("button", { name: /log in/i }), "Log In");
  await auditEveryVisibleTabStop(page, "Login");
});

test("Forced password change controls show visible focus", async ({ page }) => {
  const forcedChangeUser = await createForcedChangeUser("E2E Keyboard Focus");
  await login(page, forcedChangeUser.email, forcedChangeUser.password);
  await expect(page).toHaveURL(/\/change-password/);
  await auditEveryVisibleTabStop(page, "Change Password");
});

test("Requester list, ticket creation, and ticket details expose visible focus on every Tab stop", async ({ page }) => {
  const fixture = await createFreshTicketAsRequester();
  await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /my support tickets/i })).toBeVisible();
  await auditEveryVisibleTabStop(page, "Requester My Tickets");
  await page.setViewportSize({ width: 375, height: 812 });
  await auditEveryVisibleTabStop(page, "Requester Mobile My Tickets");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: /create ticket/i }).click();
  await expect(page.locator("#ticket-category")).toBeVisible();
  await auditEveryVisibleTabStop(page, "Requester Create Ticket");
  await page.setViewportSize({ width: 375, height: 812 });
  await auditEveryVisibleTabStop(page, "Requester Mobile Create Ticket");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: /my tickets/i }).click();
  await page.locator("#ticket-search").fill(fixture.ticketNumber);
  const ticketRow = page.getByRole("button", { name: new RegExp(fixture.ticketNumber) });
  await expect(ticketRow).toBeVisible();
  await ticketRow.click();
  await expect(page.getByRole("button", { name: /edit ticket/i })).toBeVisible();
  await auditEveryVisibleTabStop(page, "Requester Ticket Detail");

  const addAttachmentButton = page.getByRole("button", { name: /add attachment/i });
  await expect(addAttachmentButton).toBeVisible();
  await expectVisibleKeyboardFocus(page, addAttachmentButton, "Add Attachment action");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([]);

  await page.getByRole("button", { name: /edit ticket/i }).click();
  await expect(page.locator("#edit-summary")).toBeVisible();
  await auditEveryVisibleTabStop(page, "Requester Ticket Edit");
});

test("Attachment removal dialog contains focus, labels itself, and returns focus to its opener", async ({ page }) => {
  const fixture = await createFreshTicketWithAttachmentAsRequester();
  const cleanupContext = await apiLogin(REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  try {
    await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await page.goto("/");
    await page.locator("#ticket-search").fill(fixture.ticketNumber);
    const ticketRow = page.getByRole("button", { name: new RegExp(fixture.ticketNumber) });
    await expect(ticketRow).toBeVisible();
    await ticketRow.click();

    const removeButton = page.getByRole("button", { name: /remove/i }).first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "attachment-removal-title");
    const cancelButton = dialog.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeFocused();
    await auditEveryVisibleTabStop(page, "Attachment Removal Dialog", dialog);

    await cancelButton.click();
    await expect(dialog).toBeHidden();
    await expect(removeButton).toBeFocused();

    await removeButton.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(removeButton).toBeFocused();

    await removeButton.click();
    await dialog.getByLabel(/removal reason/i).fill("Verified from the keyboard audit");
    await dialog.getByRole("button", { name: /confirm removal/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Soft-Removed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("attachments-heading")).toBeFocused();
  } finally {
    const cleanup = await cleanupContext.delete(`/api/tickets/${fixture.id}/attachments/${fixture.attachmentId}`, {
      data: { reason: "E2E keyboard-focus fixture cleanup" },
    });
    expect(cleanup.ok()).toBe(true);
    await cleanupContext.dispose();
  }
});

test("all Lab 3 screens avoid page-level horizontal overflow at 375px", async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /toktickit/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(page, "Login");

  const forcedChangeUser = await createForcedChangeUser("E2E Responsive");
  await login(page, forcedChangeUser.email, forcedChangeUser.password);
  await expect(page).toHaveURL(/\/change-password/);
  await expectNoPageHorizontalOverflow(page, "Forced password change");

  const requesterPage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await login(requesterPage, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  await expect(requesterPage.getByRole("heading", { name: /my support tickets/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(requesterPage, "Requester My Tickets");
  await requesterPage.getByRole("button", { name: /create ticket/i }).click();
  await expect(requesterPage.getByRole("heading", { name: /create it support ticket/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(requesterPage, "Requester Create Ticket");
  await requesterPage.getByRole("button", { name: /my tickets/i }).click();
  await requesterPage.getByRole("button", { name: /view details for ticket/i }).first().click();
  await expect(requesterPage.getByRole("button", { name: /edit ticket/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(requesterPage, "Requester Ticket Detail");
  await requesterPage.close();

  const staffPage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await login(staffPage, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await expect(staffPage.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(staffPage, "Staff Queue");
  await staffPage.getByTestId("ticket-card").first().click();
  await expect(staffPage.getByRole("button", { name: /back to queue/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(staffPage, "Staff Ticket Detail");
  await staffPage.close();

  const adminPage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await login(adminPage, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await expect(adminPage.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(adminPage, "Administrator Queue");
  await adminPage.getByRole("link", { name: /user management/i }).click();
  await expect(adminPage.getByRole("heading", { name: /administrator user management/i })).toBeVisible();
  await expectNoPageHorizontalOverflow(adminPage, "Administrator User List");

  await adminPage.getByRole("button", { name: /\+ create user/i }).click();
  const createDialog = adminPage.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await expectNoPageHorizontalOverflow(adminPage, "Administrator Create User Dialog");
  await createDialog.getByRole("button", { name: /cancel/i }).click();

  await adminPage.locator("#user-search").fill(REGRESSION_REQUESTER_EMAIL);
  const requesterCard = adminPage.getByTestId("user-card").filter({ hasText: REGRESSION_REQUESTER_EMAIL }).first();
  await expect(requesterCard).toBeVisible();
  await requesterCard.getByRole("button", { name: /^edit$/i }).click();
  await expect(adminPage.getByRole("dialog")).toBeVisible();
  await expectNoPageHorizontalOverflow(adminPage, "Administrator Edit User Dialog");
  await adminPage.close();
});

test("Staff queue and ticket detail expose visible focus on every Tab stop", async ({ page }) => {
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.goto("/staff/queue");
  await expect(page.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
  await page.locator("#queue-status").selectOption("NEW");
  const openButton = page.getByRole("button", { name: /^open$/i }).first();
  await expect(openButton).toBeVisible({ timeout: 10_000 });
  await auditEveryVisibleTabStop(page, "Staff Queue");
  await page.setViewportSize({ width: 768, height: 1024 });
  await auditEveryVisibleTabStop(page, "Staff Tablet Queue");
  await page.setViewportSize({ width: 1280, height: 900 });

  await openButton.click();
  await expect(page.locator("#it-priority-select")).toBeVisible();
  await expect(page.locator("#status-select")).toBeVisible();
  await page.locator("#new-comment").fill("Keyboard audit draft only");
  await page.locator("#new-note").fill("Keyboard audit draft only");
  await auditEveryVisibleTabStop(page, "Staff Ticket Detail");
});

test("Administrator queue, user management, and user dialogs expose visible focus on every Tab stop", async ({ page }) => {
  await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await page.goto("/staff/queue");
  await expect(page.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
  await auditEveryVisibleTabStop(page, "Administrator Queue");

  await page.getByRole("button", { name: /^open$/i }).first().click();
  await expect(page.locator("#owner-select")).toBeVisible();
  await auditEveryVisibleTabStop(page, "Administrator Ticket Detail");

  await page.getByRole("link", { name: /user management/i }).click();
  await expect(page.getByRole("heading", { name: /administrator user management/i })).toBeVisible();
  await page.locator("#user-search").fill(REGRESSION_REQUESTER_EMAIL);
  await expect(page.locator(".d-none.d-md-block tbody button")).toHaveCount(1);
  await auditEveryVisibleTabStop(page, "Administrator User List");

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".d-md-none [data-testid='user-card']")).toHaveCount(1);
  await auditEveryVisibleTabStop(page, "Administrator Mobile User List");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: /\+ create user/i }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await auditEveryVisibleTabStop(page, "Administrator Create User Dialog", createDialog);
  await createDialog.getByRole("button", { name: /cancel/i }).click();

  const editButton = page.locator(".d-none.d-md-block tbody button").first();
  await expect(editButton).toBeVisible();
  await editButton.click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await auditEveryVisibleTabStop(page, "Administrator Edit User Dialog", editDialog);

  await editDialog.getByRole("button", { name: /set new initial password/i }).click();
  await editDialog.getByLabel(/new initial password/i).fill("KeyboardDraft123");
  await auditEveryVisibleTabStop(page, "Administrator Set Initial Password Dialog State", editDialog);
});

test("Queue Unassigned label is visually and semantically distinct from the detail Owner selector", async ({ page }) => {
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/staff/queue");
  await page.locator("#queue-owner").selectOption("unassigned");

  const unassignedLabel = page.getByTestId("unassigned-owner").first();
  await expect(unassignedLabel).toBeVisible();
  await expect(unassignedLabel).toHaveText("Unassigned");
  await expect(unassignedLabel).toHaveJSProperty("tagName", "SPAN");

  await page.getByRole("button", { name: /open/i }).first().click();
  await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);
  const ownerSelect = page.locator("#owner-select");
  await expect(ownerSelect).toBeVisible();
  await expect(ownerSelect).toHaveValue("");
  await expect(ownerSelect).toHaveJSProperty("tagName", "SELECT");
  await expect(ownerSelect).toBeEnabled();
});

test("Validation feedback follows each form's design: auth banners and admin field errors", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("not-a-valid-user@toktick.internal");
  await page.getByRole("textbox", { name: /password/i }).fill("WrongPass123");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid email or password/i);

  const forcedChangeUser = await createForcedChangeUser("E2E Validation");
  await login(page, forcedChangeUser.email, forcedChangeUser.password);
  await expect(page).toHaveURL(/\/change-password/);
  await page.getByLabel(/current password/i).fill(forcedChangeUser.password);
  await page.getByLabel(/^new password$/i).fill("short1");
  await page.getByLabel(/confirm new password/i).fill("short1");
  await page.getByRole("button", { name: /save new password/i }).click();
  await expect(page.getByRole("alert")).toContainText(/satisfy all password requirements/i);

  const adminPage = await browser.newPage();
  await login(adminPage, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await adminPage.goto("/admin/users");
  await adminPage.getByRole("button", { name: /\+ create user/i }).click();
  const createModal = adminPage.getByRole("dialog");
  await createModal.getByLabel(/^name$/i).fill("E2E invalid initial password");
  await createModal.getByLabel(/^email$/i).fill(`e2e-invalid-password-${Date.now()}@toktick.internal`);
  await createModal.getByLabel(/initial password/i).fill("weak1");
  await createModal.getByRole("button", { name: /^create user$/i }).click();
  const passwordError = createModal.getByText(/initial password must be at least 8 characters/i);
  await expect(passwordError).toBeVisible();
  await expect(passwordError).toHaveClass(/text-danger/);
  await expect(createModal.locator(".alert-danger")).toHaveCount(0);
  await createModal.getByRole("button", { name: /cancel/i }).click();

  await adminPage.locator("#user-search").fill(REGRESSION_REQUESTER_EMAIL);
  const requesterRow = adminPage.locator(".d-none.d-md-block tr", { hasText: REGRESSION_REQUESTER_EMAIL }).first();
  await expect(requesterRow).toBeVisible();
  await requesterRow.getByRole("button", { name: /^edit$/i }).click();
  const editModal = adminPage.getByRole("dialog");
  await editModal.getByLabel(/^email$/i).fill(REGRESSION_STAFF_EMAIL);
  await editModal.getByRole("button", { name: /save changes/i }).click();
  const emailError = editModal.getByText(/already exists/i);
  await expect(emailError).toBeVisible();
  await expect(emailError).toHaveClass(/text-danger/);
  await expect(editModal.locator(".alert-danger")).toHaveCount(0);
  await adminPage.close();
});

test("Administrator Create User modal contains keyboard focus and restores its opener", async ({ page }) => {
  await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await page.goto("/admin/users");

  const opener = page.getByRole("button", { name: /\+ create user/i });
  await opener.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  const nameInput = dialog.locator("#create-name");
  await expect(nameInput).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /^create user$/i })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("Administrator user dialog closes on Escape and restores focus to its opener", async ({ page }) => {
  await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await page.goto("/admin/users");

  const opener = page.getByRole("button", { name: /\+ create user/i });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test.describe("Visual inspection checklist — Internal Notes vs Public Comments distinguishable at 375px", () => {
  test("panel backgrounds differ on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);

    // Any ticket detail works for a styling check; the staff queue's first
    // row is enough (this test does not mutate the ticket).
    await page.goto("/staff/queue");
    await page.setViewportSize({ width: 1280, height: 900 }); // desktop layout to reliably locate a row's Open button
    await page.waitForLoadState("networkidle");
    const firstOpen = page.getByRole("button", { name: /open/i }).first();
    await expect(firstOpen).toBeVisible({ timeout: 10_000 });
    await firstOpen.click();
    await expect(page).toHaveURL(/\/staff\/tickets\/\d+/);

    await page.setViewportSize({ width: 375, height: 812 });
    const internalNotesPanel = page.getByTestId("internal-notes-panel");
    await expect(internalNotesPanel).toBeVisible();

    const notesBg = await internalNotesPanel.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Public Comments panel has no dedicated test id; select it by its
    // heading text and read the nearest styled ancestor's background.
    const commentsHeading = page.getByRole("heading", { name: /public comments/i });
    await expect(commentsHeading).toBeVisible();
    const commentsBg = await commentsHeading.evaluate((el) => {
      const section = el.closest("div.mt-4");
      return section ? getComputedStyle(section).backgroundColor : getComputedStyle(el).backgroundColor;
    });

    expect(notesBg).not.toBe(commentsBg);
  });
});

test.describe("Visual inspection checklist — editable vs read-only fields distinguishable", () => {
  test("Requested Priority renders as static text while IT Priority renders as a select", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/queue");
    await page.waitForLoadState("networkidle");
    const firstOpen = page.getByRole("button", { name: /open/i }).first();
    await expect(firstOpen).toBeVisible({ timeout: 10_000 });
    await firstOpen.click();
    await expect(page).toHaveURL(/\/staff\/tickets\/\d+/);

    // Requested Priority: labelled container with no <select>/<input> inside.
    const requestedPriorityContainer = page.locator("#requested-priority");
    await expect(requestedPriorityContainer).toBeVisible();
    await expect(requestedPriorityContainer.locator("select, input")).toHaveCount(0);

    // IT Priority: a real, enabled <select>.
    const itPrioritySelect = page.locator("#it-priority-select");
    await expect(itPrioritySelect).toBeVisible();
    await expect(itPrioritySelect).toHaveJSProperty("tagName", "SELECT");
  });
});

test.describe("Visual inspection checklist — forbidden states never render blank", () => {
  test("IT Staff hitting the Administrator-only route is redirected, not shown a blank page", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/staff\/queue$/);
    await expect(page.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /user management/i })).toHaveCount(0);
  });

  test("unauthenticated direct navigation to a protected route redirects to /login, not a blank page", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/staff/queue");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await ctx.close();
  });

  // Review of PR #70, item 6: the two scenarios above only cover
  // "forbidden" (wrong role / unauthenticated) — neither hits a genuine
  // not-found ticket ID. GET /api/staff/tickets/:id returns a real 404 for
  // a nonexistent ticket (server/tests/lab-03/staff-ticket-detail.api.test.ts,
  // "404 for a nonexistent ticket"); this confirms the client actually
  // surfaces that as a visible, styled message rather than a blank screen.
  test("a genuinely not-found ticket ID renders a styled error, not a blank screen", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/tickets/99999999");

    const errorAlert = page.locator(".alert-danger");
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(0);

    // A way back to a working screen must also be present — this is not
    // just a message dead-ending the user.
    await expect(page.getByRole("button", { name: /back to queue/i })).toBeVisible();
  });
});

test.describe("Visual inspection checklist — no clipping of badges/owner names at 375px", () => {
  test("mobile ticket cards keep status/priority badges and owner name within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/queue");
    await page.waitForLoadState("networkidle");

    const card = page.getByTestId("ticket-card").first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375 + 1); // +1px rounding tolerance
    }

    await auditEveryVisibleTabStop(page, "Staff Mobile Queue");
    await expectVisibleKeyboardFocus(page, card, "Mobile ticket card");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);
  });
});

test("sortable queue headers respond to keyboard activation", async ({ page }) => {
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/staff/queue");

  const sortButton = page.getByRole("button", { name: /ticket number/i }).first();
  await expect(sortButton).toBeVisible();
  const sortHeader = sortButton.locator("xpath=..");
  await expect(sortHeader).toHaveAttribute("aria-sort", "none");
  let keyboardFocused = false;
  for (let attempt = 0; attempt < 20 && !keyboardFocused; attempt += 1) {
    await page.keyboard.press("Tab");
    keyboardFocused = await sortButton.evaluate((element) => element === document.activeElement);
  }
  expect(keyboardFocused, "Ticket Number sort control should be reachable by Tab").toBe(true);
  expect(await sortButton.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  const focusStyle = await sortButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(sortHeader).toHaveAttribute("aria-sort", "descending");
  await page.keyboard.press("Enter");
  await expect(sortHeader).toHaveAttribute("aria-sort", "ascending");
});
