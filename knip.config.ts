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
      ignoreDependencies: [
        // Approved at workspace root for tooling but consumed only by apps.
        "knip",
      ],
    },
    "apps/intranet": {
      entry: [
        "src/main.tsx",
        // routeTree.gen.ts is the TanStack Router graph root; pulling it in as
        // an entry keeps every route-component file reachable for knip.
        "src/routeTree.gen.ts",
        "vite.config.ts",
        "scripts/**/*.{mjs,ts}",
        ".storybook/**/*.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "test/**/*.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
      ],
      project: ["src/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
      ignore: ["dist/**", "storybook-static/**"],
      ignoreBinaries: ["tsgo", "oxlint", "oxfmt", "vite", "vitest", "storybook"],
    },
    "apps/site": {
      entry: ["src/main.tsx", "vite.config.ts"],
      project: ["src/**/*.{ts,tsx}"],
      ignore: ["dist/**", "storybook-static/**"],
    },
    "apps/api": {
      entry: ["src/server.ts", "src/**/*.test.ts", "scripts/**/*.{ts,mjs}"],
      project: ["src/**/*.ts"],
      ignore: ["dist/**"],
    },
    "packages/db": {
      entry: ["src/index.ts", "src/**/*.ts"],
      project: ["src/**/*.ts"],
      ignore: ["dist/**", "src/generated/**", "prisma/migrations/**"],
    },
    "packages/orpc-contracts": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
  },
};

export default config;
