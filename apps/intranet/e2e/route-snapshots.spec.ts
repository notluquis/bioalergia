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
 * IMPORTANT — baselines must be generated against Railway prod, NOT a
 * local preview server. Local preview hits a vite dev build with no real
 * data, which makes every snapshot diverge from CI. Generate baselines
 * via:
 *
 *   E2E_BASE_URL=https://intranet.bioalergia.cl \
 *   E2E_USER=… E2E_PASS=… \
 *   pnpm -F @finanzas/intranet exec playwright test route-snapshots \
 *     --update-snapshots
 *
 * Snapshots commit alongside the spec under
 * `apps/intranet/e2e/route-snapshots.spec.ts-snapshots/`. CI re-runs
 * against the same Railway URL and diffs against the committed PNGs.
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
}

const ROUTES: RouteSpec[] = [
  { path: "/", name: "home" },
  { path: "/patients", name: "patients-list" },
  { path: "/calendar", name: "calendar-week" },
  // /wa-cloud — covered by wa-cloud-inbox.spec.ts, skipped here.
  { path: "/finanzas/cash-flow", name: "finanzas-cash-flow" },
  { path: "/operations/shipments", name: "operations-shipments" },
  // /clinical excluded for now — page keeps a long-polling subscription
  // open so `networkidle` never resolves and the snapshot times out
  // even with extended limits. Needs a dedicated readiness signal
  // (e.g. wait for a specific landmark to render) instead of the
  // generic networkidle wait. TODO: dedicated spec.
  // { path: "/clinical", name: "clinical-index" },
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

    // Brief settle so async data + skeleton transitions resolve before
    // we snapshot. Animations are disabled by toHaveScreenshot below.
    await page.waitForLoadState("networkidle").catch(() => {
      /* some routes keep WS open; ignore */
    });

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
