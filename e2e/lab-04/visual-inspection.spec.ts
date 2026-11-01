import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { login, VIEWPORTS } from "../lab-03/capture";
import {
  REGRESSION_STAFF_EMAIL,
  REGRESSION_STAFF_PASSWORD,
  REGRESSION_ADMIN_EMAIL,
  REGRESSION_ADMIN_PASSWORD,
  REGRESSION_REQUESTER_EMAIL,
  REGRESSION_REQUESTER_PASSWORD,
  createFreshTicketAsRequester,
} from "../lab-03/api-fixtures";

// I-7 (docs/lab-04/ui-spec.md section 9): every Lab 4 screen at 1280, 768 and 375 px.
// Each screen is photographed and checked for horizontal overflow (V-01), console
// errors (V-15) and, on mobile, touch-target size (V-13). Results land in
// artifacts/lab-04/screenshots/inspection-results.json for the final report.

const ROOT = path.resolve(__dirname, "../../artifacts/lab-04/screenshots");
const results: Array<Record<string, unknown>> = [];

test.describe.configure({ timeout: 180_000 });

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    // The signed-out probe GET /api/auth/me answers 401 by design (Lab 3 API-07).
    if (msg.type() === "error" && !/status of 401 \(Unauthorized\)/.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

async function inspect(page: Page, folder: string, figure: string, errors: string[]) {
  fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      // Inline text links are exempt (WCAG 2.5.8); buttons, fields and card links must be 44 px.
      const small = Array.from(document.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, a.btn, a.metric-card"))
        .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden")
        .filter((el) => { // A checkbox's target includes its label, so measure that.
          const box = el instanceof HTMLInputElement && el.type === "checkbox" && el.labels?.[0] ? el.labels[0] : el;
          const r = box.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
        .map((el) => el.outerHTML.slice(0, 100));
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, smallTargets: small };
    });
    await page.screenshot({ path: path.join(ROOT, folder, `${figure}@${name}.png`), fullPage: true });
    results.push({ folder, figure, viewport: name, width: size.width, overflow: metrics.scrollWidth > metrics.clientWidth, smallTargets: metrics.smallTargets.length, consoleErrors: errors.length });
    expect(metrics.scrollWidth, `${figure} @${name} must not scroll horizontally`).toBeLessThanOrEqual(metrics.clientWidth);
    if (name === "mobile") expect(metrics.smallTargets, `${figure} @mobile has controls smaller than 44 px`).toEqual([]);
  }
  await page.setViewportSize(VIEWPORTS.desktop);
}

test.afterAll(() => {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, "inspection-results.json"), JSON.stringify(results, null, 2));
});

test("requester dashboard and ticket detail", async ({ page }) => {
  const errors = watchConsole(page);
  const ticket = await createFreshTicketAsRequester();
  await login(page, REGRESSION_REQUESTER_EMAIL, REGRESSION_REQUESTER_PASSWORD);
  await page.goto("/dashboard");
  await expect(page.getByTestId("requester-dashboard")).toBeVisible();
  await inspect(page, "requester-dashboard", "Figure-requester-dashboard", errors);
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByTestId("actions-taken")).toBeVisible();
  await inspect(page, "requester-dashboard", "Figure-requester-ticket-detail", errors);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("staff dashboard, actions taken and status history", async ({ page }) => {
  const errors = watchConsole(page);
  const ticket = await createFreshTicketAsRequester();
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  await page.goto(`/staff/tickets/${ticket.id}`);
  await page.getByRole("button", { name: /^claim$/i }).click();
  await expect(page.getByText("Owner updated.")).toBeVisible();
  await inspect(page, "actions-taken", "Figure-actions-empty", errors);

  const actions = page.getByTestId("actions-taken");
  await actions.getByRole("button", { name: /add action/i }).click();
  await page.locator("#action-description").fill("Checked the printer queue and cleared the stuck jobs, then restarted the print spooler on the shared floor server");
  await page.getByLabel(/follow-up required/i).check();
  await page.getByRole("button", { name: /save action/i }).click();
  await inspect(page, "actions-taken", "Figure-action-validation-error", errors);
  await page.locator("#action-followup-note").fill("Check the queue again on Friday");
  await page.locator("#action-attachment-notes").fill("Screenshot of the queue is in the IT shared folder");
  await page.getByRole("button", { name: /save action/i }).click();
  await expect(actions.getByTestId("actions-table").getByText(/printer queue/)).toBeVisible();

  await actions.getByRole("button", { name: /add action/i }).click();
  await page.locator("#action-description").fill("Replace the toner cartridge");
  await page.getByRole("button", { name: /save action/i }).click();
  await expect(actions.getByTestId("actions-table").getByText(/toner cartridge/)).toBeVisible();
  await inspect(page, "actions-taken", "Figure-actions-list", errors);

  await page.getByRole("button", { name: /^view action \d+$/i }).first().click();
  await expect(page.getByRole("region", { name: /action details/i })).toBeVisible();
  await inspect(page, "actions-taken", "Figure-action-details", errors);

  await page.goto("/dashboard");
  await expect(page.getByTestId("staff-dashboard")).toBeVisible();
  await inspect(page, "staff-dashboard", "Figure-staff-dashboard", errors);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("administrator dashboard with user counts", async ({ page }) => {
  const errors = watchConsole(page);
  await login(page, REGRESSION_ADMIN_EMAIL, REGRESSION_ADMIN_PASSWORD);
  await page.goto("/dashboard");
  await expect(page.getByTestId("user-counts")).toBeVisible();
  await inspect(page, "staff-dashboard", "Figure-admin-dashboard", errors);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("keyboard: every control on the Lab 4 screens is reachable, labelled and shows a focus ring (V-05..V-07, V-14)", async ({ page }) => {
  const ticket = await createFreshTicketAsRequester();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
  const problems: string[] = [];
  for (const url of ["/dashboard", `/staff/tickets/${ticket.id}`]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const count = await page.evaluate(() => document.querySelectorAll("a[href], button:not(:disabled), input:not([type=hidden]), select, textarea").length);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < count + 5; i += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const name = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent?.trim() || el.getAttribute("title") || "";
        return { tag: el.tagName, name: name.trim(), ring: el.matches(":focus-visible") && ((style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none"), transition: style.transitionDuration };
      });
      if (!info) continue;
      if (!info.name) problems.push(`${url}: unlabelled ${info.tag}`);
      if (!info.ring) problems.push(`${url}: no focus ring on ${info.tag} "${info.name.slice(0, 30)}"`);
    }
  }
  results.push({ folder: "keyboard", figure: "tab-audit", problems });
  expect(problems, problems.join(", ")).toEqual([]);
});
