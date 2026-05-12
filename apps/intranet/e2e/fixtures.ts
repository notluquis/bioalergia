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
 *
 * Defense layers (ranked):
 *   1. This network-layer denylist (defense in test).
 *   2. App-level: ZenStack `@@deny` policies tied to the E2E user role
 *      (TODO — needs schema migration, see CLAUDE.local.md).
 *   3. DB-level: separate Postgres role with GRANT SELECT only,
 *      consumed via DATABASE_URL_READONLY when running E2E.
 *      (TODO — needs Railway provisioning + dual connection pool.)
 */
const DANGEROUS_RPC_PATTERNS: RegExp[] = [
  /\/rpc\/(delete|destroy|remove|drop|truncate)\b/i,
  /\/rpc\/(cancel|abort|abandon)\b/i,
  /\/rpc\/(send|publish|broadcast|fire|trigger|dispatch)\b/i,
  /\/rpc\/(archive|deactivate|disable|suspend|block|ban)\b/i,
  /\/rpc\/(reset|recreate|reseed|wipe|purge)\b/i,
  /\/rpc\/(refund|chargeback|cashout|payout)\b/i,
  /\/rpc\/(import|export|sync)\b/i, // long-running mass mutations
  /\/rpc\/(create|insert|add|new)\b/i, // creation verbs — broad
  /\/rpc\/(update|patch|edit|modify|set|save|store)\b/i, // mutation verbs
  /\/rpc\/(approve|reject|confirm|finalize|complete|close|open|lock|unlock)\b/i, // state transitions
  /\/rpc\/(assign|unassign|attach|detach|link|unlink|connect|disconnect)\b/i, // relations
  /\/rpc\/(generate|render|compile|build|process|exec)\b/i, // side-effecting computations
  // Raw HTTP DELETE / PATCH / PUT also blocked unconditionally.
];

/**
 * Belt-and-suspenders: install a route handler that returns 403 for any
 * request whose URL matches a DANGEROUS_RPC_PATTERN, plus all DELETE
 * verbs. oRPC list/get/show queries (POST but read-only) flow through.
 */
const DESTRUCTIVE_METHODS = new Set(["DELETE", "PATCH", "PUT"]);

async function readOnlyGuard(page: Page) {
  await page.route(/.*\/api\/.+/, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const isDangerousPath = DANGEROUS_RPC_PATTERNS.some((re) => re.test(url.pathname));
    const isDestructiveMethod = DESTRUCTIVE_METHODS.has(req.method());
    if (!isDangerousPath && !isDestructiveMethod) return route.continue();
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
  authedPage: async ({ page }, use, testInfo) => {
    // The storageState (set by the `setup` project in playwright.config.ts)
    // already contains an authenticated cookie for E2E_USER. We just hand
    // the page over. If the cookie is missing (E2E_USER unset / setup
    // skipped), the project's testMatch never runs us so this is reachable
    // only with a valid session.
    if (!E2E_USER || !E2E_PASS) {
      testInfo.skip(true, "E2E_USER / E2E_PASS not set");
    }
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
