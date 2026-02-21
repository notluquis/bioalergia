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
      // Let Rollup/Vite handle output placement instead of hard-coding dist/.
      emitFile: true,
      filename: "bundle-analysis.html",
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
    target: "esnext",
    rollupOptions: {
      // Trust the graph: Let Rolldown's advanced automatic chunking work
      // Removes manual chunks for optimal HTTP/3 multiplexing
    },
    chunkSizeWarningLimit: 600,
  },
});
