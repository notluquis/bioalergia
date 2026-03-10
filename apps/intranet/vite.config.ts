import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { cachePreset, VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

// Regex Constants (Top-level scope for performance)
const REGEX_API_FALLBACK = /^\/api/;
const REGEX_SHARE_TARGET_FALLBACK = /^\/share-target/;
const API_PROXY_TARGET =
  process.env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_URL ?? "http://127.0.0.1:4000";
const API_PROXY_SECURE = API_PROXY_TARGET.startsWith("https://");

// Bundle Analysis:
// Use Vite's built-in analysis with: pnpm exec vite build --mode analyze
// Or inspect build output size in terminal during build

export default defineConfig(({ mode }) => {
  const enableChecker = mode === "development";
  const enableReactCompiler = process.env.VITE_REACT_COMPILER !== "false";

  return {
    cacheDir: "../../node_modules/.vite/intranet",
    plugins: [
      // TanStack Router - File-Based Routing (MUST be first)
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
        quoteStyle: "double",
      }),
      // React Compiler currently requires Babel, so keep it behind a flag
      // to benchmark the Babel path against Vite's faster default transform path.
      react(
        enableReactCompiler
          ? {
              babel: {
                plugins: [["babel-plugin-react-compiler", { target: "19" }]],
              },
            }
          : undefined,
      ),
      // Tailwind CSS (official Tailwind plugin for Vite)
      tailwindcss(),
      // TypeScript type-checking in dev mode only
      enableChecker &&
        checker({
          typescript: true,
          overlay: { initialIsOpen: false },
        }),
      // PWA - 2026 best practices configuration
      VitePWA({
        registerType: "prompt", // Let the app control when to update (UX best practice)
        injectRegister: "auto",
        manifestFilename: "manifest.json",
        workbox: {
          cleanupOutdatedCaches: true,
          // No precaching - we use runtime caching only
          globPatterns: [],
          navigateFallbackDenylist: [REGEX_API_FALLBACK, REGEX_SHARE_TARGET_FALLBACK],
          // Runtime caching strategies
          runtimeCaching: [
            {
              // Navigation - fresh content priority
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "pages-cache",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 3,
              },
            },
            // cachePreset: Official vite-plugin-pwa optimized strategies
            // JS/CSS: StaleWhileRevalidate, 24h (serve fast, update in background)
            // Images: StaleWhileRevalidate, 24h
            // Fonts: CacheFirst, 365d
            // See: https://github.com/vite-pwa/vite-plugin-pwa
            ...cachePreset,
          ],
        },
        manifest: {
          name: "Bioalergia Suite",
          short_name: "Bioalergia",
          description:
            "Suite de administración: Finanzas, Servicios, Calendario, RR.HH e Inventario",
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
            {
              src: "/icons/icon-180.png",
              sizes: "180x180",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/logo_bimi.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
          shortcuts: [
            {
              name: "Calendario",
              url: "/calendar",
              icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
            },
            {
              name: "Servicios",
              url: "/services",
              icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
            },
            {
              name: "Transacciones",
              url: "/finance",
              icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
            },
            {
              name: "Empleados",
              url: "/hr/employees",
              icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
            },
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
    ].filter(Boolean),
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
      "import.meta.env.VITE_APP_BUILD_TIMESTAMP": JSON.stringify(new Date().toISOString()),
    },
    optimizeDeps: {
      include: [
        "@finanzas/db",
        "@finanzas/db/schema-lite",
        "@finanzas/db/models",
        "@orpc/client",
        "@orpc/client/fetch",
        "@orpc/client/standard",
        "@tanstack/react-query-devtools",
      ],
    },
    build: {
      target: "esnext", // Native 2026 performance: No transpilation for modern browsers
      minify: "oxc",
      modulePreload: {
        polyfill: false, // Fix "unused preload" warning by relying on native browser preload
      },
      outDir: "dist/client",
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      cssCodeSplit: true, // Split CSS for faster parallel loading
      reportCompressedSize: false, // Skip gzip size calculation during build (faster)
      // 2026: Trust the graph! Manual chunks often hurt HTTP/3 multiplexing.
      // We let Rolldown split based on dynamic imports (React.lazy).
      rollupOptions: {
        // Rolldown's automatic chunking handles splitting based on import graph
      },
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
        "~": fileURLToPath(new URL(".", import.meta.url)),

        // @finanzas/db alias removed to allow subpath exports (schema-lite) to work correctly
      },
    },
    server: {
      warmup: {
        clientFiles: ["./src/routeTree.gen.ts", "./src/main.tsx", "./src/routes/__root.tsx"],
      },
      open: true,
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true,
          secure: API_PROXY_SECURE,
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
  };
});
