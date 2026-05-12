import path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Vitest 4 multi-project config.
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
    projects: [
      // Default jsdom suite — picks up the inline `test` block in vite.config.ts.
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
          alias: {
            "@": path.join(import.meta.dirname, "src"),
            "@shared": path.join(import.meta.dirname, "shared"),
            "~": import.meta.dirname,
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
