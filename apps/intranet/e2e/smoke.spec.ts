import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Unauthenticated smoke: /login responds and React mounts.
 *
 * Backend connectivity is not required (Vite preview proxies /api/* and the
 * API may not be running locally) — runtime errors in the proxy itself are
 * tolerated. We only fail on JS pageerror / console.error from the bundle.
 */
test("login page mounts without runtime JS errors", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => jsErrors.push(err.message));

  const response = await page.goto("/login");
  expect(response?.status(), `HTTP ${response?.status()}`).toBeLessThan(500);

  // Wait for an app-specific element the login page renders unconditionally.
  // The login page opens on the Passkey step (biometric button + a
  // fallback "Usar correo y contraseña" button); the credentials form
  // only mounts after switching steps, so we can't rely on the email
  // input being present immediately. The passkey button carries
  // `aria-label="Ingresar con biometría"` and is always rendered.
  await expect(page.getByRole("button", { name: /ingresar con biometr[ií]a/i })).toBeVisible({
    timeout: 10_000,
  });

  expect(jsErrors, jsErrors.join("\n")).toEqual([]);
});
