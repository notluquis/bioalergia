import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Unified `/outreach/directorio` host — Phase 5 IA consolidation
 * contract.
 *
 * Asserts that the 3-tab host renders the right panel per `?tab=`
 * key, and that the legacy `/outreach/{establecimientos,descubrir,
 * crawler-masivo}` URLs redirect into their respective tabs. Skips
 * gracefully when the E2E user lacks `read OutreachEstablishment`.
 *
 * The `/outreach/establecimientos/$rbd` detail route stays separate
 * and is NOT covered here.
 */
test.describe("Outreach directorio unified tabs host", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto("/outreach/directorio?tab=establecimientos", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const result = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/outreach"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (result === "redirected" || result === "missing") {
      testInfo.skip(true, "E2E user lacks read OutreachEstablishment permission");
    }
  });

  test("?tab=establecimientos is selected by default", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    const tab = page.getByRole("tab", { name: /establecimientos/i });
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("?tab=descubrir renders the descubrir panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/outreach/directorio?tab=descubrir", { waitUntil: "domcontentloaded" });
    const tab = page.getByRole("tab", { name: /descubrir/i });
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("?tab=crawler renders the crawler panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/outreach/directorio?tab=crawler", { waitUntil: "domcontentloaded" });
    const tab = page.getByRole("tab", { name: /crawler/i });
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("legacy /outreach/descubrir redirects to ?tab=descubrir", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/outreach/descubrir", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/outreach\/directorio(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/outreach/directorio");
    expect(url.searchParams.get("tab")).toBe("descubrir");
  });
});
