import { expect, test } from "@playwright/test";

/**
 * Keyboard-only navigation: every Tab stop must surface an interactive
 * element with a visible focus ring (outline or boxShadow non-empty).
 * Catches CSS resets that strip `:focus-visible` styling and components
 * that swallow focus into wrappers without forwarding it to the real
 * pressable.
 */
test("login page first 8 Tab stops have visible focus", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("body").click(); // ensure starting from body

  const offenders: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const visible =
        cs.outlineStyle !== "none" ||
        (cs.boxShadow !== "none" && cs.boxShadow !== "") ||
        cs.outlineWidth !== "0px";
      return {
        tag: el.tagName.toLowerCase(),
        name: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40),
        visible,
      };
    });
    if (result && !result.visible) {
      offenders.push(`#${i + 1} ${result.tag} "${result.name}" — no focus ring`);
    }
  }
  expect(offenders, offenders.join("\n")).toEqual([]);
});
