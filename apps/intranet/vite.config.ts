import { fileURLToPath, URL } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type PreviewServer } from "vite";

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
    configurePreviewServer(server: PreviewServer) {
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
              // is ignored by browsers when nonce + strict-dynamic are
              // present (kept as a safe fallback for older clients). All
              // inline event handlers were lifted out of index.html to
              // addEventListener inside a nonced inline script, so the
              // policy no longer needs 'unsafe-hashes'.
              `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
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
        // injectManifest swaps the auto-generated SW for our own custom
        // file so we can wire `push` + `notificationclick` listeners
        // alongside Workbox precaching. generateSW (the default) does
        // NOT handle push events — without our SW the W3C Web Push
        // packets arrive but never reach the OS notification center.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectManifest: {
          // Precache the SPA shell so the app boots offline. The SW
          // (sw.ts) calls precacheAndRoute(self.__WB_MANIFEST) and
          // setCatchHandler falls back to /index.html for any
          // navigation that escapes the runtime cache. globPatterns
          // intentionally excludes /icons (already cached as runtime
          // images) and source maps to keep the precache lean.
          globPatterns: ["**/*.{js,css,html,svg,woff,woff2,webmanifest,json}"],
          globIgnores: ["**/*.map", "icons/**", "**/sw.js", "**/workbox-*.js"],
          // Hard cap to avoid quietly precaching multi-MB chunks.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
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
          // Stable install identity (golden 2026). Without `id`, identity is
          // derived from start_url and a path change forks a duplicate install.
          id: "/?source=pwa",
          name: "Bioalergia Suite",
          short_name: "Bioalergia",
          description:
            "Suite de administración: Finanzas, Servicios, Calendario, RR.HH e Inventario",
          start_url: "/?source=pwa",
          scope: "/",
          display: "standalone",
          // Desktop (Win/macOS) reclaim titlebar when available; graceful fallback.
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          // Re-launch / deep-link / share-target focuses the running window
          // instead of spawning a second one.
          launch_handler: { client_mode: ["focus-existing", "auto"] },
          // Splash screen colors
          background_color: "#000000",
          theme_color: "#0e64b7",
          // `any` so installed tablet/desktop (data-table heavy) isn't locked
          // to portrait.
          orientation: "any",
          lang: "es-CL",
          categories: ["business", "productivity", "medical"],
          // NOTE: these PNGs are full-bleed (no safe-zone), so declared `any`
          // ONLY — NOT `maskable`. Claiming maskable on a full-bleed asset
          // makes Android crop the logo. A dedicated padded maskable-512 is a
          // design TODO (PWA audit); add it as a separate `purpose:"maskable"`
          // entry once produced.
          icons: [
            { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
            { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
            { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
            { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
            { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
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
          // Web Share Target API — receive shared images/PDFs from
          // other PWAs/native apps directly into the WhatsApp inbox.
          // The SW intercepts POST /share-target, stashes payload in
          // Cache, and 303-redirects to /wa-cloud?shared=1 where the
          // SPA pulls it back. Spec: w3.org/TR/web-share-target/.
          share_target: {
            action: "/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
              files: [
                {
                  name: "files",
                  accept: ["image/*", "application/pdf", "audio/*", "video/*"],
                },
              ],
            },
          },
          // `screenshots` intentionally omitted: Chromium's richer install
          // dialog needs REAL app screenshots at proper aspect ratios
          // (e.g. 1280×720 wide, 720×1280 narrow). The previous entries
          // reused 192/512 icons, which Chromium rejects. Add real captures
          // (design TODO) to re-enable the richer install UI.
        },
        devOptions: { enabled: false },
      }),
      // Sentry source-map upload — MUST be the last plugin so it runs after
      // Rolldown emits the .map files into dist/client/assets. With
      // `sourcemap: 'hidden'` above, .map files exist on disk without a
      // //# sourceMappingURL comment; this plugin uploads them to Sentry
      // and then deletes them locally so Caddy's @sourcemaps 404 matcher
      // is purely defense-in-depth. No-ops without SENTRY_AUTH_TOKEN so
      // dev/preview builds stay frictionless.
      sentryVitePlugin({
        org: "bioalergia",
        project: "javascript",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        disable: !process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.VITE_APP_BUILD_TIMESTAMP ?? undefined },
        telemetry: false,
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
      // `hidden` emits .map files alongside the bundle but omits the
      // `//# sourceMappingURL=` comment from the JS, so browsers don't fetch
      // them. Maps live in dist/client/assets/ but Caddy's site config strips
      // them before serving (`@maps` matcher → 404). Decode prod stack traces
      // locally with `pnpm exec source-map-explorer dist/client/assets/<file>.js.map`
      // or upload to an error tracker. Golden 2026 default for SPAs that need
      // diagnosable prod errors without leaking source to the public.
      sourcemap: "hidden",
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
      // Pick the workspace packages' "development" export condition so
      // intranet (dev server + vitest) resolves to `./src/*.ts` instead
      // of `./dist/*.js`. Node 26 in production picks `default` → dist,
      // which is built before the Docker runtime stage. Workaround for
      // ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING when sibling
      // workspace packages would otherwise ship TS source to node_modules
      // (Node 26 refuses to strip types under node_modules).
      conditions: ["development", "module", "browser", "import", "default"],
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
          // When proxying to a *remote* authed API (e.g.
          // VITE_API_PROXY_TARGET=https://intranet.bioalergia.cl to run
          // the local SPA against production data), the upstream
          // Set-Cookie carries `Domain=intranet.bioalergia.cl` — the
          // browser rejects it on localhost and the session never
          // sticks. Rewriting the cookie domain to the dev host makes it
          // host-only so auth works. Harmless for the default local-API
          // target, which sends no Domain attribute.
          cookieDomainRewrite: "localhost",
        },
      },
    },
    test: {
      name: "unit",
      environment: "jsdom",
      globals: true,
      setupFiles: "./test/setup.ts",
      exclude: [
        ...configDefaults.exclude,
        "test/employees.integration.test.ts",
        // Playwright specs run under playwright, not vitest.
        "e2e/**/*.spec.ts",
        // Storybook stories run under the `storybook` project (vitest.config.ts).
        "src/**/*.stories.@(ts|tsx)",
      ],
      coverage: {
        // V8 is the Vitest 4 recommended provider (faster, lower memory,
        // accurate AST-based remapping as of v3.2.0). Test files use the
        // `vi.mock(spec, async (importOriginal) => { const actual =
        // await importOriginal<...>(); ... })` helper pattern instead
        // of the legacy `vi.importActual(spec)` Jest-compat alias —
        // the latter has known v8-coverage instrumentation issues
        // (vitest issue #9771, fixed by switching to importOriginal).
        provider: "v8",
        reporter: ["text", "lcov", "html"],
        include: ["src/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"],
        exclude: [
          ...(configDefaults.coverage?.exclude ?? []),
          "test/setup.ts",
          "**/*.test.{ts,tsx}",
          "**/*.stories.@(ts|tsx)",
          "**/types.ts",
          "**/*.d.ts",
        ],
        // `all: true` includes every file in the include glob, even
        // those no test imports. Without it Vitest only counts loaded
        // files and the % is misleading (artificially high — uncovered
        // files don't contribute to the denominator). Trade-off: slower
        // run because v8 has to instrument the full src tree.
        all: true,
        // Thresholds tracked as the test suite grows toward the
        // aspirational 80% lines / 75% branches goal. CI job runs
        // `continue-on-error: true` so a regression highlights but
        // doesn't block merges. Step ladder: lifted from 40/40/30/40
        // after pure-utility test sprint took the baseline to
        // ~74.89% lines / 66.23% branches. Next milestone targets
        // listed below; raise after each test batch lands.
        // Milestones: 75/65 -> 78/70 -> 80/75 (TARGET REACHED 2026-05-13).
        // Coverage push 5-step roadmap (commits 19340d83, bb312d80,
        // af1a*, *4cab8f4a) lifted intranet from 65.7% to 81.05% lines.
        // Threshold at 80/65 = current actual minus a 1pp safety margin
        // for noise. Branches remain at 65 (current 69.71%); branches are
        // the slowest metric to lift because TanStack/HeroUI components
        // hide many one-off conditionals only reachable via render tests.
        thresholds: {
          lines: 93,
          functions: 93,
          branches: 83,
          statements: 91,
        },
      },
    },
  };
});
