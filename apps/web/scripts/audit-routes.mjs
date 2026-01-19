#!/usr/bin/env node
/**
 * Route Navigation Audit Script
 *
 * Validates that all page routes have proper navigation metadata.
 * Run with: pnpm audit:routes
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Technical route patterns based on TanStack Router conventions
const TECHNICAL_PATTERNS = [
  /\/_[^/]+/, // Layout routes (_authed, _pathlessLayout)
  /\/\$[^/]+/, // Dynamic params ($id, $postId)
  /\.edit($|\/)/, // Edit pages
  /\/edit($|\/)/, // Edit pages
  /\/create($|\/)/, // Create pages
  /\.add($|\/)/, // Add pages
  /\/add($|\/)/, // Add pages
  /\/index($|\/)/, // Index routes
  /\/\$$/, // Catch-all routes
];

function isTechnicalRoute(path) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(path));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: script logic
async function main() {
  console.log("🔍 Auditing route navigation metadata...\n");

  // Read all route files
  const routesDir = join(process.cwd(), "src", "routes");
  const { globSync } = await import("glob");

  const routeFiles = globSync("**/*.tsx", {
    cwd: routesDir,
    ignore: ["**/*.test.tsx", "**/*.spec.tsx"],
  });

  let validRoutes = 0;
  let technicalRoutes = 0;
  const missingNav = [];
  const missingPermission = [];

  for (const file of routeFiles) {
    const fullPath = `/${file.replace(/\.tsx$/, "").replace(/\\/g, "/")}`;
    const content = readFileSync(join(routesDir, file), "utf-8");

    const hasNav = /staticData:\s*{[^}]*nav:/s.test(content);
    const hasPermission = /staticData:\s*{[^}]*permission:/s.test(content);
    const hideFromNav = /hideFromNav:\s*true/.test(content);

    if (isTechnicalRoute(fullPath)) {
      technicalRoutes++;
      continue;
    }

    // Page routes with permission MUST have nav or explicit hide
    if (hasPermission && !hasNav && !hideFromNav) {
      missingNav.push(fullPath);
      continue;
    }

    // Page routes with nav MUST have permission
    if (hasNav && !hasPermission) {
      missingPermission.push(fullPath);
      continue;
    }

    validRoutes++;
  }

  console.log(`✅ Valid routes: ${validRoutes}`);
  console.log(`🔧 Technical routes (auto-excluded): ${technicalRoutes}`);
  console.log(`⚠️  Missing nav metadata: ${missingNav.length}`);
  console.log(`⚠️  Missing permission: ${missingPermission.length}\n`);

  if (missingNav.length > 0) {
    console.log("❌ Routes missing nav metadata:");
    for (const route of missingNav) {
      console.log(`   - ${route}`);
    }
    console.log("\n💡 Add staticData.nav or staticData.hideFromNav: true to these routes\n");
  }

  if (missingPermission.length > 0) {
    console.log("❌ Routes missing permission:");
    for (const route of missingPermission) {
      console.log(`   - ${route}`);
    }
    console.log("\n💡 Add staticData.permission to these routes\n");
  }

  if (missingNav.length === 0 && missingPermission.length === 0) {
    console.log("✨ All routes are properly configured!\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some routes need attention. See above for details.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
