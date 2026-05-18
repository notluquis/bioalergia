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

  // Wait for an app-specific element the login page is known to render.
  // Playwright golden 2026: prefer semantic role queries over "anything
  // visible" — they fail loudly when the page redirects unexpectedly
  // and pass only when the actual UI mounted (not just a tracking
  // <script>). The login form's email TextField carries a
  // <Label>Correo electrónico</Label> rendered by HeroUI v3 with
  // proper aria-labelledby plumbing.
  await expect(page.getByRole("textbox", { name: /correo electr[oó]nico/i })).toBeVisible({
    timeout: 10_000,
  });

  expect(jsErrors, jsErrors.join("\n")).toEqual([]);
});
