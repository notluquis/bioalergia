import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { DEFAULT_PRODUCT_SLUG, installShopMocks } from "./_shop-mocks";

/**
 * Basic axe-core a11y scan on key public routes.
 *
 * Standard: WCAG 2.2 AA plus best-practice rules (mirrors apps/intranet's
 * a11y.spec.ts tag set). This suite gates only on CRITICAL violations so it
 * stays a useful smoke signal without becoming a flaky full-conformance gate —
 * tighten to all impacts once the surface is clean.
 *
 * Run desktop-only to avoid double-scanning the same DOM per viewport project.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

// Static marketing routes — no backend needed.
const STATIC_ROUTES = [
  "/",
  "/servicios",
  "/examenes",
  "/inmunoterapia",
  "/botiquin",
  "/polen",
  "/aprende",
  "/equipo",
  "/eres-alergico",
  "/compromiso-social",
  "/noticias",
] as const;

// Ecommerce routes — require the oRPC mocks installed before navigation so the
// product/cart/checkout surfaces actually render (instead of error/empty states).
const SHOP_ROUTES = [
  "/tienda",
  `/producto/${DEFAULT_PRODUCT_SLUG}`,
  "/carrito",
  "/checkout",
] as const;

/**
 * Per-route allowlist of KNOWN, pre-existing critical violations (by axe rule
 * id). Each entry is a documented source bug that lives outside this e2e dir and
 * so cannot be fixed here — the allowlist keeps the gate green for everything
 * ELSE while still failing on any NEW critical regression. Drop entries as the
 * underlying source is fixed.
 */
const KNOWN_CRITICAL: Readonly<Record<string, ReadonlyArray<string>>> = {
  // Currently empty — every public route is critical-clean. Add an entry only
  // for a documented source bug that genuinely can't be fixed yet; it keeps the
  // gate green for everything ELSE while still failing on NEW regressions.
};

async function scanForCriticalViolations(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // Let the SPA shell + lazy sections settle before scanning so axe sees the
  // mounted landmarks/headings (avoids racing React).
  //
  // /checkout renders WITHOUT an <h1> when VITE_MERCADOPAGO_PUBLIC_KEY is unset
  // (it shows a config alert instead) — so for that route we settle on the main
  // landmark rather than the heading.
  if (route === "/checkout") {
    await expect(page.getByRole("main")).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const allowed = KNOWN_CRITICAL[route] ?? [];
  const critical = results.violations
    .filter((v) => v.impact === "critical")
    .filter((v) => !allowed.includes(v.id));
  const summary = critical
    .map((v) => `${v.id} (${v.nodes.length} node(s)): ${v.help}`)
    .join("\n");
  expect(critical, `Unexpected critical a11y violations on ${route}:\n${summary}`).toEqual([]);
}

test.describe("a11y (public site)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "desktop-only scan");

  for (const route of STATIC_ROUTES) {
    test(`${route} has no critical axe violations`, async ({ page }) => {
      await scanForCriticalViolations(page, route);
    });
  }

  for (const route of SHOP_ROUTES) {
    test(`${route} (with shop mocks) has no critical axe violations`, async ({ page }) => {
      await installShopMocks(page);
      await scanForCriticalViolations(page, route);
    });
  }
});
