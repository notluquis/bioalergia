#!/usr/bin/env npx tsx
/**
 * Route Validation Script
 *
 * Ensures all pages in src/pages are registered in route-data.ts
 * Run with: npm run validate-routes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGES_DIR = path.join(ROOT, "src/pages");
const ROUTE_DATA_PATH = path.join(ROOT, "shared/route-data.ts");

// Pages that don't need to be in route-data.ts (special pages)
const EXCLUDED_PAGES = new Set([
  "NotFoundPage.tsx", // 404 page handled by router
  "ChunkLoadErrorPage.tsx", // Error boundary
]);

// Folders within pages that contain components, not pages
const EXCLUDED_FOLDERS = new Set(["components"]);

function getAllPages(dir: string, baseDir: string = dir): string[] {
  const pages: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Skip excluded folders
      if (EXCLUDED_FOLDERS.has(entry.name)) continue;
      pages.push(...getAllPages(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      // Skip excluded pages
      if (EXCLUDED_PAGES.has(entry.name)) continue;
      pages.push(relativePath);
    }
  }

  return pages;
}

function extractComponentPaths(routeDataContent: string): Set<string> {
  const paths = new Set<string>();

  // Match componentPath values in the route data
  const regex = /componentPath:\s*["']([^"']+)["']/g;
  let match;

  while ((match = regex.exec(routeDataContent)) !== null) {
    paths.add(match[1]);
  }

  return paths;
}

function pageToComponentPath(pagePath: string): string {
  // Convert "Home.tsx" -> "pages/Home"
  // Convert "settings/RolesSettingsPage.tsx" -> "pages/settings/RolesSettingsPage"
  return "pages/" + pagePath.replace(/\.tsx$/, "");
}

function main() {
  console.log("🔍 Validating routes...\n");

  // Get all pages
  const pages = getAllPages(PAGES_DIR);
  console.log(`Found ${pages.length} pages in src/pages`);

  // Read route-data.ts
  const routeDataContent = fs.readFileSync(ROUTE_DATA_PATH, "utf-8");
  const registeredPaths = extractComponentPaths(routeDataContent);
  console.log(`Found ${registeredPaths.size} component paths in route-data.ts\n`);

  // Check for unregistered pages
  const missingPages: string[] = [];

  for (const page of pages) {
    const componentPath = pageToComponentPath(page);
    if (!registeredPaths.has(componentPath)) {
      missingPages.push(page);
    }
  }

  if (missingPages.length === 0) {
    console.log("✅ All pages are registered in route-data.ts\n");
    process.exit(0);
  } else {
    console.error("❌ The following pages are NOT registered in route-data.ts:\n");
    for (const page of missingPages) {
      const componentPath = pageToComponentPath(page);
      console.error(`   - ${page}`);
      console.error(`     Expected componentPath: "${componentPath}"\n`);
    }
    console.error("\n💡 To fix: Add these pages to shared/route-data.ts with proper routes and permissions.\n");
    process.exit(1);
  }
}

main();
