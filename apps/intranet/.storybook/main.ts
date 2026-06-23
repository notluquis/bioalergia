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
  // to stories touched on the current branch.
  features: { changeDetection: true },
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
        // `msw` (red mock de las stories + addon-vitest) arrastra `graphql@16`,
        // y @vitest/mocker trae su propia copia bundleada de msw → Vite
        // pre-empaqueta >1 instancia de graphql en el preview del browser y sus
        // checks `instanceof` revientan con "Cannot use GraphQLScalarType from
        // another module or realm" (rompía SocialPage.stories y arrastraba a
        // UpdateNotification por recarga de chunks). El fix vive en `viteFinal`
        // (NO en vitest.config.ts): addon-vitest construye el preview del
        // browser vía `presets.apply("viteFinal")`, así que es el único Vite
        // config que toca esos módulos. `graphql` se declara como devDep directa
        // para que pnpm lo resuelva desde la raíz. Ref: storybook#33091.
        dedupe: ["graphql", "msw", "@mswjs/interceptors"],
      },
      optimizeDeps: {
        // El builder de Storybook ya pre-escanea todas las stories + preview
        // como `optimizeDeps.entries` (PR storybook#33875), pero esbuild no
        // sigue ciertas cadenas dinámicas/transitivas profundas, así que algunas
        // deps pesadas se descubren TARDE (mid-run) → Vite re-optimiza → recarga
        // la página → los imports dinámicos en vuelo dan 404 ("Failed to fetch
        // dynamically imported module" / "Chunk Load Failure"). El fix golden
        // (documentado: el propio Vitest imprime la lista y pide agregarla acá)
        // es nombrarlas explícitamente para forzarlas al pre-bundle inicial.
        // Globs NO sirven en `include` (vitejs/vite#16174) → specifiers exactos.
        // dedupe sola tampoco basta para un dual CJS/ESM como graphql.
        include: [
          "graphql",
          "msw",
          "msw/browser",
          "@sentry/react",
          "@simplewebauthn/browser",
          "@tanstack/react-pacer",
          "@tanstack/react-query-devtools",
          "@tanstack/router-devtools",
          "i18next",
          "react-i18next",
          "jspdf",
          "jspdf-autotable",
          "recharts",
        ],
      },
    }),
};

export default config;
