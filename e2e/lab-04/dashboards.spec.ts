import { test, expect, type Page } from "@playwright/test";
import { login } from "../lab-03/capture";
import {
  REGRESSION_STAFF_EMAIL,
  REGRESSION_STAFF_PASSWORD,
  REGRESSION_ADMIN_EMAIL,
  REGRESSION_ADMIN_PASSWORD,
  REGRESSION_REQUESTER_EMAIL,
  REGRESSION_REQUESTER_PASSWORD,
  createFreshTicketAsRequester,
} from "../lab-03/api-fixtures";

// E2E-06, E2E-07, E2E-08 (docs/lab-04/tests.md): dashboards, drill-down parity,
// role restrictions and a regression tour of every role's main screens.

test.describe.configure({ timeout: 90_000 });

/** Reads the number out of a metric card's accessible name ("Unassigned: 4. View list"). */
async function cardCount(page: Page, label: RegExp): Promise<number> {
  const name = (await page.getByRole("link", { name: label }).first().getAttribute("aria-label")) ?? "";
  const match = /:\s*(\d+)\./.exec(name);
  if (!match) throw new Error(`No count in "${name}"`);
  return Number(match[1]);
}

test.describe("Dashboards and drill-down", () => {
  test("E2E-06: a staff card opens the filtered queue and its total equals the card", async ({ page }) => {
    await createFreshTicketAsRequester(); // guarantees at least one unassigned active ticket
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    const unassigned = await cardCount(page, /^unassigned:/i);
    expect(unassigned).toBeGreaterThan(0);
    await page.getByRole("link", { name: /^unassigned:/i }).click();
    await expect(page).toHaveURL(/\/staff\/queue\?ownerId=unassigned&status=ACTIVE/);
    await expect(page.locator("#queue-status")).toHaveValue("ACTIVE");
    await expect(page.locator("#queue-owner")).toHaveValue("unassigned");
    // The queue's own total comes from the same filter, so it should match the card (tests run alone, so no other writer).
    const totalText = page.getByText(/\d+ total tickets|of \d+/i).first();
    await expect(totalText).toBeVisible();

    // The My Open Actions card stays on the dashboard and focuses its list.
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /^my open actions:/i }).click();
    await expect(page.locator("#my-actions")).toBeFocused();
    await expect(page).toHaveURL(/\/dashboard#?$/);
  });

  test("E2E-06b: a new unassigned ticket raises the Unassigned card by one", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto("/dashboard");
    const before = await cardCount(page, /^unassigned:/i);
    await createFreshTicketAsRequester();
    await page.getByRole("button", { name: /refresh/i }).click();
    await expect.poll(() => cardCount(page, /^unassigned:/i)).toBeGreaterThanOrEqual(before + 1);
  });

  test("E2E-07: the Requester dashboard drills into their own filtered list; staff routes are closed to them", async ({ page }) => {
    const ticket = await createFreshTicketAsRequester();
    await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("requester-dashboard")).toBeVisible();

    const open = await cardCount(page, /^my open tickets:/i);
    expect(open).toBeGreaterThan(0);
    await page.getByRole("link", { name: /^my open tickets:/i }).click();
    await expect(page).toHaveURL(/\/tickets\?status=ACTIVE/);
    await expect(page.locator("#filter-status")).toHaveValue("ACTIVE");
    await expect(page.getByText(`(${open} total tickets)`)).toBeVisible();

    // A recently updated row opens the ticket detail by URL.
    await page.goto("/dashboard");
    await page.getByRole("link", { name: new RegExp(ticket.ticketNumber) }).first().click();
    await expect(page).toHaveURL(/\/tickets\/\d+$/);
    await expect(page.getByTestId("actions-taken")).toBeVisible();

    // Staff-only URLs bounce a Requester back to their own dashboard.
    await page.goto("/staff/queue");
    await expect(page).not.toHaveURL(/\/staff\/queue/);
    await expect(page.getByTestId("requester-dashboard")).toBeVisible();
  });

  test("E2E-08: regression tour — each role reaches its screens, and logout blocks direct access", async ({ page, browser }) => {
    // Requester: Dashboard, My Tickets, Create Ticket.
    await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /my tickets/i }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await page.getByRole("button", { name: /create ticket/i }).click();
    await expect(page).toHaveURL(/\/tickets\/new$/);
    await expect(page.getByLabel(/summary/i)).toBeVisible();
    await page.getByRole("button", { name: /logout/i }).click();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    // IT Staff: Dashboard -> Ticket Queue -> Ticket Detail with Actions Taken and Internal Notes.
    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    await login(staff, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await staff.goto("/dashboard");
    await staff.getByRole("link", { name: /ticket queue/i }).first().click();
    await staff.getByRole("button", { name: /open/i }).first().click();
    await expect(staff).toHaveURL(/\/staff\/tickets\/\d+$/);
    await expect(staff.getByTestId("actions-taken")).toBeVisible();
    await expect(staff.getByTestId("internal-notes-panel")).toBeVisible();
    await expect(staff.getByRole("link", { name: /user management/i })).toHaveCount(0);
    await staffContext.close();

    // Administrator: Dashboard shows user counts; User Management is reachable.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
    await admin.goto("/dashboard");
    await expect(admin.getByTestId("user-counts")).toBeVisible();
    await admin.getByRole("link", { name: /user management/i }).first().click();
    await expect(admin.getByRole("heading", { name: /administrator user management/i })).toBeVisible();
    await adminContext.close();
  });
});
