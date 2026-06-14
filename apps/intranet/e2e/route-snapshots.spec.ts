/**
 * route-snapshots.spec.ts — Visual regression baseline for the most-used
 * authed routes, captured per viewport project (mobile/tablet/desktop).
 *
 * Pattern: Playwright 1.60 `toHaveScreenshot()` — one assertion per
 * (route × project), with `fullPage: true`, animations disabled, and a
 * mask list covering volatile regions (clocks, locale-formatted dates,
 * generated IDs, charts, avatars). `maxDiffPixelRatio: 0.01` absorbs
 * sub-pixel font/AA noise.
 *
 * IMPORTANT — baselines are generated against the HERMETIC stack: a
 * production SPA bundle served by `vite preview` (:4173) proxying /api to
 * a local api (:4000) that runs against an EPHEMERAL, synthetically-seeded
 * Postgres. This is PHI-free and DETERMINISTIC: the synthetic seed pins
 * `faker.seed(20260601)` (packages/db/scripts/seed-synthetic.ts), so the
 * same rows render every run and screenshots are reproducible. (Prod was
 * abandoned as a baseline source — it leaks PHI into committed PNGs and
 * its data drifts, making diffs flap.)
 *
 * Baselines MUST be generated on Linux/CI (font/AA rendering differs from
 * macOS — a macOS-generated PNG never matches the Linux CI diff). Do NOT
 * commit macOS-rendered baselines. Trigger the dedicated workflow:
 *
 *   gh workflow run e2e-hermetic.yml \
 *     --ref <branch> -f update_snapshots=true
 *
 * That job spins up the ephemeral Postgres, seeds it, sets
 * RUN_SNAPSHOTS=true, runs `playwright test route-snapshots
 * --update-snapshots`, and commits the PNGs back to the branch.
 *
 * Snapshots commit alongside the spec under
 * `apps/intranet/e2e/route-snapshots.spec.ts-snapshots/`. Regular CI
 * (quality.yml e2e-and-a11y) leaves RUN_SNAPSHOTS unset so route-snapshots
 * is IGNORED there (non-blocking until Linux baselines prove stable).
 *
 * Routes covered: 9. `/wa-cloud` is intentionally skipped — already
 * exercised by `wa-cloud-inbox.spec.ts` with bespoke wait/mask logic.
 * `/users` (top-level) does not exist; the user-management surface lives
 * under `/settings/users`, which is what we capture instead.
 */

import { expect } from "@playwright/test";
import { test } from "./fixtures";

interface RouteSpec {
  path: string;
  name: string;
  /** Override the default 30s timeout for data-heavy routes. */
  timeout?: number;
  /**
   * Route-specific readiness signal. When set, the test waits for this
   * locator instead of `networkidle` — required for pages that keep a
   * long-lived WebSocket / subscription open (e.g. /clinical).
   */
  readyLocator?: string;
}

const ROUTES: RouteSpec[] = [
  { path: "/", name: "home" },
  { path: "/patients", name: "patients-list" },
  { path: "/calendar", name: "calendar-week" },
  // /wa-cloud — covered by wa-cloud-inbox.spec.ts, skipped here.
  { path: "/finanzas/cash-flow", name: "finanzas-cash-flow" },
  { path: "/operations/shipments", name: "operations-shipments" },
  // /clinical keeps a long-lived WebSocket subscription open, so
  // `networkidle` never resolves. Use a route-specific readiness
  // signal (the Tabs landmark rendered by ClinicalSeriesView) instead.
  {
    path: "/clinical",
    name: "clinical-index",
    readyLocator: "[aria-label='Vistas de series clínicas']",
  },
  { path: "/settings/mercadopago", name: "settings-mercadopago" },
  { path: "/operations/inventory", name: "operations-inventory" },
  // No top-level /users route — admin surface lives at /settings/users.
  { path: "/settings/users", name: "settings-users" },
];

for (const route of ROUTES) {
  test(`route snapshot: ${route.name}`, async ({ page }) => {
    if (route.timeout) test.setTimeout(route.timeout);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Wait for the app shell to populate the main landmark. Matches the
    // pattern used by a11y.spec.ts so we share the same readiness signal.
    await page
      .locator("#main-content > *, main > *, [role='main'] > *")
      .first()
      .waitFor({ state: "visible" });

    if (route.readyLocator) {
      // Route-specific readiness: page holds a WS open, so skip
      // networkidle and wait for a known landmark instead.
      await page.locator(route.readyLocator).first().waitFor({
        state: "visible",
        timeout: 15_000,
      });
    } else {
      // Brief settle so async data + skeleton transitions resolve before
      // we snapshot. Animations are disabled by toHaveScreenshot below.
      await page.waitForLoadState("networkidle").catch(() => {
        /* some routes keep WS open; ignore */
      });
    }

    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      animations: "disabled",
      // Mask volatile regions so re-runs are stable. Be generous —
      // false negatives are cheaper than flake.
      mask: [
        page.locator("[data-testid='clock']"),
        page.locator("time"),
        page.locator("[data-volatile]"),
        // Locale-formatted dates rendered inline by HeroUI tables/cards.
        page.locator("[data-slot='date'], [data-slot='datetime']"),
        // Charts (Recharts/ECharts) re-layout sub-pixel between runs.
        page.locator("svg.recharts-surface, .echarts-for-react, canvas"),
        // Avatars/initials — generated server-side, stable per user but
        // change if seed data shifts.
        page.locator("[data-slot='avatar']"),
      ],
      maxDiffPixelRatio: 0.01,
    });
  });
}
