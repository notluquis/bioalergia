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

const HAVE_E2E_CREDS = Boolean(process.env.E2E_USER && process.env.E2E_PASS);
const STORAGE_STATE_PATH = "playwright/.auth/user.json";
if (!HAVE_E2E_CREDS) {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
  }
}

// Viewport anchors aligned with Chromatic Story Modes (.storybook/modes.ts).
// A regression in any of these widths narrows to the same bucket regardless
// of which tool caught it.
const MOBILE = { width: 375, height: 740 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

const chromium = devices["Desktop Chrome"];

/**
 * Playwright config — viewport-keyed projects (golden 2026 pattern).
 *
 * One spec, N projects: assertions like "drawer opens at <lg, split layout
 * at >=lg" become provable by gating tests with `test.skip(({ project }) =>
 * project.name !== 'mobile')`. setViewportSize mid-test is avoided because
 * mid-test resize is flaky on React Aria + HeroUI portals.
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
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { baseURL: AUTHED_URL, ...chromium, viewport: DESKTOP },
    },

    // ── Unauthenticated specs (no storageState, vite preview) ───────────
    {
      name: "mobile-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      use: { ...chromium, viewport: MOBILE, hasTouch: true, isMobile: true },
    },
    {
      name: "tablet-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      use: { ...chromium, viewport: TABLET, hasTouch: true, isMobile: true },
    },
    {
      name: "desktop-unauthed",
      testIgnore: /a11y\.spec\.ts|skip-link\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      use: { ...chromium, viewport: DESKTOP },
    },

    // ── Authed specs (storageState pre-loaded, hit AUTHED_URL) ──────────
    {
      name: "mobile",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...chromium,
        viewport: MOBILE,
        hasTouch: true,
        isMobile: true,
        storageState: STORAGE_STATE_PATH,
        baseURL: AUTHED_URL,
      },
    },
    {
      name: "tablet",
      testMatch: /a11y\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...chromium,
        viewport: TABLET,
        hasTouch: true,
        isMobile: true,
        storageState: STORAGE_STATE_PATH,
        baseURL: AUTHED_URL,
      },
    },
    {
      name: "desktop",
      testMatch: /a11y\.spec\.ts|skip-link\.spec\.ts|wa-cloud-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...chromium,
        viewport: DESKTOP,
        storageState: STORAGE_STATE_PATH,
        baseURL: AUTHED_URL,
      },
    },
  ],

  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: PREVIEW_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
