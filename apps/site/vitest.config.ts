import path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Vitest 4 multi-project config (mirrors apps/intranet/vitest.config.ts).
 *
 *   - `unit`     → loaded from vite.config.ts (jsdom)
 *   - `storybook`→ runs every *.stories.tsx in headless Chromium via
 *                  @storybook/addon-vitest. Replaces @storybook/test-runner,
 *                  deprecated for Vite stacks since SB 10.3
 *                  (https://storybook.js.org/docs/writing-tests/integrations/vitest-addon).
 *
 * `vitest.workspace.ts` was the old API; deprecated in Vitest 3.2 in favour
 * of `test.projects` (https://vitest.dev/guide/projects). Cannot use
 * `mergeConfig` with vite.config.ts because it exports a callback form.
 */
export default defineConfig({
  test: {
    // Coverage is a ROOT-level option in the Vitest 4 projects API (a project's
    // own `test.coverage` is ignored), so the gate config lives here, not in
    // vite.config.ts. Collected from the `unit` project run (test:coverage =
    // `vitest --project=unit --coverage --run`).
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // GATING is scoped to the PURE-LOGIC surface of the site — code that can
      // regress silently and is unit-testable without a DOM. The UI layer
      // (routes, HeroUI views, shop pages) is covered by Chromatic + Playwright
      // e2e + axe a11y instead, so it is intentionally NOT in this denominator.
      // Add a module here — with its tests — when new pure logic lands.
      include: [
        "src/lib/nav-active.ts",
        "src/lib/seo.ts",
        "src/features/shop/lib/shop-config.ts",
        "src/features/shop/lib/catalog.ts",
        "src/features/shop/lib/cart-math.ts",
        "src/features/shop/lib/checkout-math.ts",
        "src/features/shop/lib/product-detail.ts",
      ],
      exclude: [
        ...(configDefaults.coverage?.exclude ?? []),
        "**/*.test.{ts,tsx}",
        "**/*.stories.@(ts|tsx)",
        "**/*.d.ts",
      ],
      // `all: true` counts every included file even if no test imports it, so
      // the % is honest (an untested pure module drags the gate DOWN instead of
      // silently vanishing from the denominator).
      all: true,
      // The pure-logic surface is small and fully controlled, so the gate is
      // strict 100% across the board: any new uncovered line/branch/function in
      // an included module fails CI until tested. Keep it at 100 as modules are
      // added to `include` — never lower it to accommodate untested code.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    projects: [
      // Default jsdom suite — picks up the inline `test` block (name "unit") in vite.config.ts.
      "./vite.config.ts",
      {
        // Don't extend vite.config.ts here — its `test.exclude` removes
        // *.stories.tsx, which is exactly what this project needs to run.
        plugins: [
          storybookTest({
            configDir: path.join(import.meta.dirname, ".storybook"),
            storybookScript: "pnpm storybook --ci --no-open",
          }),
        ],
        resolve: {
          // Site has no `@shared`/`~` aliases — only `@` → src.
          alias: {
            "@": path.join(import.meta.dirname, "src"),
          },
        },
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
          // SB 10.3+ addon-vitest auto-applies preview annotations; no
          // setupFiles needed (it warned us if we passed one).
        },
      },
    ],
  },
});
