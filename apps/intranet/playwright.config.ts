import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const isCI = Boolean(process.env.CI);

/**
 * Playwright config for intranet e2e + axe-based a11y scans.
 *
 * Default target is the Vite preview server on :4173 (built artefact, mirrors
 * production CSP/budget). Override with E2E_BASE_URL to point at a deployed
 * environment (e.g. Railway preview).
 *
 * Auth-protected suites pull credentials from E2E_USER / E2E_PASS. They are
 * skipped automatically when those env vars are missing so a fresh checkout
 * can still run the unauthenticated routes (login, public).
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never", outputFolder: "./e2e-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "./e2e-report" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-CL",
    timezoneId: "America/Santiago",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["iPhone 14 Pro"] },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Vite dev server: no CSP nonce placeholder issue (the prod build's
        // nonce is substituted at request time by Caddy and is not present
        // when running `vite preview` standalone). For deployed-environment
        // runs, set E2E_BASE_URL=https://intranet.bioalergia.cl.
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
