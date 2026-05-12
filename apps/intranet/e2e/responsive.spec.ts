import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Responsive layout matrix. Checks that critical surfaces don't trigger a
 * horizontal viewport scroll at the three Tailwind v4 breakpoint anchors:
 *   375 px  (iPhone SE / mobile baseline)
 *   768 px  (Tailwind `md:`)
 *   1280 px (Tailwind `xl:`)
 *
 * Horizontal scroll on mobile is one of the cheapest UX failures to detect
 * automatically — almost always caused by a missing `min-w-0` inside a flex
 * row or by a fixed-width child (`w-[800px]`) shipped without a wrapper
 * `overflow-x-auto`.
 */
const BREAKPOINTS = [
  { width: 375, label: "mobile" },
  { width: 768, label: "tablet" },
  { width: 1280, label: "desktop" },
] as const;

const ROUTES = ["/login"] as const;

for (const route of ROUTES) {
  for (const bp of BREAKPOINTS) {
    test(`${route} has no horizontal scroll @ ${bp.width}px (${bp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: 800 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect
        .soft(
          overflow.scrollWidth,
          `${route} @ ${bp.width}: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`
        )
        .toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
}
