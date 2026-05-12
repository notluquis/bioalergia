import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * WhatsApp Cloud inbox — responsive master-detail contract.
 *
 * Runs in three viewport projects (mobile / tablet / desktop). Each
 * project asserts the layout it should be in:
 *   <lg : list-only (detail empty-state hidden, becomes a drawer on row tap)
 *   >=lg: split — list + detail empty-state visible side-by-side
 *
 * The point isn't pixel-fidelity (Chromatic does that). It's enforcing the
 * structural contract so a refactor of WaCloudInboxPage that breaks the
 * mobile-first stack lights up CI immediately.
 */
test.describe("WaCloud Inbox responsive contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wa-cloud", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    // List header is the cheapest readiness signal — it renders before the
    // conversations query resolves, so we don't need data fixtures.
    await expect(page.getByRole("heading", { name: /^bandeja$/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("desktop: split layout shows both list and detail empty-state", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await expect(page.getByRole("heading", { name: /^bandeja$/i })).toBeVisible();
    // Empty-state lives only inside the detail pane on desktop.
    await expect(page.getByText(/selecciona una conversaci[oó]n/i)).toBeVisible();
    // Back-to-inbox affordance must NOT exist on desktop (no master-detail
    // navigation needed when both panes coexist).
    await expect(page.getByRole("button", { name: /volver a la bandeja/i })).toHaveCount(0);
  });

  test("mobile: list-only by default (no detail empty-state)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await expect(page.getByRole("heading", { name: /^bandeja$/i })).toBeVisible();
    // Detail empty-state would only appear if both panes coexisted; on
    // mobile the detail pane is unmounted until a row is tapped.
    await expect(page.getByText(/selecciona una conversaci[oó]n/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /volver a la bandeja/i })).toHaveCount(0);
  });

  test("tablet: still list-only (split kicks in at lg = 1024px)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet", "tablet project only");
    await expect(page.getByRole("heading", { name: /^bandeja$/i })).toBeVisible();
    await expect(page.getByText(/selecciona una conversaci[oó]n/i)).toHaveCount(0);
  });

  test("no horizontal scroll", async ({ page }) => {
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`
    ).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("uses dynamic viewport height (100dvh) — no leftover 100vh", async ({ page }) => {
    // Catches regressions to `h-[calc(100vh-7rem)]`. iOS Safari URL-bar
    // shrink would clip content otherwise. Search the rendered HTML for
    // any inline style or class containing the static "100vh" token.
    const usesStaticVh = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      // Tailwind generates classes like `h-[calc(100vh-…)]`, which hash into
      // the `class=` attribute and into the generated stylesheet. Scan both.
      const hasInClass = /\b\w+\[calc\(100vh/.test(html);
      const styles = Array.from(document.styleSheets)
        .flatMap((s) => {
          try {
            return Array.from(s.cssRules).map((r) => r.cssText);
          } catch {
            return [] as string[];
          }
        })
        .join("\n");
      const hasInCss = /calc\(100vh/.test(styles);
      return hasInClass || hasInCss;
    });
    expect(usesStaticVh, "found `100vh` (use `100dvh` for iOS Safari)").toBe(false);
  });
});
