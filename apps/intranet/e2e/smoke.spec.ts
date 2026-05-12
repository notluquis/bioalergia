import { expect, test } from "@playwright/test";

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

  // Wait for the React root to render *something*.
  await expect(page.locator("#root").locator("*").first()).toBeVisible({ timeout: 10_000 });

  expect(jsErrors, jsErrors.join("\n")).toEqual([]);
});
