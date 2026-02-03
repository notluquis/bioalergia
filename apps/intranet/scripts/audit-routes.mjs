#!/usr/bin/env node
/**
 * Route Navigation Audit Script
 *
 * Validates that all page routes have proper navigation metadata.
 * Run with: pnpm audit:routes
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, parse, sep } from "node:path";

const STATIC_NAV_REGEX = /staticData:[\s\S]*?\bnav:/s;
const STATIC_PERMISSION_REGEX = /staticData:[\s\S]*?\bpermission:/s;
const HIDE_FROM_NAV_REGEX = /hideFromNav:\s*true/;
const TSX_EXTENSION_REGEX = /\.tsx$/;

// Technical patterns to exclude based on common naming conventions
// We exclude:
// - Dynamic routes ($id)
// - Edit/Create/Add actions (usually not main nav items)
const TECHNICAL_PATTERNS = [
  /\$[^/]+/, // Dynamic params in path or filename ($id)
  /\.edit\.tsx$/, // Edit pages
  /\/edit\.tsx$/, // Edit pages
  /\/create\.tsx$/, // Create pages
  /\/add\.tsx$/, // Add pages
];

function isTechnicalRoute(filePath) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(filePath));
}

// Check if a route is a Layout Route (has a sibling directory with the same name)
function isLayoutRoute(absolutePath) {
  const parsed = parse(absolutePath);
  const potentialDir = join(parsed.dir, parsed.name);
  return existsSync(potentialDir) && statSync(potentialDir).isDirectory();
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: script logic
async function main() {
  console.log("🔍 Auditing route navigation metadata...\n");

  // Read all route files
  const routesDir = join(process.cwd(), "src", "routes");
  const { globSync } = await import("glob");

  const routeFiles = globSync("**/*.tsx", {
    cwd: routesDir,
    ignore: ["**/*.test.tsx", "**/*.spec.tsx", "**/*.d.ts"],
  });

  let validRoutes = 0;
  let technicalRoutes = 0;
  const missingNav = [];
  const missingPermission = [];

  for (const file of routeFiles) {
    const relativePath = file.split(sep).join("/");
    const absolutePath = join(routesDir, file);
    const parsed = parse(absolutePath);
    const filename = parsed.base;

    // 1. Exclude Files starting with "_" (Layouts, __root, _authed wrapper files)
    // Note: This does NOT exclude folders starting with "_", only the file itself.
    // e.g. "_authed/index.tsx" (filename "index.tsx") is NOT excluded.
    // e.g. "_authed.tsx" (filename "_authed.tsx") IS excluded.
    if (filename.startsWith("_")) {
      technicalRoutes++;
      continue;
    }

    // 2. Exclude Layout Routes (Files that define a layout for a directory of the same name)
    // e.g. "settings.tsx" paired with "settings/" directory.
    if (isLayoutRoute(absolutePath)) {
      technicalRoutes++;
      continue;
    }

    // 3. Exclude specific technical patterns (Dynamic $, Actions)
    if (isTechnicalRoute(relativePath)) {
      technicalRoutes++;
      continue;
    }

    const content = readFileSync(absolutePath, "utf-8");

    // Use [\s\S]*? to lazily match content including newlines, ensuring we don't stop at first '}'
    // This allows matching keys that appear after a nested object (e.g. nav: { ... }, permission: { ... })
    const hasNav = STATIC_NAV_REGEX.test(content);
    const hasPermission = STATIC_PERMISSION_REGEX.test(content);
    const hideFromNav = HIDE_FROM_NAV_REGEX.test(content);

    const displayPath = `/${relativePath.replace(TSX_EXTENSION_REGEX, "")}`;

    // Page routes with permission MUST have nav or explicit hide
    if (hasPermission && !hasNav && !hideFromNav) {
      missingNav.push(displayPath);
      continue;
    }

    // Page routes with nav MUST have permission
    if (hasNav && !hasPermission) {
      missingPermission.push(displayPath);
      continue;
    }

    validRoutes++;
  }

  console.log(`✅ Valid routes: ${validRoutes}`);
  console.log(`🔧 Technical routes (auto-excluded): ${technicalRoutes}`);

  if (missingNav.length === 0 && missingPermission.length === 0) {
    console.log("⚠️  Missing nav metadata: 0");
    console.log("⚠️  Missing permission: 0\n");
    console.log("✨ All routes are properly configured!\n");
    process.exit(0);
  } else {
    console.log(`⚠️  Missing nav metadata: ${missingNav.length}`);
    console.log(`⚠️  Missing permission: ${missingPermission.length}\n`);

    if (missingNav.length > 0) {
      console.log("❌ Routes missing nav metadata (Visible Pages):");
      for (const route of missingNav) {
        console.log(`   - ${route}`);
      }
      console.log("\n💡 Add staticData.nav or staticData.hideFromNav: true to these routes\n");
    }

    if (missingPermission.length > 0) {
      console.log("❌ Routes missing permission (Navigable Pages):");
      for (const route of missingPermission) {
        console.log(`   - ${route}`);
      }
      console.log("\n💡 Add staticData.permission to these routes\n");
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
