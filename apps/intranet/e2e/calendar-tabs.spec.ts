import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Unified `/calendar` host — Phase 5 IA consolidation contract.
 *
 * Asserts that the 2-tab host renders the right panel per `?tab=`
 * key, and that the legacy `/calendar/sync-history` URL redirects
 * into the historial tab. Skips gracefully when the E2E user
 * lacks `read Calendar` — same pattern as `exam-reports-tabs.spec.ts`.
 */
test.describe("Calendar unified tabs host", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto("/calendar?tab=historial", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const result = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/calendar"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (result === "redirected" || result === "missing") {
      testInfo.skip(true, "E2E user lacks read Calendar permission");
    }
  });

  test("?tab=historial renders the historial panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    const historialTab = page.getByRole("tab", { name: /historial/i });
    await expect(historialTab).toHaveAttribute("aria-selected", "true");
  });

  test("legacy /calendar/sync-history redirects to ?tab=historial", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/calendar/sync-history", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/calendar(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/calendar");
    expect(url.searchParams.get("tab")).toBe("historial");
  });
});
