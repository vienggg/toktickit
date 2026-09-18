import { type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Screenshot capture harness for Lab 3 evidence (docs/lab-03/sprint-plan.md §3).
 *
 * Usage from a spec:
 *   import { login, shoot, VIEWPORTS } from "./capture";
 *   await login(page, "requester1@toktick.internal", "password");
 *   await shoot(page, "authentication", "Figure-5.1-login-success");
 *
 * Rules:
 * - One capture folder per required screenshot area: authentication,
 *   staff-queue, staff-ticket-detail, user-management. Do not invent a 5th.
 * - Each feature issue extends this file / its own spec; screenshots are
 *   captured as part of that issue's PR, never batched at the end.
 * - Figure names should read like the PDF caption they'll get.
 */

export const SCREENSHOT_ROOT = path.resolve(__dirname, "../../artifacts/lab-03/screenshots");

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

export type ScreenshotFolder =
  | "authentication"
  | "staff-queue"
  | "staff-ticket-detail"
  | "user-management";

/** Log in through the real UI (cookie-based session, D-01) and wait for the app shell. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  // getByLabel(/password/i) alone also matches the "Show password" toggle
  // button (its aria-label contains "password"); the textbox role narrows
  // it to the actual <input>.
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  // The click triggers an async POST /api/auth/login followed by a client-
  // side redirect; without waiting for that redirect, an immediate
  // page.goto() elsewhere in a spec can race ahead of it and land back on
  // /login. Wait for the URL to actually leave /login before returning.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

/**
 * Capture one figure at one or all three required viewports.
 * File lands at artifacts/lab-03/screenshots/<folder>/<figure>@<viewport>.png
 */
export async function shoot(
  page: Page,
  folder: ScreenshotFolder,
  figure: string,
  viewport: keyof typeof VIEWPORTS | "all" = "desktop"
) {
  const dir = path.join(SCREENSHOT_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const targets = viewport === "all" ? (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) : [viewport];

  // Capturing "all" iterates desktop -> tablet -> mobile and, without this,
  // left the page stuck at the last (mobile, 375x812) viewport afterward —
  // an undocumented side effect that every subsequent interaction in the
  // calling spec then silently ran under. Callers worked around it with
  // hand-rolled `page.setViewportSize(...)` resets scattered after each
  // "all" capture (review of PR #70, item 3); fixing it once here, by
  // restoring whatever viewport the page was actually at before this call,
  // removes the need for every one of those call sites.
  const originalViewport = page.viewportSize();

  for (const vp of targets) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await page.waitForLoadState("networkidle");
    const file = path.join(dir, `${figure}@${vp}.png`);
    await page.screenshot({ path: file, fullPage: true });
  }

  if (viewport === "all" && originalViewport) {
    await page.setViewportSize(originalViewport);
  }
}
