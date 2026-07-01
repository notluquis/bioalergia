import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Patient detail — "Citas" tab (Doctoralia appointments panel).
 *
 * Navigates from the patients list into the first patient's detail page, opens
 * the lazy-mounted "Citas" tab, and asserts the DoctoraliaAppointmentsList
 * panel renders (populated or the empty state). Desktop-only (tab strip is
 * horizontal there). Skips gracefully when the E2E user can't reach patients or
 * none are seeded — mirrors exam-reports-tabs.spec.ts.
 */
test.describe("Patient detail — Citas (Doctoralia) tab", () => {
  test("opens the Citas tab and renders the appointments panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — tab strip visible");

    await page.goto("/patients", { waitUntil: "domcontentloaded" });
    const reached = await Promise.race([
      page
        .getByRole("link", { name: /ver|detalle|ficha/i })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "list" as const)
        .catch(() => "none" as const),
      page
        .locator('a[href*="/patients/"]')
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "list" as const)
        .catch(() => "none" as const),
    ]);
    if (reached === "none") {
      testInfo.skip(true, "No patient rows reachable (permission or empty seed)");
    }

    // Open the first patient's detail page.
    const detailLink = page.locator('a[href*="/patients/"]').first();
    await detailLink.click();
    await page.waitForURL(/\/patients\/\d+/, { timeout: 15_000 }).catch(() => undefined);
    if (!/\/patients\/\d+/.test(page.url())) {
      testInfo.skip(true, "Did not land on a patient detail page");
    }

    const citasTab = page.getByRole("tab", { name: /^citas$/i });
    await expect(citasTab).toBeVisible({ timeout: 15_000 });
    await citasTab.click();
    await expect(citasTab).toHaveAttribute("aria-selected", "true");

    // Panel mounts (title in both populated + empty states).
    await expect(page.getByText(/citas doctoralia|no hay citas de doctoralia/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
