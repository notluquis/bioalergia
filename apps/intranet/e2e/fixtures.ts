import { test as base, expect, type Page } from "@playwright/test";

const E2E_USER = process.env.E2E_USER;
const E2E_PASS = process.env.E2E_PASS;

interface Fixtures {
  authedPage: Page;
}

/**
 * Shared Playwright fixtures.
 *
 * - `authedPage` performs a real login through the public /login form using
 *   E2E_USER / E2E_PASS env vars (set both locally and in CI as repo secrets).
 *   When the credentials are missing the suite is skipped so unauthenticated
 *   coverage can still run.
 *
 * Add more fixtures here (e.g. seeded clinical record, mocked oRPC) as the
 * suite grows.
 */
export const test = base.extend<Fixtures>({
  authedPage: async ({ page }, use, testInfo) => {
    if (!E2E_USER || !E2E_PASS) {
      testInfo.skip(true, "E2E_USER / E2E_PASS not set");
    }
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(E2E_USER!);
    await page.getByLabel(/contrase[ñn]a|password/i).fill(E2E_PASS!);
    await page.getByRole("button", { name: /iniciar sesi[oó]n|ingresar|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    await use(page);
  },
});

export { expect };

/** Routes that any authenticated clinic operator can reach. Used by a11y + smoke. */
export const AUTHED_ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/patients", name: "patients-list" },
  { path: "/clinical", name: "clinical-series" },
  { path: "/finanzas/cash-flow", name: "finance-cashflow" },
  { path: "/calendar", name: "calendar-week" },
  { path: "/settings/mercadopago", name: "settings-mercadopago" },
  { path: "/wa-cloud", name: "wa-cloud-inbox" },
];
