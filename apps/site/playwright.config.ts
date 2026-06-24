import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// baseURL precedence:
//   E2E_BASE_URL — when set (e.g. a CI harness or a deployed preview), specs
//                  hit that origin and NO local webServer is booted. This lets
//                  an external harness own the server lifecycle without this
//                  config fighting it.
//   localhost:4173 — default. We boot a local `vite preview` (serves dist/)
//                    on this port so a fresh checkout / local dev run works
//                    with zero extra setup.
const PREVIEW_URL = "http://localhost:4173";
const BASE_URL = process.env.E2E_BASE_URL ?? PREVIEW_URL;

// Only manage a webServer when no external base URL is provided. When
// E2E_BASE_URL is set the caller is responsible for serving the site.
const MANAGE_SERVER = !process.env.E2E_BASE_URL;

const chromium = devices["Desktop Chrome"];

/**
 * Playwright config for the public marketing site (apps/site).
 *
 * The site is fully unauthenticated, so there is no fixture/login/hermetic-DB
 * machinery (unlike apps/intranet). Specs run against a built preview build
 * served by `vite preview` on :4173 — or against E2E_BASE_URL when supplied.
 *
 * NOTE: this config is NOT wired into any GitHub workflow. The repo's e2e CI
 * jobs (quality.yml `e2e-and-a11y`) target apps/intranet
 * only. Adding this is additive and cannot affect those jobs. To wire it into
 * CI later, add a job that builds the workspace + runs `pnpm -F @finanzas/site
 * exec playwright test` (build is required because preview serves dist/).
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
      name: "desktop",
      use: { ...chromium, viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...chromium, viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true },
    },
  ],

  // Build then preview the production bundle so specs exercise the same
  // artifact prod serves. Skipped entirely when E2E_BASE_URL is set so an
  // external harness can own the server.
  ...(MANAGE_SERVER
    ? {
        webServer: {
          command: "pnpm build && pnpm preview --port 4173 --strictPort",
          url: PREVIEW_URL,
          reuseExistingServer: !isCI,
          // Generous: a cold `vite build` of the site (with workspace deps
          // already built) can take a while on CI.
          timeout: 180_000,
        },
      }
    : {}),
});
