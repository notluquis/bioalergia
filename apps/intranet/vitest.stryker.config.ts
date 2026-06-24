import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Stryker-only Vitest config — exposes ONLY the jsdom `unit` suite.
 *
 * The @stryker-mutator/vitest-runner cannot run Vitest browser-mode projects
 * and has NO project selector (https://stryker-mutator.io/docs/stryker-js/vitest-runner/).
 * It runs every project found in the config it loads. So Stryker must NOT load
 * vite.config.ts / vitest.config.ts (which also declare the `storybook`
 * Playwright/browser project) — it loads this single-project config instead.
 *
 * Keep the alias / setup / exclude lines in sync with the `unit` block in
 * vite.config.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "~": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    // Single project (no `projects:` / no `browser:`) → nothing for the
    // Stryker runner to launch in a browser.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "e2e/**/*.spec.ts",
      "src/**/*.stories.@(ts|tsx)",
      "test/employees.integration.test.ts",
      "node_modules/**",
    ],
  },
});
