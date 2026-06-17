import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    mode === "analyze" &&
      visualizer({
        // Let Rollup/Vite handle output placement instead of hard-coding dist/.
        emitFile: true,
        filename: "bundle-analysis.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    // Pick workspace packages' "development" export condition so site
    // dev resolves to `./src/*.ts` (no build needed); production build
    // emits bundled JS regardless. See apps/intranet/vite.config.ts for
    // the longer rationale (Node 26 type-stripping in node_modules).
    conditions: ["development", "module", "browser", "import", "default"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "esnext",
    modulePreload: {
      polyfill: false,
    },
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      // Trust the graph: Let Rolldown's advanced automatic chunking work
      // Removes manual chunks for optimal HTTP/3 multiplexing
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    // Named so vitest.config.ts can reference it as the `unit` project
    // alongside the headless-Chromium `storybook` project (Vitest 4 projects).
    name: "unit",
    // Playwright specs live in e2e/ and run via playwright.config.ts — keep
    // vitest from picking up their *.spec.ts (else "test() called here" error).
    // Coverage config lives in vitest.config.ts (root-level, Vitest 4 projects
    // API) — a project's own `test.coverage` is ignored.
    exclude: [...configDefaults.exclude, "e2e/**", "src/**/*.stories.@(ts|tsx)"],
  },
}));
