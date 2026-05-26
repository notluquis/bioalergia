import path from "node:path";

/**
 * Absolute path to apps/api's static `assets/` dir (logos, signatures, fonts).
 *
 * Anchored to the process working directory, NOT to `import.meta.dirname`:
 * the production build bundles this code into `dist/`, which shifts
 * `import.meta.dirname` and breaks any `"../../../assets"` relative climb.
 * The working dir is stable — `apps/api` under `pnpm -F @finanzas/api dev`
 * and `/app` in the container — so `cwd/assets` resolves correctly in both
 * the source-run and bundled-run modes. `API_ASSETS_DIR` overrides it for
 * deployments that place assets elsewhere.
 */
export const ASSETS_DIR: string =
  process.env.API_ASSETS_DIR ?? path.resolve(process.cwd(), "assets");
