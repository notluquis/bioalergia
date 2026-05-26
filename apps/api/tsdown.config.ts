import { defineConfig } from "tsdown";

// Production bundle for apps/api (golden 2026, Approach B).
// Bundles ONLY the workspace packages (@finanzas/*) into a single ESM artifact;
// every npm dependency stays external (resolved from node_modules at runtime).
// This sidesteps Node's refusal to type-strip .ts under node_modules (workspace
// source gets inlined) and removes the need for fix-imports / pnpm deploy /
// injected deps — all of which existed only to ship packages/db as compiled .js.
// Dev is unchanged: `node --watch src/index.ts` (type-stripping on symlinked src).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node26",
  // Auto-injects createRequire / __dirname / __filename shims so bundled CJS
  // deps that call require("node:*") work under ESM output (no manual banner).
  shims: true,
  // No .d.ts: api is an application, not a consumed library. Type-checking is
  // handled separately by tsgo against the composite project references.
  dts: false,
  sourcemap: true,
  // Keep the bundle readable in stack traces; Railway is not byte-constrained.
  minify: false,
  // dist/ holds only the bundle (type-check runs --noEmit elsewhere), so wipe
  // stale hashed chunks each build.
  clean: true,
  // tsdown externalizes everything in package.json dependencies/peerDeps by
  // default — exactly what we want for npm packages. The workspace packages are
  // also listed there, so force them back IN with alwaysBundle (Approach B).
  deps: {
    alwaysBundle: [/^@finanzas\//],
  },
});
