import { expect } from "@playwright/test";
import { test } from "./fixtures";

// The /reset-password page is the landing target for BOTH the forgot-password
// link and the admin invite ("Definir mi contraseña") link. Public route — no
// auth needed. We cover the invalid-link UI, client-side validation, and the
// happy set-password path (mutation route-mocked, since the read-only guard
// 403s /rpc/resetPassword by design).

test.describe("reset-password page", () => {
  test("no token → shows invalid-link message + link to request a new one", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/no es válido o está incompleto/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /solicitar uno nuevo/i })).toBeVisible();
  });

  test("with token → enforces min length, match, and enables submit when valid", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=demo-token");

    const password = page.getByPlaceholder("Mínimo 8 caracteres");
    const confirm = page.getByPlaceholder("Repite la contraseña");
    const submit = page.getByRole("button", { name: /cambiar contraseña/i });

    await password.fill("short");
    await expect(page.getByText(/mínimo 8 caracteres\./i)).toBeVisible();
    await expect(submit).toBeDisabled();

    await password.fill("Strong!Passw0rd");
    await confirm.fill("Different1");
    await expect(page.getByText(/no coinciden/i)).toBeVisible();
    await expect(submit).toBeDisabled();

    await confirm.fill("Strong!Passw0rd");
    await expect(submit).toBeEnabled();
  });

  test("valid submit completes and returns the user to /login", async ({ page }) => {
    // Route-mock the mutation (guard 403s /rpc/resetPassword). Registered before
    // navigation so it wins over the read-only guard.
    await page.route(/\/api\/orpc\/auth(?:\/rpc)?\/reset.?[Pp]assword/i, (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ json: { status: "ok" }, meta: [] }),
      });
    });

    await page.goto("/reset-password?token=demo-token");
    await page.getByPlaceholder("Mínimo 8 caracteres").fill("Strong!Passw0rd");
    await page.getByPlaceholder("Repite la contraseña").fill("Strong!Passw0rd");
    await page.getByRole("button", { name: /cambiar contraseña/i }).click();

    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 10_000 });
  });
});
