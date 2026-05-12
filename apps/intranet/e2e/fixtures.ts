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
  authedPage: async ({ page, baseURL }, use, testInfo) => {
    if (!E2E_USER || !E2E_PASS) {
      testInfo.skip(true, "E2E_USER / E2E_PASS not set");
    }
    // Fixture targets a real backend (login posts via oRPC). When the auth
    // API is unreachable (e.g. CI runs vite preview without spinning up
    // @finanzas/api), skip cleanly instead of timing out at waitForURL.
    const csrf = await page.request
      .get(`${baseURL ?? ""}/api/csrf`, { failOnStatusCode: false, timeout: 5_000 })
      .catch(() => undefined);
    if (!csrf || csrf.status() >= 500) {
      testInfo.skip(
        true,
        `API unavailable at ${baseURL}/api/csrf (status ${csrf?.status() ?? "no-response"})`
      );
    }
    await page.goto("/login");
    // The login surface starts on the passkey CTA. Wait until any login
    // control is interactable, then click the email/password fallback if
    // it's there (idempotent — a no-op when credentials are already shown).
    await page.waitForLoadState("networkidle");
    const fallback = page.getByRole("button", { name: /usar correo y contrase[ñn]a/i });
    if (await fallback.count()) {
      await fallback.click({ trial: false }).catch(() => undefined);
    }
    // HeroUI v3 wraps the <input> inside a div, so getByLabel resolves to
    // the wrapper. Target the real form controls by role / type.
    const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
    const passInput = page.locator('input[type="password"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 10_000 });
    await emailInput.fill(E2E_USER!);
    await passInput.fill(E2E_PASS!);
    await page
      .getByRole("button", { name: /^(iniciar sesi[oó]n|ingresar|continuar|log in)/i })
      .first()
      .click();
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
