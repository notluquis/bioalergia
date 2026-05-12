import { fileURLToPath, URL } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const reactCompiler = reactCompilerPreset();
import checker from "vite-plugin-checker";
import { cachePreset, VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

// Regex Constants (Top-level scope for performance)
const REGEX_API_FALLBACK = /^\/api/;
const API_PROXY_TARGET =
  process.env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_URL ?? "http://127.0.0.1:4000";
const API_PROXY_SECURE = API_PROXY_TARGET.startsWith("https://");

// Bundle Analysis:
// Use Vite's built-in analysis with: pnpm exec vite build --mode analyze
// Or inspect build output size in terminal during build

export default defineConfig(({ mode }) => {
  const enableChecker = mode === "development";

  // CSP nonce placeholder injected into every <script> and stylesheet
  // <link> tag in the built index.html. Caddy substitutes this Go-template
  // expression with a per-request UUID via the `templates` directive
  // (see apps/intranet/Caddyfile), and emits a matching
  // Content-Security-Policy header so the browser only executes scripts
  // carrying that exact nonce — the strict-CSP / strict-dynamic pattern
  // recommended by the OWASP CSP cheat sheet and W3C CSP3 §6.1.
  const CSP_NONCE_PLACEHOLDER = '{{ placeholder "http.request.uuid" }}';
  const cspNoncePlugin = {
    name: "csp-nonce-placeholder",
    transformIndexHtml(html: string) {
      return html
        .replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${CSP_NONCE_PLACEHOLDER}"`)
        .replace(
          /<link\b([^>]*\brel=["']stylesheet["'])(?![^>]*\bnonce=)/g,
          `<link nonce="${CSP_NONCE_PLACEHOLDER}"$1`
        );
    },
    // `vite preview` serves the built index.html as-is, so the Caddy nonce
    // placeholder is left intact and the browser blocks every <script>. This
    // middleware substitutes the placeholder with a per-request UUID and
    // emits a matching Content-Security-Policy header so React mounts and
    // Lighthouse / Playwright can audit the production bundle locally.
    configurePreviewServer(server: import("vite").PreviewServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";
        const isHtml =
          url === "/" ||
          url === "" ||
          url === "/index.html" ||
          (!url.includes(".") && !url.startsWith("/api"));
        if (!isHtml) return next();
        try {
          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          const indexPath = path.resolve("dist/client/index.html");
          let html = await fs.readFile(indexPath, "utf8");
          const { randomUUID } = await import("node:crypto");
          const nonce = randomUUID().replaceAll("-", "");
          html = html.replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader(
            "Content-Security-Policy",
            [
              "default-src 'self'",
              // Mirrors apps/intranet/Caddyfile (production). 'unsafe-inline'
              // is ignored by browsers when 'strict-dynamic' + nonce are
              // present, except for inline event handlers like the deferred
              // CSS-load <link onload="this.media='all'"> in index.html —
              // those need 'unsafe-hashes' or 'unsafe-inline'.
              // 'unsafe-hashes' + sha256 hash unblocks the deferred CSS-load
              // <link onload="this.media='all'"> in index.html, the only
              // inline event handler the bundle ships. https: lets dynamic
              // imports load chunks (vite preview serves them with hashed
              // urls under /assets).
              `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-hashes' 'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc=' https:`,
              `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' http://localhost:* ws://localhost:* https://*",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join("; ")
          );
          res.statusCode = 200;
          res.end(html);
        } catch (err) {
          next(err as Error);
        }
      });
    },
  };

  return {
    cacheDir: "../../node_modules/.vite/intranet",
    plugins: [
      cspNoncePlugin,
      // TanStack Router - File-Based Routing (MUST be first)
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
        quoteStyle: "double",
      }),
      react(),
      babel({ presets: [reactCompiler] }),
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
          navigateFallbackDenylist: [REGEX_API_FALLBACK],
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
              name: "Prestaciones",
              url: "/clinical/agenda",
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
      "import.meta.env.VITE_APP_BUILD_TIMESTAMP": JSON.stringify(
        process.env.VITE_APP_BUILD_TIMESTAMP ??
          process.env.SOURCE_DATE_EPOCH ??
          process.env.RAILWAY_GIT_COMMIT_SHA ??
          process.env.GITHUB_SHA ??
          ""
      ),
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
