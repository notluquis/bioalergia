import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

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
}));
