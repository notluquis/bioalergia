#!/usr/bin/env node
/**
 * Cross-platform script to fix import extensions in generated ZenStack files.
 * Best practice 2026: Use native fs/promises with async/await.
 * No external dependencies required.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const targetDir = path.join(process.cwd(), "src/zenstack");

async function processFile(filePath) {
  const content = await readFile(filePath, "utf8");

  // ZenStack generates bundler-style extensionless relative imports
  // (e.g. `from "./schema-lite"`), which Node ESM + NodeNext reject. Append
  // `.js` to every extensionless relative import. Generated files only import
  // sibling modules (never directories), so `.js` is always correct here.
  // Leaves alone imports that already carry an extension (.js/.ts/.json/...).
  const RELATIVE_IMPORT = /(from\s+["'])(\.\.?\/[^"']+?)(["'])/g;
  const fixed = content.replaceAll(RELATIVE_IMPORT, (match, pre, spec, post) => {
    if (/\.(js|ts|json|mjs|cjs)$/.test(spec)) {
      return match;
    }
    return `${pre}${spec}.js${post}`;
  });

  if (fixed !== content) {
    await writeFile(filePath, fixed, "utf8");
    console.log(`Fixed: ${filePath}`);
  }
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.name.endsWith(".ts")) {
        await processFile(fullPath);
      }
    })
  );
}

try {
  await walkDir(targetDir);
  console.log("Import fix complete.");
} catch (error) {
  console.error("Error fixing imports:", error.message);
  process.exit(1);
}
