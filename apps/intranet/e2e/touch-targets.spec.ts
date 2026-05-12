import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Runtime touch-target audit at the iPhone 15 viewport (393×852, dpr 3,
 * touch-mode). Measures the bounding box of every interactive element and
 * fails if it renders below the WCAG 2.2 SC 2.5.8 minimum (24 CSS px) or
 * the Apple HIG / IEC 62366-1 medical-glove floor (44×44).
 *
 * Catches the regressions static CSS (`.button--icon-only` 44pt rule)
 * misses: dynamically-sized chips, custom <button>s without HeroUI
 * classes, and anchor/link tap targets in dense tables.
 *
 * Uses bare viewport emulation (no device descriptor) so we stay on
 * Chromium and don't pull in WebKit just for touch coverage.
 */
test.describe("touch targets / iPhone viewport", () => {
  test.use({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
  });

  test("login page interactive elements >= 44px", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const targets = page.locator(
      'button, a[href], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], input:not([type="hidden"])'
    );
    const small = await targets.evaluateAll((els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          // Skip elements outside the visible viewport (off-screen menus,
          // closed dropdowns, sr-only) — they will be sized by their parent
          // when activated.
          if (r.width === 0 || r.height === 0) return false;
          return r.width < 44 || r.height < 44;
        })
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          name:
            e.getAttribute("aria-label") ??
            e.getAttribute("title") ??
            (e.textContent ?? "").trim().slice(0, 40),
          size: `${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`,
        }))
    );

    expect.soft(small, JSON.stringify(small, null, 2)).toEqual([]);
  });
});
