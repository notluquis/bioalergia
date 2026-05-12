import { defineWorkspace } from "vitest/config";
import path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

/**
 * Vitest workspace.
 *
 * Two projects share one runner:
 *   - `unit`     → existing jsdom suite, config inherited from vite.config.ts
 *   - `storybook`→ runs every *.stories.tsx in a real Chromium via Playwright,
 *                  using the same preview decorators (themes, MSW, a11y).
 *
 * The Storybook test-runner package is deprecated for Vite-based stacks
 * since Storybook 10.3 — addon-vitest is the supported replacement.
 * https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
 */
export default defineWorkspace([
  "./vite.config.ts",
  {
    extends: "./vite.config.ts",
    plugins: [
      storybookTest({
        configDir: path.join(import.meta.dirname, ".storybook"),
        storybookScript: "pnpm storybook --ci --no-open",
      }),
    ],
    test: {
      name: "storybook",
      browser: {
        enabled: true,
        provider: playwright({}),
        headless: true,
        instances: [{ browser: "chromium" }],
      },
      setupFiles: ["./.storybook/vitest.setup.ts"],
    },
  },
]);
