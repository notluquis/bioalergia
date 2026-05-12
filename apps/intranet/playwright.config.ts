import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
// Default target is `vite preview` on :4173 (production build + the
// configurePreviewServer middleware that fills the CSP nonce placeholder).
// Override with E2E_BASE_URL to point at a deployed environment.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

/**
 * Playwright config for intranet e2e + axe-based a11y scans.
 *
 * Auth-protected suites pull credentials from E2E_USER / E2E_PASS. They are
 * skipped automatically when those env vars are missing so a fresh checkout
 * (or a fork PR with no secrets) can still run the unauthenticated routes.
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
      // Mobile emulation via Chromium (skips the WebKit binary). Keeps the
      // iPhone 14 Pro viewport (393×852), pixel ratio 3, and touch flag.
      name: "chromium-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // `pnpm preview` serves the prod build via `vite preview`. The Vite
        // config's configurePreviewServer middleware substitutes the
        // {{ placeholder "http.request.uuid" }} sentinel + emits a matching
        // CSP header so React mounts. Build first (CI does
        // `turbo run build --filter=@finanzas/intranet`).
        command: "pnpm preview --port 4173 --strictPort",
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
