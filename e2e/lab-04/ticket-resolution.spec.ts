import { test, expect, type Page } from "@playwright/test";
import { login } from "../lab-03/capture";
import {
  REGRESSION_STAFF_EMAIL,
  REGRESSION_STAFF_PASSWORD,
  REGRESSION_REQUESTER_EMAIL,
  REGRESSION_REQUESTER_PASSWORD,
  createFreshTicketAsRequester,
} from "../lab-03/api-fixtures";

// E2E-04, E2E-05 (docs/lab-04/tests.md): the lifecycle with the resolution gate
// (blocked, then allowed), the history timeline, Close, Reopen and Cancel with reasons,
// and the Requester's advisory "Problem Appears Resolved" signal.

async function applyStatus(page: Page, status: string, reason?: string) {
  await page.locator("#status-select").selectOption(status);
  if (reason !== undefined) await page.locator("#status-reason").fill(reason);
  await page.getByRole("button", { name: /^apply$/i }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();
}

const headerStatus = (page: Page) => page.getByTestId("status-badge").first();

test.describe("Ticket resolution and lifecycle", () => {
  test.describe.configure({ timeout: 90_000 });
  test("Resolve is blocked until an action is completed, then the ticket is resolved, closed and reopened", async ({ page }) => {
    const ticket = await createFreshTicketAsRequester();
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto(`/staff/tickets/${ticket.id}`);

    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByText("Owner updated.")).toBeVisible();
    await applyStatus(page, "OPEN");
    await applyStatus(page, "IN_PROGRESS");
    await expect(headerStatus(page)).toHaveAttribute("data-status", "IN_PROGRESS");

    // No completed action yet: Resolve is not offered and the page says why.
    const blocked = page.getByTestId("resolve-blocked");
    await expect(blocked).toContainText(/at least one action must be completed/i);
    await expect(page.locator("#status-select option[value='RESOLVED']")).toHaveCount(0);

    // A planned action blocks too; completing it unblocks Resolve.
    await page.getByRole("button", { name: /add action/i }).click();
    await page.locator("#action-description").fill("Reset the user's password and verified login");
    await page.getByRole("button", { name: /save action/i }).click();
    await expect(page.getByTestId("resolve-blocked")).toContainText(/finish or cancel the planned and in-progress actions/i);

    await page.getByRole("button", { name: /^view action \d+$/i }).click();
    await page.getByRole("button", { name: /^complete$/i }).click();
    await page.locator("#action-result").fill("Login works again.");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByTestId("resolve-blocked")).toHaveCount(0);
    await expect(page.locator("#status-select option[value='RESOLVED']")).toHaveCount(1);

    await applyStatus(page, "RESOLVED");
    await expect(headerStatus(page)).toHaveAttribute("data-status", "RESOLVED");
    // Actions are locked once the ticket is resolved.
    await expect(page.getByText(/actions are locked/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add action/i })).toHaveCount(0);

    await applyStatus(page, "CLOSED");
    await expect(headerStatus(page)).toHaveAttribute("data-status", "CLOSED");

    // Reopen needs a reason; the timeline lists every change in order and shows the reason to staff.
    await page.locator("#status-select").selectOption("REOPENED");
    await expect(page.getByRole("button", { name: /^apply$/i })).toBeDisabled();
    await page.locator("#status-reason").fill("The problem came back after a restart");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(headerStatus(page)).toHaveAttribute("data-status", "REOPENED");
    await expect(page.getByRole("button", { name: /add action/i })).toBeVisible();

    const history = page.getByRole("list", { name: /status history/i });
    const entries = history.locator("li");
    await expect(entries).toHaveCount(5);
    await expect(entries.last()).toContainText("Reopened");
    await expect(entries.last()).toContainText("The problem came back after a restart");
  });

  test("the Requester's resolved signal is advisory, and staff can cancel only with a reason", async ({ page, browser }) => {
    const ticket = await createFreshTicketAsRequester();

    const requesterContext = await browser.newContext();
    const requester = await requesterContext.newPage();
    await login(requester, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
    await requester.goto("/tickets");
    await requester.locator("#ticket-search").fill(ticket.ticketNumber);
    await requester.getByRole("button", { name: new RegExp(ticket.ticketNumber) }).click();
    await requester.getByRole("button", { name: /problem appears resolved/i }).click();
    await expect(requester.getByText(/you indicated this problem appears resolved/i)).toBeVisible();
    await requesterContext.close();

    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await page.goto(`/staff/tickets/${ticket.id}`);
    // The signal changed nothing: the ticket is still New.
    await expect(headerStatus(page)).toHaveAttribute("data-status", "NEW");

    await page.locator("#status-select").selectOption("CANCELLED");
    await expect(page.getByRole("button", { name: /^apply$/i })).toBeDisabled();
    await page.locator("#status-reason").fill("Requester confirmed it fixed itself");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(headerStatus(page)).toHaveAttribute("data-status", "CANCELLED");
    await expect(page.getByText(/terminal status with no further transitions/i)).toBeVisible();
  });
});
