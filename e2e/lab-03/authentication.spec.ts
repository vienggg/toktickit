import { test, expect } from "@playwright/test";
import { login, shoot } from "./capture";
import {
  REGRESSION_REQUESTER_EMAIL,
  REGRESSION_REQUESTER_PASSWORD,
  createForcedChangeUser,
} from "./api-fixtures";

// E2E-01 (AC-01, AC-07, AC-15) and E2E-02 (AC-02) per docs/lab-03/tests.md.

test.describe("E2E-01: full session lifecycle", () => {
  test("login -> app access -> logout -> blocked redirect", async ({ page }) => {
    // Login form — this is also part of the ui-spec.md visual-inspection
    // checklist evidence (focus states, validation placement), so capture
    // at all three viewports.
    await page.goto("/login");
    await shoot(page, "authentication", "Figure-login-form", "all");

    await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);

    // AC-01: successful login reaches the application shell (Requester's
    // default screen is My Tickets, per client/src/App.tsx's
    // RequesterWorkspace defaulting activeTab to 'list').
    await expect(page.getByRole("heading", { name: /my support tickets/i })).toBeVisible();
    await expect(page).toHaveURL(/\/$|\/\?/);
    await shoot(page, "authentication", "Figure-login-success", "all");

    // AC-07: logout ends the session.
    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await shoot(page, "authentication", "Figure-after-logout", "desktop");

    // AC-15: direct navigation to a protected route after logout redirects
    // to /login rather than rendering a blank page or crashing.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

test.describe("E2E-02: initial password login and change", () => {
  test("forced Change Password blocks the app until submitted, then normal access resumes", async ({ page }) => {
    const fixtureUser = await createForcedChangeUser("E2E-02 Forced Change");

    await login(page, fixtureUser.email, fixtureUser.password);

    // AC-02: the app must not open normal screens while mustChangePassword
    // is true — RequireAuth redirects any route to /change-password.
    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible();
    await shoot(page, "authentication", "Figure-forced-change-password-screen", "all");

    const newPassword = "NewInitialPass456";
    await page.getByLabel(/current password/i).fill(fixtureUser.password);
    await page.getByLabel(/^new password$/i).fill(newPassword);
    await page.getByLabel(/confirm new password/i).fill(newPassword);
    await page.getByRole("button", { name: /save new password/i }).click();

    // On success: redirect into the application shell (My Tickets, since
    // this fixture user is a REQUESTER).
    await expect(page.getByRole("heading", { name: /my support tickets/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/change-password/);
    await shoot(page, "authentication", "Figure-change-password-success", "desktop");

    // Confirm normal app access afterward: a reload stays on the app shell
    // rather than bouncing back to Change Password.
    await page.reload();
    await expect(page.getByRole("heading", { name: /my support tickets/i })).toBeVisible();
  });
});
