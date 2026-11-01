import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { login } from "../lab-03/capture";
import {
  REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD,
  REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD,
  createFreshTicketAsRequester,
} from "../lab-03/api-fixtures";

// I-9 report evidence: the Actions Taken and status-control screens the Part 5/6 answers cite.
const OUT = path.resolve(__dirname, "../../artifacts/lab-04/report-screens/app");
test.describe.configure({ timeout: 180_000 });

test("actions taken lifecycle and role restrictions", async ({ page, browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  const ticket = await createFreshTicketAsRequester();
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.goto(`/staff/tickets/${ticket.id}`);
  await page.getByRole("button", { name: /^claim$/i }).click();
  await expect(page.getByText("Owner updated.")).toBeVisible();
  const actions = page.getByTestId("actions-taken");

  await actions.getByRole("button", { name: /add action/i }).click();
  await page.locator("#action-description").fill("Reset the user's network profile");
  await page.locator("#action-assignee option").nth(1).waitFor({ state: "attached" }).catch(() => {});
  const options = await page.locator("#action-assignee option").allTextContents();
  const other = options.findIndex((t) => /admin/i.test(t));
  if (other >= 0) await page.locator("#action-assignee").selectOption({ index: other });
  await shot("01-new-action-assigned-to-another-staff");
  await page.getByRole("button", { name: /save action/i }).click();
  await expect(actions.getByTestId("actions-table").getByText(/network profile/)).toBeVisible();
  await shot("02-action-listed-with-assignee");

  await page.getByRole("button", { name: /^view action \d+$/i }).first().click();
  await page.getByRole("button", { name: /^start$/i }).click();
  await expect(page.getByTestId("action-status-badge").first()).toBeVisible();
  await shot("03-action-started-in-progress");

  await page.getByRole("button", { name: /^complete$/i }).click();
  await page.locator("#action-result").fill("Profile rebuilt, user can reach the share again");
  await page.getByRole("button", { name: /save changes/i }).click();
  await shot("04-action-completed");

  await actions.getByRole("button", { name: /add action/i }).click();
  await page.locator("#action-description").fill("Order a replacement dock");
  await page.getByRole("button", { name: /save action/i }).click();
  await expect(actions.getByTestId("actions-table").getByText(/replacement dock/)).toBeVisible();
  await page.getByRole("button", { name: /^view action \d+$/i }).last().click();
  await page.getByRole("button", { name: /cancel action/i }).click();
  await shot("05-action-cancelled-terminal");

  // Ticket status control: transition with a reason, then the history.
  const statuses = await page.locator("#status-select option").allTextContents();
  await shot("06-status-control-options");
  const pick = statuses.find((s) => /in progress/i.test(s));
  if (pick) {
    await page.locator("#status-select").selectOption({ label: pick });
    if (await page.locator("#status-reason").count()) await page.locator("#status-reason").fill("Working on it").catch(() => {});
    await shot("07-status-transition-ready");
  }

  // Requester: read-only list, and the staff page is refused.
  const ctx = await browser.newContext();
  const req = await ctx.newPage();
  await login(req, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  await req.goto(`/tickets/${ticket.id}`);
  await expect(req.getByTestId("actions-taken")).toBeVisible();
  await req.getByTestId("actions-taken").scrollIntoViewIfNeeded();
  await req.screenshot({ path: path.join(OUT, "08-requester-read-only-actions.png"), fullPage: true });
  await req.goto(`/staff/tickets/${ticket.id}`);
  await req.waitForTimeout(800);
  await req.screenshot({ path: path.join(OUT, "09-requester-blocked-from-staff-page.png"), fullPage: true });
  await ctx.close();
});

test("status transitions, resolution gate and history", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  const ticket = await createFreshTicketAsRequester();
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.goto(`/staff/tickets/${ticket.id}`);
  await page.getByRole("button", { name: /^claim$/i }).click();
  await expect(page.getByText("Owner updated.")).toBeVisible();
  const apply = async (label: RegExp, reason?: string) => {
    const opts = await page.locator("#status-select option").allTextContents();
    const t = opts.find((o) => label.test(o));
    if (!t) throw new Error(`no option ${label} in ${opts.join("|")}`);
    await page.locator("#status-select").selectOption({ label: t });
    if (reason && (await page.locator("#status-reason").count())) await page.locator("#status-reason").fill(reason);
    await page.getByRole("button", { name: /^apply$/i }).click();
    await page.waitForTimeout(700);
  };
  await apply(/in progress/i);
  await shot("10-status-in-progress-with-history");
  // Open action blocks Resolved (BR-19).
  await page.getByTestId("actions-taken").getByRole("button", { name: /add action/i }).click();
  await page.locator("#action-description").fill("Replace the keyboard");
  await page.getByRole("button", { name: /save action/i }).click();
  await expect(page.getByTestId("actions-table").getByText(/keyboard/)).toBeVisible();
  await page.reload();
  await shot("11-resolution-gate-open-action");
  await page.getByRole("button", { name: /^view action \d+$/i }).first().click();
  await page.getByRole("button", { name: /^complete$/i }).click();
  await page.locator("#action-result").fill("Keyboard replaced");
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForTimeout(800);
  await apply(/resolved/i, "Keyboard replaced and confirmed with the user");
  await shot("12-ticket-resolved-history");
  await apply(/reopen|in progress/i, "User reports the issue is back");
  await shot("13-reopened-with-reason-history");
});
