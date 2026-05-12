import { defineConfig, devices } from "@playwright/test";

import * as fs from "node:fs";
import * as path from "node:path";

const isCI = Boolean(process.env.CI);
// Two base URLs:
//   PREVIEW_URL — local vite preview, always-fresh code from this commit.
//                  Used by unauthed UI/UX specs so they exercise the latest
//                  index.html / theme tokens / a11y fixes immediately.
//   AUTHED_URL  — deployed Railway when secret is set. Authed specs hit
//                  the real API (login, oRPC reads).
// When AUTHED_URL is unset, authed projects fall back to PREVIEW_URL and
// the API-probe in auth.setup.ts gates them off cleanly.
const PREVIEW_URL = "http://localhost:4173";
const AUTHED_URL = process.env.E2E_BASE_URL ?? PREVIEW_URL;

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
    baseURL: PREVIEW_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-CL",
    timezoneId: "America/Santiago",
  },

  projects: [
    // ── Setup: log in once and persist storageState ─────────────────────
    // Runs first; every authed project depends on it. One real auth POST
    // per CI run instead of one per test (avoids 429 on the live API).
    // baseURL = AUTHED_URL because the cookie has to be issued by the
    // backend whose origin the authed projects will call.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { baseURL: AUTHED_URL },
    },

    // ── Unauthenticated specs (no storageState) ─────────────────────────
    // Run independently; do not require login.
    {
      name: "chromium-desktop-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Pixel 7 device descriptor is Chromium-based + ships realistic UA
      // and screen metrics. Replaces the hand-rolled viewport block we had
      // before — gives us proper Android UA without pulling in WebKit.
      name: "chromium-mobile-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },

    // ── Authed specs (storageState pre-loaded, hit AUTHED_URL) ──────────
    {
      name: "chromium-desktop",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: "playwright/.auth/user.json",
        baseURL: AUTHED_URL,
      },
    },
    {
      name: "chromium-mobile",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/user.json",
        baseURL: AUTHED_URL,
      },
    },
  ],

  // Always start `vite preview` so the unauthed UI/UX projects exercise
  // the latest committed code (Railway deploys lag pushes by minutes; we
  // shouldn't fail a CI run waiting on the deploy pipeline). Authed
  // projects override baseURL to AUTHED_URL.
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: PREVIEW_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
