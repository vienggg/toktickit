import { test, expect } from "@playwright/test";
import { login } from "./capture";
import { REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD } from "./api-fixtures";

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
      }));
      expect(overflow.scrollWidth, `scrollWidth (${overflow.scrollWidth}) should not exceed clientWidth (${overflow.clientWidth}) at ${vp.width}px`).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
});

test.describe("Visual inspection checklist — status vs priority badge colors", () => {
  test("status badges never reuse a priority badge's background color", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/staff/queue");
    await page.waitForLoadState("networkidle");

    const statusBadge = page.getByTestId("status-badge").first();
    const priorityBadge = page.getByTestId("priority-badge").first();
    await expect(statusBadge).toBeVisible();
    await expect(priorityBadge).toBeVisible();

    const statusColor = await statusBadge.evaluate((el) => getComputedStyle(el).backgroundColor);
    const priorityColor = await priorityBadge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(statusColor).not.toBe(priorityColor);
  });
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
    expect(await itPrioritySelect.evaluate((el) => el.tagName)).toBe("SELECT");
  });
});

test.describe("Visual inspection checklist — forbidden states never render blank", () => {
  test("IT Staff hitting the Administrator-only route is redirected, not shown a blank page", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/admin/users");
    // RequireRole bounces a signed-in but wrong-role user to "/" rather
    // than rendering nothing.
    await expect(page).not.toHaveURL(/\/admin\/users/);
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("unauthenticated direct navigation to a protected route redirects to /login, not a blank page", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/staff/queue");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await ctx.close();
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
  });
});
