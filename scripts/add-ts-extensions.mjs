#!/usr/bin/env node
/**
 * Codemod: rewrite every relative import in the given source trees so it
 * carries the explicit file extension Node.js requires for native ESM
 * execution. Necessary precondition for running TypeScript through Node's
 * native type-stripping (Node ≥ 25.2) instead of `tsx`.
 *
 * Behaviour
 *   * Walks each input directory recursively (skipping node_modules / dist /
 *     .turbo / .next / coverage).
 *   * For each .ts / .tsx / .mts / .cts file, rewrites:
 *       - static `from "./foo"` / `from "../foo"`
 *       - dynamic `import("./foo")`
 *       - re-exports `export { x } from "./foo"`
 *       - bare `import "./foo"`
 *   * Resolves the real file on disk by trying, in order:
 *       <path>.ts, <path>.tsx, <path>/index.ts, <path>/index.tsx,
 *       <path>.mts, <path>.cts, <path>.json
 *   * Skips imports that already carry an extension that exists on disk.
 *   * Rewrites stale `.js` extensions that point at a `.ts` file (legacy
 *     pattern from the old tsx-friendly setup) to `.ts`.
 *   * Skips bare specifiers (`zod`, `@finanzas/db`, `node:fs`).
 *   * Idempotent — running twice is a no-op.
 *
 * Usage
 *   node scripts/add-ts-extensions.mjs apps/api apps/doctoralia-scraper
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTS = [".ts", ".tsx", ".mts", ".cts"];
const RESOLVE_ORDER = [".ts", ".tsx", ".mts", ".cts", "/index.ts", "/index.tsx", ".json"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".next",
  "coverage",
  "build",
  ".vite",
]);

// Match the import specifier inside the various ESM forms. The group we
// rewrite is `path`. `quote` and `prefix` round-trip so we can rebuild.
const IMPORT_RE =
  /(?<prefix>(?:^|\s|;|\(|\}|\{|=)(?:import|export)\s+(?:[^"'`]*?\s+from\s+|))(?<quote>["'])(?<path>\.{1,2}\/[^"'`]+?)\k<quote>/g;
const DYNAMIC_IMPORT_RE =
  /(?<prefix>import\s*\(\s*)(?<quote>["'])(?<path>\.{1,2}\/[^"'`]+?)\k<quote>/g;

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the real on-disk file for a relative import path. */
async function resolveReal(fromFile, importPath) {
  const fromDir = path.dirname(fromFile);
  const absBase = path.resolve(fromDir, importPath);

  // If the path already has an extension, check whether it resolves.
  const hasExtension = path.extname(importPath) !== "";
  if (hasExtension) {
    if (await exists(absBase)) {
      return importPath; // already correct
    }
    // Stale `.js` pointing at a `.ts` file (or `.jsx` → `.tsx`).
    const stem = importPath.replace(/\.(js|jsx|mjs|cjs)$/, "");
    const stemAbs = path.resolve(fromDir, stem);
    for (const candidate of RESOLVE_ORDER) {
      if (await exists(stemAbs + candidate)) {
        return stem + candidate;
      }
    }
    return null;
  }

  // No extension — probe candidates in order.
  for (const candidate of RESOLVE_ORDER) {
    if (await exists(absBase + candidate)) {
      return importPath + candidate;
    }
  }
  return null;
}

async function rewriteFile(filePath, stats) {
  const original = await readFile(filePath, "utf8");
  let changed = false;
  const rewrites = [];

  async function rewriteAll(re) {
    // We have to evaluate matches synchronously to keep replace ordering
    // stable, but resolveReal is async — so collect first, then patch.
    const matches = [];
    for (const match of original.matchAll(re)) {
      matches.push(match);
    }
    for (const match of matches) {
      const importPath = match.groups.path;
      const resolved = await resolveReal(filePath, importPath);
      if (resolved && resolved !== importPath) {
        rewrites.push({ from: importPath, to: resolved, quote: match.groups.quote });
      }
    }
  }

  await rewriteAll(IMPORT_RE);
  await rewriteAll(DYNAMIC_IMPORT_RE);

  if (rewrites.length === 0) return false;

  // Apply rewrites by literal string replacement, scoped to quoted form so
  // we can't accidentally clobber identical-looking strings elsewhere.
  let next = original;
  const seen = new Set();
  for (const { from, to, quote } of rewrites) {
    const key = `${quote}${from}${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next = next.split(`${quote}${from}${quote}`).join(`${quote}${to}${quote}`);
  }

  if (next !== original) {
    await writeFile(filePath, next, "utf8");
    stats.files += 1;
    stats.imports += rewrites.length;
    return true;
  }
  return false;
}

async function walk(dir, stats) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await Promise.all(
    entries.map(async (entry) => {
      if (SKIP_DIRS.has(entry.name)) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, stats);
      } else if (entry.isFile() && SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
        await rewriteFile(full, stats);
      }
    })
  );
}

const args = process.argv.slice(2);
if (args.length === 0) {
  const self = path.relative(process.cwd(), fileURLToPath(import.meta.url));
  console.error(`Usage: node ${self} <dir> [<dir>...]`);
  process.exit(1);
}

const stats = { files: 0, imports: 0 };
for (const target of args) {
  const abs = path.resolve(target);
  await walk(abs, stats);
}

console.log(`add-ts-extensions: rewrote ${stats.imports} import(s) across ${stats.files} file(s).`);
