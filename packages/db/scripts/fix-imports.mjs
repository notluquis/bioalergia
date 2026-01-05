#!/usr/bin/env node
/**
 * Cross-platform script to fix import extensions in generated ZenStack files.
 * Best practice 2026: Use native fs/promises with async/await.
 * No external dependencies required.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const targetDir = join(process.cwd(), 'src/zenstack');

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  
  const fixed = content
    .replace(/from "\.\/schema"/g, 'from "./schema.js"')
    .replace(/from "\.\/schema-lite"/g, 'from "./schema-lite.js"');
  
  if (fixed !== content) {
    await writeFile(filePath, fixed, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.name.endsWith('.ts')) {
        await processFile(fullPath);
      }
    })
  );
}

try {
  await walkDir(targetDir);
  console.log('Import fix complete.');
} catch (err) {
  console.error('Error fixing imports:', err.message);
  process.exit(1);
}
