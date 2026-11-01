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

// E2E-01, E2E-02, E2E-09 (docs/lab-04/tests.md): two different staff record
// actions on one ticket, the Requester sees them read-only, validation is
// inline, a double click creates exactly one action, and no console errors.

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Before login the app probes GET /api/auth/me, which answers 401 by design and
    // Chrome logs as a resource error. Tracked for the hardening issue (I-6); any
    // other console error still fails this test.
    if (/status of 401 \(Unauthorized\)/.test(msg.text())) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

test.describe("Actions Taken flow", () => {
  test.describe.configure({ timeout: 90_000 });
  let ticket: { id: number; ticketNumber: string };

  test.beforeAll(async () => {
    ticket = await createFreshTicketAsRequester();
  });

  test("staff and admin record actions, the Requester sees them read-only", async ({ page, browser }) => {
    const consoleErrors = collectConsoleErrors(page);

    // Staff claims the ticket, so the Ticket Owner is the regression staff member.
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByText("Owner updated.")).toBeVisible();

    const actions = page.getByTestId("actions-taken");
    await expect(actions.getByText(/no actions recorded yet/i)).toBeVisible();

    // E2E-02: inline validation (follow-up needs a note) before anything is sent.
    await actions.getByRole("button", { name: /add action/i }).click();
    await page.locator("#action-description").fill("Checked the printer queue and cleared stuck jobs");
    await page.getByLabel(/follow-up required/i).check();
    await page.getByRole("button", { name: /save action/i }).click();
    await expect(page.getByText("Follow-up note is required when follow-up is required.")).toBeVisible();
    await expect(page.locator("#action-followup-note")).toBeFocused();

    await page.locator("#action-followup-note").fill("Check the queue again on Friday");
    await page.locator("#action-attachment-notes").fill("Screenshot of the queue is in the IT shared folder");
    await page.getByRole("button", { name: /save action/i }).click();
    const table = actions.getByTestId("actions-table");
    await expect(table.getByText("Checked the printer queue and cleared stuck jobs")).toBeVisible();
    await expect(table.getByText("Check the queue again on Friday")).toBeVisible();
    await expect(table.getByText(/recorded by regression suite staff/i)).toBeVisible();

    // E2E-09: a double click on Save creates exactly one action.
    await actions.getByRole("button", { name: /add action/i }).click();
    await page.locator("#action-description").fill("Double click check");
    await page.getByRole("button", { name: /save action/i }).dblclick();
    await expect(table.getByText("Double click check")).toBeVisible();
    await expect(table.locator("tbody tr", { hasText: "Double click check" })).toHaveCount(1);

    // A second IT member (the Administrator) records an action; the owner is unchanged (BR-02).
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
    await adminPage.goto(`/staff/tickets/${ticket.id}`);
    const adminTable = adminPage.getByTestId("actions-table");
    await expect(adminTable.getByText("Checked the printer queue and cleared stuck jobs")).toBeVisible();
    await adminPage.getByRole("button", { name: /add action/i }).click();
    await adminPage.locator("#action-description").fill("Replaced the toner cartridge");
    await adminPage.getByRole("button", { name: /save action/i }).click();
    await expect(adminTable.getByText("Replaced the toner cartridge")).toBeVisible();
    await expect(adminTable.getByText(/recorded by regression suite admin/i)).toBeVisible();
    await expect(adminPage.locator("#owner-select")).toHaveValue(/\d+/);
    await expect(adminPage.locator("#owner-select option:checked")).toHaveText(/regression suite staff/i);
    await adminContext.close();

    // The Requester sees every action, read-only.
    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    await login(requesterPage, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await requesterPage.goto("/tickets");
    await requesterPage.locator("#ticket-search").fill(ticket.ticketNumber);
    await requesterPage.getByRole("button", { name: new RegExp(ticket.ticketNumber) }).click();
    const requesterActions = requesterPage.getByTestId("actions-taken");
    await expect(requesterActions.getByText(/steps IT has taken on your ticket/i)).toBeVisible();
    await expect(requesterActions.getByTestId("actions-table").getByText("Replaced the toner cartridge")).toBeVisible();
    await expect(requesterActions.getByTestId("actions-table").getByText("Check the queue again on Friday")).toBeVisible();
    await expect(requesterActions.getByRole("button", { name: /add action|edit|view action|start|cancel action/i })).toHaveCount(0);
    await requesterContext.close();

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("two people editing one action get a conflict instead of an overwrite", async ({ page, browser }) => {
    const fresh = await createFreshTicketAsRequester();
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto(`/staff/tickets/${fresh.id}`);
    await page.getByRole("button", { name: /add action/i }).click();
    await page.locator("#action-description").fill("Original wording");
    await page.getByRole("button", { name: /save action/i }).click();
    await expect(page.getByTestId("actions-table").getByText("Original wording")).toBeVisible();

    // Both people open the same action for editing.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await login(other, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
    await other.goto(`/staff/tickets/${fresh.id}`);
    await other.getByRole("button", { name: /^view action \d+$/i }).click();
    await other.getByRole("button", { name: /^edit$/i }).click();
    await page.getByRole("button", { name: /^view action \d+$/i }).click();
    await page.getByRole("button", { name: /^edit$/i }).click();

    await other.locator("#action-description").fill("Edited by the Administrator");
    await other.getByRole("button", { name: /save changes/i }).click();
    await expect(other.getByTestId("actions-table").getByText("Edited by the Administrator")).toBeVisible();

    await page.locator("#action-description").fill("Edited by staff, too late");
    await page.getByRole("button", { name: /save changes/i }).click();
    const banner = page.getByRole("alert").filter({ hasText: /changed by someone else/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Edited by the Administrator");
    await expect(page.locator("#action-description")).toHaveValue("Edited by staff, too late");
    await otherContext.close();
  });
});
