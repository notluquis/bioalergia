// Stand-alone TanStack Router route-tree generator. Runs the
// @tanstack/router-generator without spinning up Vite, so the
// `type-check` turbo task can refresh `src/routeTree.gen.ts`
// before `tsgo` complains about unknown FileRoutesByPath keys.
// Used by `pnpm type-check:prepare` (wired into the turbo pipeline).
//
// Why not Vite: Vite build also generates routes but takes ~30s and
// emits a full dist/. We only need the route-tree refresh — runs
// in ~200ms.

import { Generator, getConfig } from "@tanstack/router-generator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// `getConfig` fills in every default the Generator needs (token
// regexes, code-splitting flags, virtual route hooks). Without it
// the constructor throws on first run.
const config = getConfig(
  {
    routesDirectory: resolve(root, "src/routes"),
    generatedRouteTree: resolve(root, "src/routeTree.gen.ts"),
    target: "react",
    autoCodeSplitting: true,
    quoteStyle: "double",
  },
  root
);

const generator = new Generator({ config, root });
await generator.run();
console.log("[generate-routes] routeTree.gen.ts refreshed");
