import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";
import checker from "vite-plugin-checker";
import viteCompression from "vite-plugin-compression";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // TypeScript type-checking in dev mode
    mode === "development" && checker({ typescript: true }),
    // Bundle analyzer in dev mode
    mode === "development" &&
      visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    // PWA - generates manifest and minimal SW
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        // Minimal precaching - only HTML
        globPatterns: ["index.html"],
        // No runtime caching - rely on HTTP cache + Vite hashes
        runtimeCaching: [],
        navigateFallbackDenylist: [/^\/api/, /^\/share-target/],
      },
      manifest: {
        name: "Bioalergia Suite",
        short_name: "Bioalergia",
        description: "Suite de administración: Finanzas, Servicios, Calendario, RR.HH e Inventario",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#0e64b7",
        orientation: "any",
        lang: "es-CL",
        icons: [
          { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
          { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        shortcuts: [
          { name: "Calendario", url: "/calendar", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
          { name: "Servicios", url: "/services", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
          { name: "Transacciones", url: "/finance", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
          { name: "Empleados", url: "/hr/employees", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
        ],
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [{ name: "media", accept: ["image/*", "application/pdf"] }],
          },
        },
      },
      devOptions: { enabled: false },
    }),
    // Gzip compression in production
    mode === "production" &&
      viteCompression({
        algorithm: "gzip",
        threshold: 1024,
      }),
    // Brotli compression in production
    mode === "production" &&
      viteCompression({
        algorithm: "brotliCompress",
        threshold: 1024,
      }),
  ].filter(Boolean),
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
  build: {
    modulePreload: false,
    outDir: "dist/client",
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": ["lucide-react"],
          "data-vendor": ["dayjs", "zod"],
          "calendar-vendor": [
            "@fullcalendar/core",
            "@fullcalendar/react",
            "@fullcalendar/daygrid",
            "@fullcalendar/timegrid",
            "@fullcalendar/interaction",
          ],
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
      exclude: [...(configDefaults.coverage?.exclude ?? []), "test/setup.ts"],
    },
  },
}));
