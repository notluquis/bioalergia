import { defineConfig, devices } from "@playwright/test";

import * as fs from "node:fs";
import * as path from "node:path";

const isCI = Boolean(process.env.CI);
// Default target is `vite preview` on :4173 (production build + the
// configurePreviewServer middleware that fills the CSP nonce placeholder).
// Override with E2E_BASE_URL to point at a deployed environment.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

// Authed projects depend on the `setup` project which writes
// playwright/.auth/user.json. When credentials are missing locally
// (typical dev), don't declare the dependency — the authed project's
// fixtures skip themselves at runtime, but Playwright still validates
// `storageState` resolves to a file even before tests run. Touch the
// file so the validator passes; setup will overwrite when it runs.
const HAVE_E2E_CREDS = Boolean(process.env.E2E_USER && process.env.E2E_PASS);
const STORAGE_STATE_PATH = "playwright/.auth/user.json";
if (!HAVE_E2E_CREDS) {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
  }
}

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
    // ── Setup: log in once and persist storageState ─────────────────────
    // Runs first; every other project depends on it. One real auth POST
    // per CI run instead of one per test (avoids 429 on the live API).
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // ── Unauthenticated specs (no storageState) ─────────────────────────
    // Run independently; do not require login.
    {
      name: "chromium-desktop-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "chromium-mobile-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },

    // ── Authed specs (storageState pre-loaded) ──────────────────────────
    {
      name: "chromium-desktop",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: "playwright/.auth/user.json",
      },
    },
    {
      name: "chromium-mobile",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        browserName: "chromium",
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: "playwright/.auth/user.json",
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
