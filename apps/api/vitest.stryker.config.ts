import { defineConfig } from "vitest/config";

/**
 * Stryker-only Vitest config — exposes a SINGLE node-env unit project.
 *
 * The @stryker-mutator/vitest-runner has NO project selector and cannot run
 * Vitest browser-mode projects; it runs every project found in the config it
 * loads (https://stryker-mutator.io/docs/stryker-js/vitest-runner/). apps/api
 * has no browser project, but we still point Stryker at a dedicated
 * single-project config so the mutation run stays decoupled from the default
 * `vitest.config.ts` (and any future projects added there).
 *
 * Mirrors the `test` block of apps/api/vitest.config.ts:
 *   - environment: "node"  (apps/api has no DOM; DB is mocked per-test)
 *   - globals: true        (tests call describe/it/expect/vi without imports)
 *   - no setupFiles        (each *.test.ts installs its own vi.mock for
 *                           @finanzas/db + @finanzas/db/slices inline — the
 *                           $setOptions slices gotcha is handled per file)
 *
 * Keep this in sync with vitest.config.ts if that block changes.
 */
export default defineConfig({
  test: {
    name: "unit",
    globals: true,
    environment: "node",
    // Single project (no `projects:` / no `browser:`) → nothing for the
    // Stryker runner to try to launch in a browser.
    include: ["src/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      // Integration suites that hit real infra / are not pure-logic.
      "**/*.integration.test.ts",
    ],
  },
});
