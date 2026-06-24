import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Windows High Contrast Mode (CSS `forced-colors: active`) replaces author
 * colors with the user's system palette. Common breakage:
 *   - background-image gradients / pseudo-element borders disappear
 *   - icon-only buttons lose visible affordance (no border, system bg)
 *   - focus outlines collapse to system-default and overlap content
 *
 * This emulates forced colors and re-runs axe + checks the brand button
 * still has a visible chrome (border or backdrop) so it doesn't read as
 * inert text in the system palette.
 */
test("forced-colors mode keeps login axe-clean + buttons visible", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const results = await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag22aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  // Brand button should still expose a visible affordance (border, outline,
  // or non-system background) when forced colors strips the OKLCH tokens.
  const cta = page.getByRole("button", { name: /biometr[ií]a|usar correo/i }).first();
  const visible = await cta.evaluate((el) => {
    const cs = getComputedStyle(el);
    return (
      cs.borderStyle !== "none" ||
      cs.outlineStyle !== "none" ||
      cs.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      cs.backgroundImage !== "none"
    );
  });
  expect(visible).toBe(true);
});
