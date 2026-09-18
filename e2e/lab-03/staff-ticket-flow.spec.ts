import { test, expect } from "@playwright/test";
import { login, shoot } from "./capture";
import { REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD, createFreshTicketAsRequester } from "./api-fixtures";

// E2E-03 (FR-14-FR-19) per docs/lab-03/tests.md: full staff workflow —
// Queue -> open Ticket -> claim -> set IT Priority -> change status ->
// post comment -> post note. Uses a dedicated fresh ticket (created via the
// real API in test.beforeAll, not reused from seed data) so this spec never
// races another test's ownership/status/comment changes on a shared row.

test.describe("E2E-03: full staff ticket workflow", () => {
  let ticketNumber: string;

  test.beforeAll(async () => {
    const ticket = await createFreshTicketAsRequester();
    ticketNumber = ticket.ticketNumber;
  });

  test("queue -> open -> claim -> IT priority -> status -> comment -> note", async ({ page }) => {
    await login(page, REGRESSION_STAFF_EMAIL, REGRESSION_STAFF_PASSWORD);
    await expect(page).toHaveURL(/\/staff\/queue|\/$/);
    await page.goto("/staff/queue");
    await expect(page.getByRole("heading", { name: /it staff ticket queue/i })).toBeVisible();

    // staff-queue folder's primary content: capture the queue at all 3
    // viewports before touching any filters.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForLoadState("networkidle");
    await shoot(page, "staff-queue", "Figure-queue-overview", "all");

    // Find the fresh fixture ticket via the search box, independent of
    // whatever page/sort state the queue defaults to. shoot(..., "all")
    // above already restores the desktop viewport it was called at, so no
    // manual reset is needed here (review of PR #70, item 3) — the desktop
    // table, tablet table, and mobile cards are all present in the DOM
    // simultaneously (Bootstrap display-utility breakpoints hide the other
    // two via CSS), so a bare text/row locator would match all three and
    // violate Playwright's strict mode.
    await page.getByLabel(/search/i).fill(ticketNumber);
    const desktopTable = page.locator(".d-none.d-lg-block");
    await expect(desktopTable.getByText(ticketNumber)).toBeVisible({ timeout: 10_000 });
    await shoot(page, "staff-queue", "Figure-queue-filtered-search", "desktop");

    // Open the ticket via the desktop table's row.
    const row = desktopTable.locator("tr", { hasText: ticketNumber }).first();
    await row.getByRole("button", { name: /open/i }).click();

    await expect(page).toHaveURL(/\/staff\/tickets\/\d+/);
    await expect(page.locator("span.font-monospace", { hasText: ticketNumber })).toBeVisible();

    // staff-ticket-detail folder: capture the detail screen (includes the
    // Internal Notes panel's distinct styling) at all 3 viewports before
    // any edits.
    await shoot(page, "staff-ticket-detail", "Figure-ticket-detail-unclaimed", "all");

    const internalNotesPanel = page.getByTestId("internal-notes-panel");
    await expect(internalNotesPanel).toBeVisible();
    await expect(internalNotesPanel).toContainText(/internal — not visible to requester/i);

    // Claim. The fixture ticket is always freshly created and unowned (see
    // createFreshTicketAsRequester in api-fixtures.ts), so the Claim button
    // MUST be visible here — asserting that (rather than conditionally
    // clicking it only `if` it happens to be visible) makes this a real
    // regression check: if a future change stopped the button from
    // rendering at all, this now fails loudly instead of silently passing
    // (review of PR #70, item 2).
    const claimButton = page.getByRole("button", { name: /^claim$/i });
    await expect(claimButton).toBeVisible();
    await claimButton.click();
    await expect(page.getByText(/owner updated/i)).toBeVisible({ timeout: 10_000 });

    // Confirm ownership actually changed — not just that the Claim button
    // disappeared (which would also be true if claiming silently no-opped),
    // but that the Owner select now reflects the acting staff user.
    const ownerSelect = page.locator("#owner-select");
    await expect(ownerSelect).toHaveValue(/^\d+$/, { timeout: 10_000 });
    await expect(page.locator("#owner-select option:checked")).toHaveText(/regression suite staff/i);

    // After claiming, the Claim button disappears because ticket.ownerId
    // is now set (StaffTicketDetail only renders it while unowned).
    await expect(page.getByRole("button", { name: /^claim$/i })).not.toBeVisible();

    // Set IT Priority (independent of the read-only Requested Priority).
    await page.getByLabel(/^it priority$/i).selectOption("HIGH");
    await page.getByRole("button", { name: /save it priority/i }).click();
    await expect(page.getByText(/it priority updated/i)).toBeVisible({ timeout: 10_000 });

    // Change status along a legal transition: NEW -> IN_PROGRESS is only
    // legal once owned (BR-17), which this ticket now is.
    await page.getByLabel(/change status to/i).selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page.getByText(/status updated/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("status-badge").first()).toContainText(/in progress/i);

    // Post a Public Comment.
    const commentText = `E2E staff comment ${Date.now()}`;
    await page.getByLabel(/add a comment/i).fill(commentText);
    await page.getByRole("button", { name: /post comment/i }).click();
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10_000 });

    // Post an Internal Note.
    const noteText = `E2E staff internal note ${Date.now()}`;
    await page.getByLabel(/add an internal note/i).fill(noteText);
    await page.getByRole("button", { name: /post internal note/i }).click();
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

    await shoot(page, "staff-ticket-detail", "Figure-ticket-detail-after-actions", "all");
  });
});
