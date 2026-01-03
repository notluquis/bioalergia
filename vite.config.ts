import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import viteCompression from "vite-plugin-compression";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

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
    // PWA - 2025 best practices configuration
    VitePWA({
      registerType: "prompt", // Let the app control when to update (UX best practice)
      injectRegister: "auto",
      manifestFilename: "manifest.json",
      workbox: {
        cleanupOutdatedCaches: true,
        // No precaching - we use runtime caching only
        globPatterns: [],
        navigateFallbackDenylist: [/^\/api/, /^\/share-target/],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Navigation requests (HTML) - NetworkFirst to always get fresh HTML
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            // JS/CSS assets - NetworkFirst to ensure fresh after deploys
            // Falls back to cache when offline
            urlPattern: /\.(?:js|css)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "assets-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Fonts - CacheFirst (rarely change)
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: "Bioalergia Suite",
        short_name: "Bioalergia",
        description: "Suite de administración: Finanzas, Servicios, Calendario, RR.HH e Inventario",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Splash screen colors
        background_color: "#000000",
        theme_color: "#0e64b7",
        orientation: "portrait-primary",
        lang: "es-CL",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
          { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
          { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          {
            src: "/logo_bimi.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
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
        // iOS/macOS specific
        screenshots: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            form_factor: "narrow",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            form_factor: "wide",
            type: "image/png",
          },
        ],
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
    "import.meta.env.VITE_APP_BUILD_TIMESTAMP": JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: "esnext", // Native 2026 performance: No transpilation for modern browsers
    modulePreload: {
      polyfill: false, // Fix "unused preload" warning by relying on native browser preload
    },
    outDir: "dist/client",
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: "esbuild", // 2026: esbuild is standard for speed/size balance
    // 2026: Trust the graph! Manual chunks often hurt HTTP/3 multiplexing.
    // We let Vite/Rollup split based on dynamic imports (React.lazy).
    rollupOptions: {
      output: {
        // manualChunks removed to allow granular graph-based splitting
      },
    },
  },
  esbuild: {
    // 2026: Clean logs in production automatically
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
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
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"],
      exclude: [
        ...(configDefaults.coverage?.exclude ?? []),
        "test/setup.ts",
        "**/*.test.{ts,tsx}",
        "**/types.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
}));
