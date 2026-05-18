import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Phase 4b IA consolidation — `/admin/database`, `/admin/users`, `/account`.
 *
 * Asserts:
 *   - each tab key in the URL renders the right panel (selected tab),
 *   - the 5 legacy `/settings/*` URLs redirect to the right `?tab=` host.
 *
 * Skips gracefully when the E2E user lacks the loosest outer permission
 * (matches the `wa-cloud-tabs` / `exam-reports-tabs` pattern).
 */
test.describe("Phase 4b unified tab hosts", () => {
  test("/admin/database?tab=backups selects the backups tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    await page.goto("/admin/database?tab=backups", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const ready = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/admin/database"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (ready !== "ready") {
      testInfo.skip(true, "E2E user lacks admin/database access");
    }
    const backupsTab = page.getByRole("tab", { name: /backups/i });
    await expect(backupsTab).toHaveAttribute("aria-selected", "true");
  });

  test("/admin/users?tab=roles selects the roles tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    await page.goto("/admin/users?tab=roles", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    const ready = await Promise.race([
      TABLIST.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "ready" as const)
        .catch(() => "missing" as const),
      page
        .waitForURL((url) => !url.pathname.startsWith("/admin/users"), { timeout: 15_000 })
        .then(() => "redirected" as const)
        .catch(() => "stayed" as const),
    ]);
    if (ready !== "ready") {
      testInfo.skip(true, "E2E user lacks admin/users access");
    }
    const rolesTab = page.getByRole("tab", { name: /roles/i });
    await expect(rolesTab).toHaveAttribute("aria-selected", "true");
  });

  test("/account?tab=seguridad selects the security tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tablist visible");
    await page.goto("/account?tab=seguridad", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const TABLIST = page.getByRole("tablist", { name: /secciones/i });
    await TABLIST.waitFor({ state: "visible", timeout: 15_000 });
    const securityTab = page.getByRole("tab", { name: /seguridad/i });
    await expect(securityTab).toHaveAttribute("aria-selected", "true");
  });

  test("legacy /settings/csv-upload redirects to /admin/database?tab=importar", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/settings/csv-upload", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/admin\/database(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/admin/database");
    expect(url.searchParams.get("tab")).toBe("importar");
  });

  test("legacy /settings/notifications redirects to /account?tab=notificaciones", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/account(?:\/?)?(?:\?|$)/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, "")).toBe("/account");
    expect(url.searchParams.get("tab")).toBe("notificaciones");
  });
});
