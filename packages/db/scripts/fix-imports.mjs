#!/usr/bin/env node
// Cross-platform script to fix import extensions in generated ZenStack files
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const targetDir = join(process.cwd(), 'src/zenstack');

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  
  content = content.replace(/from "\.\/schema"/g, 'from "./schema.js"');
  content = content.replace(/from "\.\/schema-lite"/g, 'from "./schema-lite.js"');
  
  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

try {
  walkDir(targetDir);
  console.log('Import fix complete.');
} catch (err) {
  console.error('Error fixing imports:', err.message);
  process.exit(1);
}
