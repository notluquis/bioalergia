import { defineConfig } from "tsdown";

// Emit Node-valid runtime JS for @finanzas/db.
//
// ZenStack's `zen generate` writes extensionless relative imports
// (`from "./schema-lite"`) — bundler-style, invalid for Node ESM. Instead of a
// post-gen string-patcher (the old fix-imports.mjs), let rolldown resolve those
// imports while emitting: each entry below becomes a Node-loadable .js whose
// relative imports are real chunk references with extensions. So `node` can run
// db directly (dev server, scripts) and api's bundle can inline it — no patch.
//
// Type declarations are emitted separately by `tsc --emitDeclarationOnly`
// (composite project references / tsgo perf boundary), so dts is off here and
// clean is off so the two emitters share dist/ without wiping each other.
export default defineConfig({
  entry: [
    "src/client.ts",
    "src/slices.ts",
    "src/zod.ts",
    "src/zenstack/input.ts",
    "src/zenstack/schema.ts",
    "src/zenstack/schema-lite.ts",
    "src/zenstack/models.ts",
  ],
  format: ["esm"],
  platform: "node",
  target: "node26",
  // Emit .d.ts here too (single tool). ZenStack's generated types are not
  // isolated-declarations-able, so use the tsc resolver (oxc-transform falls
  // back anyway); slower than oxc but correct, and it replaces the separate
  // `tsc --emitDeclarationOnly` step entirely.
  dts: { resolver: "tsc" },
  clean: true,
  sourcemap: true,
  outDir: "dist",
  // db's own npm dependencies (@zenstackhq/orm, kysely, pg, zod, …) stay
  // external; only db's own source is processed.
});
