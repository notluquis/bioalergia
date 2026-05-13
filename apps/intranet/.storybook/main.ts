import { fileURLToPath, URL } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-designs",
    // addon-vitest patches Vitest's `expect.customEqualityTesters` on
    // story preview load. Chromatic's headless story extractor doesn't
    // have Vitest in scope and crashes with
    // "Cannot read properties of undefined (reading 'customEqualityTesters')".
    // Skip the addon when CHROMATIC env is set (the chromatic CLI exports
    // it for every run). Local + addon-vitest test:storybook unaffected.
    ...(process.env.CHROMATIC ? [] : ["@storybook/addon-vitest"]),
    // Auto-instruments story files for coverage. NOTE: the actual coverage
    // report is produced by the `unit` Vitest project (`pnpm test:coverage`,
    // see vite.config.ts → test.coverage). Stories are excluded from that
    // include glob to keep the % metric measuring production code, not
    // demo wrappers — the story-coverage signal here is advisory only.
    "@storybook/addon-coverage",
    "storybook-addon-tag-badges",
  ],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  viteFinal: async (baseConfig) =>
    mergeConfig(baseConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("../src", import.meta.url)),
          "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
          "~": fileURLToPath(new URL("..", import.meta.url)),
          // Stub `virtual:pwa-register/react` (provided in app builds by
          // vite-plugin-pwa) so PWA-aware components can render in
          // Storybook + addon-vitest where the plugin is absent.
          "virtual:pwa-register/react": fileURLToPath(
            new URL("./pwa-register-stub.ts", import.meta.url)
          ),
        },
      },
    }),
};

export default config;
