import { expect } from "@playwright/test";
import { test } from "./fixtures";

// The /forgot-password page (public) is the recovery path for staff who lost
// their invite/temp password. It's anti-enumeration: it always shows the same
// generic "sent" message. Mutation route-mocked so the spec never hits the API.

test.describe("forgot-password page", () => {
  test("submitting an email shows the generic anti-enumeration confirmation", async ({ page }) => {
    await page.route(/\/api\/orpc\/auth(?:\/rpc)?\/forgot.?[Pp]assword/i, (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ json: { status: "ok" }, meta: [] }),
      });
    });

    await page.goto("/forgot-password");

    const email = page.getByPlaceholder("tucorreo@bioalergia.cl");
    await expect(email).toBeVisible();
    await email.fill("staff@bioalergia.cl");

    await page.getByRole("button", { name: /enviar enlace/i }).click();

    // Generic confirmation — never reveals whether the account exists.
    await expect(page.getByText(/si el correo está registrado/i)).toBeVisible({ timeout: 10_000 });
  });
});
