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
    "storybook-addon-tag-badges",
  ],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  // Storybook 10.4: git-based sidebar filtering.
  features: { changeDetection: true },
  viteFinal: async (baseConfig) =>
    mergeConfig(baseConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("../src", import.meta.url)),
        },
        // Ver intranet/.storybook/main.ts: `msw` arrastra `graphql@16` y
        // @vitest/mocker trae su propia copia → Vite pre-empaqueta >1 instancia
        // de graphql en el preview y revienta con "Cannot use GraphQLScalarType
        // from another module or realm". El fix vive en `viteFinal` (addon-vitest
        // construye el preview vía `presets.apply("viteFinal")`). `graphql` es
        // devDep directa para que pnpm lo resuelva desde la raíz. Ref: storybook#33091.
        dedupe: ["graphql", "msw", "@mswjs/interceptors"],
      },
      optimizeDeps: {
        include: ["graphql", "msw", "msw/browser"],
      },
    }),
};

export default config;
