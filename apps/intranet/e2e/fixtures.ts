import { test as base, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

import { performLogin } from "./login";

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

interface WorkerFixtures {
  /**
   * Path to a per-worker `storageState` JSON, or `undefined` when the
   * worker should run unauthenticated.
   *
   * Golden-2026 Playwright pattern ("one account per parallel worker"):
   * instead of a single `setup` project persisting ONE shared session
   * for every authed project, each worker logs in once and keeps its own
   * session. The previous shared-session design raced production's
   * session rotation under parallel load — workers silently lost their
   * cookie, got bounced to /login, and scan-only authed specs (axe,
   * layout-integrity) passed vacuously against the login page.
   *
   * `undefined` is returned for `*-unauthed` projects, when E2E creds are
   * absent, or when the API probe fails (preview-only / fork PR). In
   * those cases `authedPage` skips the authed specs cleanly.
   */
  workerStorageState: string | undefined;
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
 * - `workerStorageState` (worker-scoped) logs in once per parallel worker
 *   and caches the session to `{outputDir}/.auth/{parallelIndex}.json`.
 *   `storageState` is overridden to consume it, so authed projects no
 *   longer need a `setup` dependency or a static `storageState` path.
 * - `authedPage` hands over the already-authenticated `page`. When the
 *   worker has no session (no creds / API down / unauthed project) the
 *   authed spec is skipped so unauthenticated coverage still runs.
 *
 * Add more fixtures here (e.g. seeded clinical record, mocked oRPC) as the
 * suite grows.
 */
export const test = base.extend<Fixtures, WorkerFixtures>({
  workerStorageState: [
    async ({ browser }, use) => {
      const projectName = test.info().project.name;
      // Unauthed projects must never authenticate — they exercise the
      // public surface. Missing creds → same: run unauthenticated.
      if (projectName.endsWith("-unauthed") || !E2E_USER || !E2E_PASS) {
        await use(undefined);
        return;
      }

      // One cached session file per parallel worker. parallelIndex is the
      // stable per-worker id; reusing the file across a worker's tests
      // means exactly one login per worker per run.
      const id = test.info().parallelIndex;
      const file = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);
      if (fs.existsSync(file)) {
        await use(file);
        return;
      }

      const page = await browser.newPage({ storageState: undefined });
      try {
        const ok = await performLogin(page);
        if (!ok) {
          // API unreachable — fall back to unauthenticated; authedPage skips.
          await use(undefined);
          return;
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await page.context().storageState({ path: file });
        await use(file);
      } finally {
        await page.close();
      }
    },
    { scope: "worker" },
  ],

  // Override the built-in `storageState` option with the per-worker value.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  autoReadOnlyGuard: [
    async ({ page }, use) => {
      await readOnlyGuard(page);
      await use();
    },
    { auto: true },
  ],

  authedPage: async ({ page, workerStorageState }, use, testInfo) => {
    // `page` already carries the worker's authenticated cookie (via the
    // overridden `storageState`). If the worker has no session — missing
    // creds, API down, or an unauthed project — skip: the authed assertion
    // would otherwise run against the public /login page and pass
    // vacuously.
    if (!workerStorageState) {
      testInfo.skip(true, "no authenticated worker session (creds missing / API unreachable)");
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
