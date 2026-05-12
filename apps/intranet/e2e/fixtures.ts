import { test as base, expect, type Page } from "@playwright/test";

const E2E_USER = process.env.E2E_USER;
const E2E_PASS = process.env.E2E_PASS;

interface Fixtures {
  authedPage: Page;
  /**
   * Auto-applied. Installs readOnlyGuard on every page before the test
   * runs so any spec using this fixtures module is mutation-safe by
   * default. No spec opts out.
   */
  autoReadOnlyGuard: void;
}

/**
 * Denylist of oRPC procedure names that the e2e test user must never
 * trigger. oRPC sends every operation (read AND write) as POST, so
 * blocking POST wholesale would make every page un-loadable; we instead
 * block specific destructive verbs by URL path. Anything matching one of
 * these patterns is fulfilled with 403 inside the browser before it can
 * reach the API — protects production data even if a future spec clicks
 * the wrong button.
 *
 * Add the route name (without /rpc/) when introducing a new mutation.
 */
const DANGEROUS_RPC_PATTERNS: RegExp[] = [
  /\/rpc\/(delete|destroy|remove|drop|truncate)\b/i,
  /\/rpc\/(cancel|abort|abandon)\b/i,
  /\/rpc\/(send|publish|broadcast|fire|trigger|dispatch)\b/i,
  /\/rpc\/(archive|deactivate|disable|suspend|block|ban)\b/i,
  /\/rpc\/(reset|recreate|reseed|wipe|purge)\b/i,
  /\/rpc\/(refund|chargeback|cashout|payout)\b/i,
  /\/rpc\/(import|export|sync)\b/i, // long-running mass mutations
  // Also block raw HTTP DELETE — only oRPC POST routes are excepted.
];

/**
 * Belt-and-suspenders: install a route handler that returns 403 for any
 * request whose URL matches a DANGEROUS_RPC_PATTERN, plus all DELETE
 * verbs. oRPC list/get/show queries (POST but read-only) flow through.
 */
async function readOnlyGuard(page: Page) {
  await page.route(/.*\/api\/.+/, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const isDangerousPath = DANGEROUS_RPC_PATTERNS.some((re) => re.test(url.pathname));
    const isRawDelete = req.method() === "DELETE";
    if (!isDangerousPath && !isRawDelete) return route.continue();
    console.warn(`[e2e] blocked ${req.method()} ${url.pathname} (read-only guard)`);
    return route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: "blocked-by-e2e-read-only-guard",
        method: req.method(),
        path: url.pathname,
      }),
    });
  });
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
  autoReadOnlyGuard: [
    async ({ page }, use) => {
      await readOnlyGuard(page);
      await use();
    },
    { auto: true },
  ],
  authedPage: async ({ page, baseURL }, use, testInfo) => {
    if (!E2E_USER || !E2E_PASS) {
      testInfo.skip(true, "E2E_USER / E2E_PASS not set");
    }
    // (readOnlyGuard already installed via auto fixture above; the fixture
    // itself does not need to call it again.)
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
    // Match both pre- and post-fix aria-labels (deployed Railway may lag the
    // accessibility commit that aligns aria-label to the visible text):
    //   pre  -> "Usar correo electrónico y contraseña"
    //   post -> "Usar correo y contraseña"
    const fallback = page.getByRole("button", {
      name: /usar correo( electr[oó]nico)? y contrase[ñn]a/i,
    });
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
