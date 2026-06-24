#!/usr/bin/env node
/**
 * Date/time anti-pattern lint for apps/intranet.
 *
 * The intranet is 100% dayjs-free: all date/time work goes through the native
 * helpers in `src/lib/dates.ts` (Intl + "civil-noon UTC anchor", no Temporal/
 * polyfill — Safari-safe). This guard is the tripwire that keeps it that way:
 * reintroducing `import dayjs` (and with it the bare `dayjs(x)` / `.tz()`
 * off-by-one bug class) fails the audit.
 *
 * The backend has a richer sibling (`apps/api/scripts/audit-datetime.mjs`) with
 * @db.Date/@db.Time heuristics; the frontend never reads Postgres rows directly
 * (it consumes ISO strings off the wire), so a single import rule is enough.
 *
 * Suppress an intentional one-off with `// datetime-lint-ignore: no-dayjs-import`
 * on or above the line. Wired to package.json -> "audit:datetime".
 */
import { glob, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");

// The canonical datetime module. Nothing here imports dayjs today, but keep it
// skippable so the guard never blocks the one file allowed to define helpers.
const SKIP_FILES = new Set(["src/lib/dates.ts"]);

const files = [];
for await (const entry of glob("**/*.{ts,tsx}", {
  cwd: ROOT,
  exclude: (name) => name.endsWith(".d.ts") || name.includes("routeTree.gen"),
})) {
  if (entry.endsWith(".d.ts") || entry.includes("routeTree.gen")) continue;
  files.push(path.resolve(ROOT, entry));
}

const rules = [
  {
    id: "no-dayjs-import",
    message:
      "apps/intranet is dayjs-free — use the native helpers in src/lib/dates.ts. Do not import dayjs (bare dayjs(x)/.tz() rolls @db.Date/@db.Time values a day under Santiago).",
    pattern: /\bfrom\s+["']dayjs(?:\/[^"']*)?["']|\brequire\(\s*["']dayjs(?:\/[^"']*)?["']\s*\)/g,
  },
];

function isIgnored(source, lineIndex, ruleId) {
  const lines = source.split("\n");
  const here = lines[lineIndex - 1] ?? "";
  const above = lines[lineIndex - 2] ?? "";
  const marker = `datetime-lint-ignore: ${ruleId}`;
  return here.includes(marker) || above.includes(marker);
}

const findings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const rel = path.relative(process.cwd(), file);
  if (SKIP_FILES.has(rel)) continue;

  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const line = source.slice(0, index).split("\n").length;
      if (isIgnored(source, line, rule.id)) continue;
      findings.push({ file: rel, line, message: rule.message, ruleId: rule.id });
    }
  }
}

if (findings.length > 0) {
  console.error(`Date/time audit failed (${findings.length} violations):\n`);
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
    byRule.get(f.ruleId).push(f);
  }
  for (const [ruleId, items] of byRule) {
    console.error(`[${ruleId}] ${items[0].message}`);
    for (const f of items) {
      console.error(`  ${f.file}:${f.line}`);
    }
    console.error("");
  }
  console.error(
    "Suppress one-off intentional cases with `// datetime-lint-ignore: <ruleId>` above the line."
  );
  process.exit(1);
}

console.log("Date/time audit passed (intranet is dayjs-free).");
