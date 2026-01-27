import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          heroui: ["@heroui/react", "@heroui/styles"],
          analytics: ["posthog-js", "@posthog/react"],
          tanstack: ["@tanstack/react-query"],
        },
      },
    },
    // Increase chunk size limit for this static site (gzip: ~160KB is acceptable)
    chunkSizeWarningLimit: 600,
  },
});
