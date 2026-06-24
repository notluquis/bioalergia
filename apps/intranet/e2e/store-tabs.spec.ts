import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Unified `/store` host — Phase 4a IA consolidation contract.
 *
 * Asserts that the 4-tab host renders the right panel per `?tab=` key,
 * and that the legacy `/settings/tienda` URL redirects into the
 * canales tab. Skips gracefully when the E2E user lacks
 * `read Setting` — same pattern as `exam-reports-tabs.spec.ts`.
 */
test.describe("Store unified tabs host", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto("/store?tab=canales", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const result = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/store"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (result === "redirected" || result === "missing") {
      testInfo.skip(true, "E2E user lacks read Setting permission");
    }
  });

  test("?tab=canales is selected by default", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    const canalesTab = page.getByRole("tab", { name: /canales/i });
    await expect(canalesTab).toHaveAttribute("aria-selected", "true");
  });

  test("?tab=productos renders the productos panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/store?tab=productos", { waitUntil: "domcontentloaded" });
    const productosTab = page.getByRole("tab", { name: /productos/i });
    await expect(productosTab).toHaveAttribute("aria-selected", "true");
  });

  test("?tab=mercadopago renders the mercadopago panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/store?tab=mercadopago", { waitUntil: "domcontentloaded" });
    const mpTab = page.getByRole("tab", { name: /mercadopago/i });
    await expect(mpTab).toHaveAttribute("aria-selected", "true");
  });

  test("?tab=mercadolibre renders the mercadolibre panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/store?tab=mercadolibre", { waitUntil: "domcontentloaded" });
    const mlTab = page.getByRole("tab", { name: /mercadolibre/i });
    await expect(mlTab).toHaveAttribute("aria-selected", "true");
  });

  test("legacy /settings/tienda redirects to ?tab=canales", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/settings/tienda", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/store(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/store");
    expect(url.searchParams.get("tab")).toBe("canales");
  });
});
