import { defineConfig } from "tsdown";

// Emit Node-valid runtime JS for @finanzas/social-render (same pattern as
// @finanzas/db). apps/api consumes the .mjs directly. satori + @resvg/resvg-js
// stay external (native bindings / own deps).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node26",
  dts: { resolver: "tsc" },
  clean: true,
  sourcemap: true,
  outDir: "dist",
  external: ["satori", "@resvg/resvg-js"],
});
