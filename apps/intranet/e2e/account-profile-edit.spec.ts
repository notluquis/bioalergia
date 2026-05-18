import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * `/account?tab=perfil` — self-service profile edit flow.
 *
 * Verifies that the user can:
 *  1. land on the profile tab,
 *  2. edit the names field,
 *  3. submit the form,
 *  4. see the success toast ("Perfil actualizado").
 *
 * Read-only safety: the autoReadOnlyGuard fixture blocks every PUT
 * verb hitting `/api/*`. We intercept the specific `PUT /api/orpc/.../profile`
 * call BEFORE the guard runs (route handlers run in registration order)
 * and fulfil it with a `{ status: "ok" }` payload so the page sees a
 * successful mutation without ever touching the production DB.
 */
test.describe("Account — profile edit", () => {
  test("user can edit their name and see the success toast", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only — form layout");

    // Intercept the self-service profile update BEFORE the read-only
    // guard blanket-blocks PUT verbs. Returns an oRPC-shaped success
    // envelope (matches `usersStatusResponseSchema`).
    await page.route(/\/api\/orpc\/users(?:\/rpc)?\/profile(?:\?.*)?$/, (route) => {
      const req = route.request();
      if (req.method() !== "PUT") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.goto("/account?tab=perfil", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const namesInput = page.getByLabel(/nombres/i);
    await namesInput.waitFor({ state: "visible", timeout: 15_000 });

    // Append a marker so we can detect the change even if the initial
    // value already matches a common test fixture.
    const marker = ` (e2e-${Date.now()})`;
    await namesInput.click();
    await page.keyboard.press("End");
    await page.keyboard.type(marker);

    const submit = page.getByRole("button", { name: /guardar cambios/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Success toast surfaces via the global toast-interceptor; it
    // renders as a region with role=status (HeroUI default).
    await expect(page.getByText(/perfil actualizado/i)).toBeVisible({ timeout: 10_000 });
  });
});
