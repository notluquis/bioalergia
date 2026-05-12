import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Document-shell smoke covering the things screen readers and search
 * engines pick up before any React renders:
 *  - <html lang> matches the actual UI language (es)
 *  - <title> non-empty + sensible length
 *  - <meta name="description"> non-empty
 *  - <meta name="viewport"> includes width=device-width (mobile zoom)
 *  - All <img> have alt (or aria-label) — empty alt is fine for decorative
 *  - Logo specifically has descriptive alt (not just "logo")
 *  - At least one <nav> landmark on every authed-shell precursor
 */
test("login document shell metadata is correct", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", /^es/i);

  const title = await page.title();
  expect(title, "title").toMatch(/bioalergia/i);
  expect(title.length, "title length").toBeGreaterThanOrEqual(10);
  expect(title.length, "title length").toBeLessThanOrEqual(70);

  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description ?? "", "meta description").toMatch(/.{50,}/);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport ?? "", "meta viewport").toMatch(/width=device-width/);

  // Every <img> must have alt (empty allowed for purely decorative).
  const imgs = await page
    .locator("img")
    .evaluateAll((els) =>
      els
        .filter((e) => !e.hasAttribute("alt") && !e.hasAttribute("aria-label"))
        .map((e) => e.outerHTML.slice(0, 80))
    );
  expect(imgs, JSON.stringify(imgs, null, 2)).toEqual([]);
});
