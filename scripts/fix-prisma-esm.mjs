#!/usr/bin/env node

/**
 * Fix Prisma ESM imports by adding .js extensions
 *
 * Prisma's ESM generator doesn't add .js extensions to relative imports,
 * which causes Node.js ESM to fail with ERR_MODULE_NOT_FOUND in production.
 * This script post-processes the generated Prisma client to add the extensions.
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const PRISMA_DIR = "generated/prisma";

async function fixFileImports(filePath) {
  const content = await readFile(filePath, "utf-8");

  // Replace relative imports without .js extension
  // Matches: from "./something" or from '../something'
  // But NOT: from "./something.js" or from "external-package"
  const fixed = content.replace(
    /from\s+(['"])(\.[^'"]+?)(?<!\.js)\1/g,
    (match, quote, path) => {
      // Add .js extension
      return `from ${quote}${path}.js${quote}`;
    }
  );

  if (fixed !== content) {
    await writeFile(filePath, fixed, "utf-8");
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

async function processDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  let fixedCount = 0;

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      fixedCount += await processDirectory(fullPath);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
      const wasFixed = await fixFileImports(fullPath);
      if (wasFixed) fixedCount++;
    }
  }

  return fixedCount;
}

async function main() {
  console.log("🔧 Fixing Prisma ESM imports...\n");

  try {
    const fixedCount = await processDirectory(PRISMA_DIR);

    if (fixedCount > 0) {
      console.log(`\n✅ Fixed ${fixedCount} file(s)`);
    } else {
      console.log("\n✓ No fixes needed");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
