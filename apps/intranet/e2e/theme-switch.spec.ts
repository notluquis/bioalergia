import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Theme switching parity: flipping `data-theme` between bioalergia (light)
 * and bioalergia-dark must keep the page WCAG-clean. Catches the worst
 * theme-leak bug — text becoming invisible on a surface that didn't get a
 * matching foreground token.
 */
const THEMES = ["bioalergia", "bioalergia-dark"] as const;

for (const theme of THEMES) {
  test(`/login is color-contrast clean under ${theme}`, async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.classList.toggle("dark", t.endsWith("-dark"));
    }, theme);
    // Let the OKLCH cascade settle.
    await page.waitForTimeout(250);
    const results = await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag22aa"]).analyze();
    const contrast = results.violations.filter((v) => v.id === "color-contrast");
    expect(contrast, JSON.stringify(contrast, null, 2)).toEqual([]);
  });
}
