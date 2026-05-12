import { expect, test } from "@playwright/test";

/**
 * Honors prefers-reduced-motion (Apple HIG / WCAG 2.3.3). After emulating
 * `reducedMotion: 'reduce'` on the browser context, no visible element
 * should ship a non-zero `transitionDuration` or `animationDuration`. The
 * global gate in `index.css`:
 *
 *   @media (prefers-reduced-motion: reduce) { *{transition-duration:.01ms} }
 *
 * collapses everything to ~instant; this test verifies it is actually being
 * applied (no library rule wins by specificity).
 */
test.describe("prefers-reduced-motion", () => {
  test("login page has no live transitions/animations", async ({ page }) => {
    // page.emulateMedia is the runtime knob; the context option of the same
    // name is unreliable on Playwright 1.60.x with Chromium.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const offenders = await page.evaluate(() => {
      const isLive = (v: string) => {
        const ms = Number.parseFloat(v);
        return Number.isFinite(ms) && ms > 1; // anything above 1 ms counts as "live"
      };
      const hits: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const cs = getComputedStyle(el);
        const tdMs = (cs.transitionDuration || "")
          .split(",")
          .map((v) => v.trim())
          .map((v) => (v.endsWith("ms") ? Number.parseFloat(v) : Number.parseFloat(v) * 1000));
        const adMs = (cs.animationDuration || "")
          .split(",")
          .map((v) => v.trim())
          .map((v) => (v.endsWith("ms") ? Number.parseFloat(v) : Number.parseFloat(v) * 1000));
        if (tdMs.some((d) => d > 1) || adMs.some((d) => d > 1)) {
          hits.push(
            `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)} t=${cs.transitionDuration} a=${cs.animationDuration}`
          );
        }
        if (hits.length > 5) break; // first 5 are enough to act on
      }
      void isLive; // keep helper around for future use without ts-unused
      return hits;
    });

    expect.soft(offenders, offenders.join("\n")).toEqual([]);
  });
});
