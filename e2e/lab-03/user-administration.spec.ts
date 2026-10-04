import { test, expect } from "@playwright/test";
import { login, shoot } from "./capture";
import { REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD } from "./api-fixtures";

// E2E-04 (FR-20-FR-23) per docs/lab-03/tests.md: full admin workflow —
// create user -> set initial password -> that user's forced change at next
// login. Uses a throwaway, timestamped email so repeated runs never collide
// on BR-26's case-insensitive uniqueness constraint.

test.describe("E2E-04: full admin user-management workflow", () => {
  test("admin creates a user end-to-end into that user's forced password change", async ({ page, browser }) => {
    await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /administrator user management/i })).toBeVisible();

    // A known seeded account keeps the evidence readable even when the
    // development database has accumulated throwaway accounts from tests.
    // This also demonstrates the role and search filters working together.
    await page.locator("#role-filter").selectOption("IT_STAFF");
    await page.locator("#user-search").fill("carlos.mendez@toktick.internal");
    await expect(page.locator(".d-none.d-md-block tbody tr").filter({ hasText: "carlos.mendez@toktick.internal" })).toHaveCount(1);
    await shoot(page, "user-management", "Figure-user-list", "all", { fullPage: false });
    const seededRow = page.locator(".d-none.d-md-block tr", { hasText: "carlos.mendez@toktick.internal" }).first();
    await seededRow.getByRole("button", { name: /^edit$/i }).click();
    await expect(page.getByRole("heading", { name: /^edit user$/i })).toBeVisible();
    await shoot(page, "user-management", "Figure-edit-user-modal", "all", { fullPage: false });
    await page.locator(".modal-footer button", { hasText: "Close" }).click();
    await page.locator("#user-search").fill("");
    await page.locator("#role-filter").selectOption("All");

    // Create User modal. shoot(..., "all") restores whatever viewport it
    // was called at (review of PR #70, item 3), so no manual reset is
    // needed between captures any more.
    await page.getByRole("button", { name: /\+ create user/i }).click();
    await expect(page.getByRole("heading", { name: /^create user$/i })).toBeVisible();
    await shoot(page, "user-management", "Figure-create-user-modal", "all", { fullPage: false });

    const stamp = Date.now();
    const newUserEmail = `e2e-admin-flow-${stamp}@toktick.internal`;
    const newUserName = `E2E Admin Flow User ${stamp}`;
    const initialPassword = "TempInitPass789";

    // Scoped to the modal dialog — the page behind it also has a "ROLE"
    // filter <select>, which a bare getByLabel(/role/i) would also match.
    const createModal = page.getByRole("dialog");
    await createModal.getByLabel(/^name$/i).fill(newUserName);
    await createModal.getByLabel(/^email$/i).fill(newUserEmail);
    await createModal.getByLabel(/^role$/i).selectOption("REQUESTER");
    await createModal.getByLabel(/initial password/i).fill(initialPassword);
    await createModal.getByRole("button", { name: /^create user$/i }).click();

    // Confirm the created user appears in the list. The desktop table and
    // mobile card layout are both present in the DOM (Bootstrap display
    // utilities hide one via CSS), so this must resolve to the first match
    // rather than a bare, ambiguous locator.
    await expect(page.getByText(newUserEmail).first()).toBeVisible({ timeout: 10_000 });

    // Open Edit User modal for the freshly created user via the desktop
    // table row (viewport is 1280px here, so the mobile card is hidden).
    const row = page.locator(".d-none.d-md-block tr", { hasText: newUserEmail }).first();
    await row.getByRole("button", { name: /^edit$/i }).click();
    await expect(page.getByRole("heading", { name: /^edit user$/i })).toBeVisible();
    // The modal footer's "Close" button and its header's little X
    // (btn-close, aria-label "Close") both match a role+name query for
    // "Close" — scope to the footer button specifically by its class.
    await page.locator(".modal-footer button", { hasText: "Close" }).click();

    // Simulate that new user's next login in a fresh browser context (a
    // separate session from the admin's), and confirm they are forced into
    // Change Password rather than reaching the app shell directly.
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await login(userPage, newUserEmail, initialPassword);
    await expect(userPage).toHaveURL(/\/change-password/);
    await expect(userPage.getByRole("heading", { name: /change your password/i })).toBeVisible();

    const newPassword = "UserChosenPass012";
    await userPage.getByLabel(/current password/i).fill(initialPassword);
    await userPage.getByLabel(/^new password$/i).fill(newPassword);
    await userPage.getByLabel(/confirm new password/i).fill(newPassword);
    await userPage.getByRole("button", { name: /save new password/i }).click();
    await expect(userPage.getByRole("heading", { name: /my support tickets/i })).toBeVisible();

    await userContext.close();
  });
});
