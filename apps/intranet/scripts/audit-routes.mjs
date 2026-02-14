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

function shouldSkipRoute({ absolutePath, filename, relativePath }) {
  if (filename.startsWith("_")) {
    return true;
  }
  if (isLayoutRoute(absolutePath)) {
    return true;
  }
  return isTechnicalRoute(relativePath);
}

function evaluateRouteMetadata(content) {
  const hasNav = STATIC_NAV_REGEX.test(content);
  const hasPermission = STATIC_PERMISSION_REGEX.test(content);
  const hideFromNav = HIDE_FROM_NAV_REGEX.test(content);

  if (hasPermission && !hasNav && !hideFromNav) {
    return "missing-nav";
  }
  if (hasNav && !hasPermission) {
    return "missing-permission";
  }
  return "valid";
}

function printAuditResult({ missingNav, missingPermission, technicalRoutes, validRoutes }) {
  console.log(`✅ Valid routes: ${validRoutes}`);
  console.log(`🔧 Technical routes (auto-excluded): ${technicalRoutes}`);

  if (missingNav.length === 0 && missingPermission.length === 0) {
    console.log("⚠️  Missing nav metadata: 0");
    console.log("⚠️  Missing permission: 0\n");
    console.log("✨ All routes are properly configured!\n");
    return 0;
  }

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

  return 1;
}

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

    if (shouldSkipRoute({ absolutePath, filename, relativePath })) {
      technicalRoutes++;
      continue;
    }

    const content = readFileSync(absolutePath, "utf-8");
    const displayPath = `/${relativePath.replace(TSX_EXTENSION_REGEX, "")}`;

    const status = evaluateRouteMetadata(content);
    if (status === "missing-nav") {
      missingNav.push(displayPath);
      continue;
    }
    if (status === "missing-permission") {
      missingPermission.push(displayPath);
      continue;
    }

    validRoutes++;
  }

  const exitCode = printAuditResult({ missingNav, missingPermission, technicalRoutes, validRoutes });
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
