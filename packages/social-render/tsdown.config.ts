import { defineConfig } from "tsdown";

// Emit Node-valid runtime JS for @finanzas/social-render (same pattern as
// @finanzas/db). apps/api consumes the .mjs directly. satori + @resvg/resvg-js
// stay external (native bindings / own deps).
export default defineConfig({
  // Separate `brand` entry so consumers (e.g. @finanzas/social-video / Remotion
  // webpack) can import BRAND tokens WITHOUT pulling in satori/@resvg native
  // bindings that the barrel (index) imports — webpack can't bundle .node files.
  entry: ["src/index.ts", "src/brand.ts"],
  format: ["esm"],
  platform: "node",
  target: "node26",
  dts: { resolver: "tsc" },
  clean: true,
  sourcemap: true,
  outDir: "dist",
  deps: { neverBundle: ["satori", "@resvg/resvg-js"] },
});
