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
    // Playwright specs live in e2e/ and run via playwright.config.ts — keep
    // vitest from picking up their *.spec.ts (else "test() called here" error).
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      // V8 provider (Vitest 4 recommended: faster, AST-accurate remapping).
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // GATING is scoped to the PURE-LOGIC surface of the site — the code that
      // can regress silently and is unit-testable without a DOM. The UI layer
      // (route components, HeroUI sections, shop pages) is covered by Chromatic
      // (visual) + Playwright e2e + axe a11y instead, so it is intentionally
      // NOT in this denominator (a jsdom render-test suite doesn't exist here).
      // Add a module to this list — with its tests — when new pure logic lands.
      include: ["src/lib/nav-active.ts", "src/lib/seo.ts", "src/features/shop/lib/shop-config.ts"],
      exclude: [
        ...(configDefaults.coverage?.exclude ?? []),
        "**/*.test.{ts,tsx}",
        "**/*.stories.@(ts|tsx)",
        "**/*.d.ts",
      ],
      // `all: true` counts every included file even if no test imports it, so
      // the % is honest (an untested pure module drags the gate down instead of
      // silently vanishing from the denominator).
      all: true,
      // Thresholds = MEASURED actual minus a small headroom → a real, honest
      // gate, not aspirational fiction. Ratchet UP after a test batch raises
      // actuals. Measured 2026-06 (all:true): 100/100/100/100 on this surface.
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 100,
        lines: 95,
      },
    },
  },
}));
