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
    // Skip when IS_CHROMATIC is set (`pnpm chromatic` script prefixes the
    // CLI with `IS_CHROMATIC=true` per chromatic.com/docs/ischromatic).
    // Local dev + Vitest test:storybook still load it.
    ...(process.env.IS_CHROMATIC ? [] : ["@storybook/addon-vitest"]),
    // NOTE: @storybook/addon-coverage fue removido (2026-06): solo
    // auto-instrumentaba stories para una señal de coverage advisory que no
    // corría en CI, y arrastraba vite-plugin-istanbul ^6 (peer vite <=6) que
    // rompe contra vite 8. El coverage real lo produce el proyecto Vitest
    // `unit` (`pnpm test:coverage`, vite.config.ts → test.coverage).
    "storybook-addon-tag-badges",
  ],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  // Storybook 10.4: git-based sidebar filtering (new/modified/affected).
  // Layered on top of Chromatic — useful local-only signal to scope work
  // to stories touched on the current branch. OFF under Chromatic: its
  // headless story extractor crashes ("checkGlobals is not defined" →
  // "Failed to extract stories") on the preview-side git/global probe this
  // feature injects. Same IS_CHROMATIC gate as addon-vitest above.
  features: { changeDetection: !process.env.IS_CHROMATIC },
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
