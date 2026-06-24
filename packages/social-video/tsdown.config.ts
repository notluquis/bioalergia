import { defineConfig } from "tsdown";

// Build ONLY the programmatic render entry (render.ts → Node-valid .mjs). It's
// consumed by apps/api's render script as @finanzas/social-video — and since the
// package is `injected: true`, pnpm hard-links it under node_modules, where Node
// 26 REFUSES to strip types from .ts. So render.ts must ship as .mjs (same
// reason @finanzas/db ships .mjs).
//
// The .tsx compositions (Root.tsx / ReelTemplate.tsx) are NOT bundled here:
// Remotion's own webpack (bundle()) compiles them from src/ at render time
// (render.ts points its entryPoint at ../src/Root.tsx). React/Remotion stay
// external — they're only needed inside Remotion's webpack graph, not in render.mjs.
export default defineConfig({
  entry: ["src/render.ts"],
  format: ["esm"],
  platform: "node",
  target: "node26",
  dts: { resolver: "tsc" },
  clean: true,
  sourcemap: true,
  outDir: "dist",
  deps: {
    neverBundle: [
      "@remotion/bundler",
      "@remotion/renderer",
      "@remotion/cli",
      "remotion",
      "react",
      "react-dom",
    ],
  },
});
