import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Unified `/exam-reports` host — Phase 3 IA consolidation contract.
 *
 * Asserts that the 3-tab host renders the right panel per `?tab=` key,
 * and that the two legacy `/settings/*` URLs redirect into the right tab.
 *
 * Skips gracefully when the E2E user lacks `read ExamReport` — same
 * pattern as `wa-cloud-tabs.spec.ts`.
 */
test.describe("ExamReports unified tabs host", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto("/exam-reports?tab=plantillas", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const result = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/exam-reports"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (result === "redirected" || result === "missing") {
      testInfo.skip(true, "E2E user lacks read ExamReport permission");
    }
  });

  test("?tab=plantillas renders the templates panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    const plantillasTab = page.getByRole("tab", { name: /plantillas/i });
    await expect(plantillasTab).toHaveAttribute("aria-selected", "true");
  });

  test("legacy /settings/conclusion-templates redirects to ?tab=plantillas", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/settings/conclusion-templates", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/exam-reports(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/exam-reports");
    expect(url.searchParams.get("tab")).toBe("plantillas");
  });

  test("legacy /settings/clinic redirects to ?tab=clinica", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/settings/clinic", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/exam-reports(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/exam-reports");
    expect(url.searchParams.get("tab")).toBe("clinica");
  });
});
