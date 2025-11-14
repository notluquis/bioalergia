import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

const computedBuildId =
  process.env.VITE_APP_BUILD_ID ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `${Date.now()}`;

process.env.VITE_APP_BUILD_ID = computedBuildId;
process.env.VITE_APP_BUILD_TIMESTAMP = process.env.VITE_APP_BUILD_TIMESTAMP || new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  // Ensure process.env.NODE_ENV is available inside the client bundle.
  // Vite sets NODE_ENV based on the current mode (development/production).
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
  build: {
    modulePreload: false,
    outDir: "dist/client",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["lucide-react"],
          "data-vendor": ["dayjs", "zod", "papaparse"],
          "pdf-vendor": ["jspdf", "html2canvas"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "~": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    exclude: [...configDefaults.exclude, "test/employees.integration.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      exclude: [...configDefaults.coverage.exclude, "test/setup.ts"],
    },
  },
});
