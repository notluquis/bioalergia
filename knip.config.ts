import type { KnipConfig } from "knip";

/**
 * Knip — dead code, unused exports, unused deps.
 *
 * Scope is the active surface (apps + shared packages). Generated artefacts
 * (Prisma client, TanStack route tree, Storybook static, dist) and security/
 * scratch CLI scripts are ignored. Run with: pnpm knip
 */
const config: KnipConfig = {
  ignore: [".conda/**", "**/storybook-static/**", "**/dist/**", "**/.turbo/**"],
  workspaces: {
    ".": {
      entry: ["scripts/**/*.{mjs,ts}"],
      ignoreDependencies: [
        // Approved at workspace root for tooling but consumed only by apps.
        "knip",
        // NAPI runtime peers installed deliberately (see commit f5869f4d
        // "install emnapi peers"); pulled in transitively by native modules.
        "@emnapi/core",
        "@emnapi/runtime",
        // Invoked via .husky/pre-commit (LINT_STAGED_BIN) — knip can't see it.
        "lint-staged",
        // `zen` CLI / SDK kept available at root for dev convenience even
        // though packages/db is the primary consumer.
        "@zenstackhq/cli",
        "@zenstackhq/sdk",
      ],
      // chromatic is invoked via .github/workflows/chromatic.yml using
      // `pnpm -C apps/intranet chromatic` / `pnpm -C apps/site chromatic`;
      // the binary is properly listed in those workspaces' package.json.
      ignoreBinaries: ["chromatic"],
    },
    "apps/intranet": {
      entry: [
        "src/main.tsx",
        // routeTree.gen.ts is the TanStack Router graph root; pulling it in as
        // an entry keeps every route-component file reachable for knip.
        "src/routeTree.gen.ts",
        "vite.config.ts",
        // Service worker built by vite-plugin-pwa (configured in vite.config.ts
        // with srcDir: "src", filename: "sw.ts"). Knip can't follow that.
        "src/sw.ts",
        "scripts/**/*.{mjs,ts}",
        ".storybook/**/*.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "test/**/*.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
      ],
      project: ["src/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
      ignore: ["dist/**", "storybook-static/**"],
      ignoreBinaries: ["tsgo", "oxlint", "oxfmt", "vite", "vitest", "storybook"],
      ignoreDependencies: [
        // Workspace dep; referenced in vite.config.ts optimizeDeps + tsconfig
        // path aliases. Source code currently doesn't import it directly but
        // the workspace link is required for build-time resolution.
        "@finanzas/db",
        // Runtime ZenStack peers re-exported from @finanzas/db; kept as
        // explicit version pins so pnpm hoisting stays deterministic.
        "@zenstackhq/language",
        "@zenstackhq/orm",
        "@zenstackhq/plugin-policy",
        "@zenstackhq/schema",
        "@zenstackhq/server",
        "@zenstackhq/tanstack-query",
        // Lazy/conditional usage; library author kept as available capability.
        "@orpc/tanstack-query",
        "@tanstack/react-virtual",
        // HeroUI v3 styling primitive; loaded transitively by HeroUI runtime.
        "tailwind-variants",
        // dotenv loader used via CLI: `dotenvx run ...` in dev workflows.
        "@dotenvx/dotenvx",
        // Used by tests via `userEvent.setup()` patterns when wired in;
        // kept for incremental test growth.
        "@testing-library/user-event",
        // CLI scripts: `concurrently` chains dev servers; `pino-pretty`
        // pretty-prints API logs in dev terminals.
        "concurrently",
        "pino-pretty",
        // PostCSS plugin invoked by the PostCSS config when present.
        "postcss-preset-env",
        // Husky pre-commit hook runs lint-staged at root; declared here so
        // pnpm install resolves it next to the workspace.
        "lint-staged",
      ],
    },
    "apps/site": {
      entry: ["src/main.tsx", "vite.config.ts"],
      project: ["src/**/*.{ts,tsx}"],
      ignore: ["dist/**", "storybook-static/**"],
    },
    "apps/api": {
      entry: [
        "src/server.ts",
        "src/**/*.test.ts",
        // Operational/maintenance scripts live in both `scripts/` (root of
        // workspace) and `src/scripts/` (run with `node src/scripts/...`).
        "scripts/**/*.{ts,mjs}",
        "src/scripts/**/*.ts",
      ],
      project: ["src/**/*.ts"],
      ignore: ["dist/**"],
      ignoreDependencies: [
        // Runtime ZenStack peers re-exported from @finanzas/db; kept as
        // explicit version pins so pnpm hoisting stays deterministic.
        "@zenstackhq/language",
        "@zenstackhq/orm",
        "@zenstackhq/plugin-policy",
        "@zenstackhq/schema",
        "@zenstackhq/server",
        "@zenstackhq/tanstack-query",
      ],
    },
    "packages/db": {
      entry: ["src/index.ts", "src/**/*.ts"],
      project: ["src/**/*.ts"],
      ignore: ["dist/**", "src/generated/**", "prisma/migrations/**"],
      ignoreDependencies: [
        // Re-exported / required transitively by ZenStack runtime; not
        // imported directly from packages/db source.
        "@zenstackhq/language",
        "@zenstackhq/server",
        "@zenstackhq/tanstack-query",
        "hono",
        "pg-types",
        // Dev tooling used by `zen generate` codegen pipeline + scripts.
        "@tanstack/react-query",
        "@types/react",
        "@zenstackhq/sdk",
        "react",
        "ts-morph",
        "ts-pattern",
      ],
    },
    "packages/orpc-contracts": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
  },
};

export default config;
