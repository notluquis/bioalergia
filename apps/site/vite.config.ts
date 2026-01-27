import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/bundle-analysis.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          // Strategy: Separate heavy vendors to allow parallel download
          heroui: ["@heroui/react", "@heroui/styles"],
          analytics: ["posthog-js"],
          tanstack: ["@tanstack/react-query"],
        },
      },
    },
    // Increase chunk size limit for this static site (gzip: ~160KB is acceptable)
    chunkSizeWarningLimit: 600,
  },
});
