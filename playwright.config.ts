import { defineConfig, devices } from "@playwright/test";

/**
 * Root Playwright config for TokTickIT.
 * Covers e2e/lab-0X/*.spec.ts specs and the screenshot capture harness.
 * Requires the client (5173) and server (3000) dev servers running,
 * either manually or via the webServer blocks below.
 */
export default defineConfig({
  testDir: "./e2e",
  // Provisions the regression-suite-{requester,staff,admin}@toktick.internal
  // fixture accounts every e2e/lab-03 spec logs in as, directly via Prisma,
  // so this suite never silently depends on the server's own vitest suite
  // having run first against the same database (review of PR #70, item 1).
  // See e2e/lab-03/global-setup.ts for the full rationale.
  globalSetup: "./e2e/lab-03/global-setup.ts",
  fullyParallel: false, // seeded DB state is shared; keep specs serialized
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "./server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: "./client",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
