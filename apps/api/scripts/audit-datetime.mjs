#!/usr/bin/env node
/**
 * Date/time anti-pattern lint for apps/api.
 *
 * Encodes the ONE mental model for Postgres date/time columns (verified
 * empirically 2026-06-05; server TZ=America/Santiago, ZenStack v3 = Kysely+pg):
 *
 *   @db.Date (1082)  -> Date at UTC midnight in BOTH ZenStack and $qb.
 *   @db.Time (1083)  -> Date @1970-01-01 UTC (ZenStack) OR "HH:MM:SS" ($qb).
 *   @db.Timestamptz  -> a real instant.
 *
 * Correct reads: dbDateToISO / dbTimeToHHmm / instantToChileDate (lib/time.ts),
 * or `.toISOString().slice(0,10)` (also UTC-safe). The bug class this guard
 * blocks: bare `dayjs(x).format("YYYY-MM-DD")` or `dayjs(<dbDateField>).tz(...)`
 * — under Santiago a UTC-anchored value rolls the calendar day back.
 *
 * LIMITS: purely lexical. It uses @db.Date/@db.Time field-name heuristics
 * (auto-extracted from the schema), so it has false negatives when a value is
 * aliased to an unrelated name and can't follow $qb column aliases. It is a
 * tripwire for the known anti-patterns, not a type checker.
 *
 * Suppress an intentional case with `// datetime-lint-ignore: <ruleId>` on or
 * above the line. Wired to package.json -> "audit:datetime".
 */
import { glob, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const SCHEMA = path.resolve(process.cwd(), "../../packages/db/zenstack/schema.zmodel");

// Files that legitimately contain the raw patterns (the canonical helpers and
// the timesheet write-path impl). Everything else must go through the helpers.
const SKIP_FILES = new Set(["src/lib/time.ts", "src/services/timesheets.ts"]);

// --- Extract @db.Date / @db.Time field names from the schema (auto-sync) -----
async function loadDbDateTimeFieldNames() {
  const schema = await readFile(SCHEMA, "utf8");
  const names = new Set();
  for (const line of schema.split("\n")) {
    if (!/@db\.(Date|Time)\b/.test(line)) continue;
    const m = line.match(/^\s*([a-z][A-Za-z0-9]*)\s+DateTime/);
    if (m) names.add(m[1]);
  }
  return [...names];
}

// Generic names that also exist as @db.Timestamptz / plain DateTime on other
// models (e.g. Transaction.date, Event.startDate) — too ambiguous for the
// name-only heuristic in rules 2/3, which would false-positive on instants.
const AMBIGUOUS = new Set([
  "date",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "dueDate",
  "paidDate",
]);

const fieldNames = await loadDbDateTimeFieldNames();
// Unambiguous @db.Date-only names for the heuristic rules.
const unambiguousFields = fieldNames.filter((n) => !AMBIGUOUS.has(n));
const fieldAlt = unambiguousFields.join("|");

const files = [];
for await (const entry of glob("**/*.ts", {
  cwd: ROOT,
  exclude: (name) => name.endsWith(".test.ts") || name === "__tests__",
})) {
  if (entry.includes("__tests__") || entry.endsWith(".test.ts")) continue;
  files.push(path.resolve(ROOT, entry));
}

const rules = [
  {
    id: "dayjs-format-date-only",
    message:
      'Bare dayjs(x).format("YYYY-MM-DD") rolls a @db.Date back a day under Santiago. Use dbDateToISO() (@db.Date) or instantToChileDate() (@db.Timestamptz) from lib/time.ts.',
    // dayjs(<@db.Date field>)<chain>.format("YYYY-MM-DD") with NEITHER .utc()
    // (correct for @db.Date) NOR .tz() — i.e. an unqualified wall-clock format
    // of a known date-only column, which rolls the day back under Santiago.
    pattern: fieldAlt
      ? new RegExp(
          `dayjs\\s*\\(\\s*[\\w.?$\\[\\]'"]*\\b(?:${fieldAlt})\\b[^)]*\\)((?:\\s*\\.\\s*\\w+\\s*\\([^)]*\\))*?)\\s*\\.\\s*format\\(\\s*["'\`]YYYY-MM-DD`,
          "g"
        )
      : /$^/g,
    rejectIf: (text) => !text.includes(".utc(") && !text.includes(".tz("),
  },
  {
    id: "dayjs-tz-suspected-date",
    message:
      "dayjs(<@db.Date field>).tz(...) is wrong — .tz() is only for @db.Timestamptz instants. Use dbDateToISO() for @db.Date.",
    pattern: fieldAlt
      ? new RegExp(
          `dayjs\\s*\\(\\s*[\\w.?$\\[\\]'"]*\\b(?:${fieldAlt})\\b[^)]*\\)\\s*\\.\\s*tz\\(`,
          "g"
        )
      : /$^/g,
  },
  {
    id: "new-date-to-dbdate",
    message:
      "Writing `new Date()` to a @db.Date field stores the UTC day (off-by-one after ~21:00 Chile). Use isoToDbDate(instantToChileDate(new Date())).",
    pattern: fieldAlt ? new RegExp(`\\b(?:${fieldAlt})\\s*:\\s*new Date\\(\\s*\\)`, "g") : /$^/g,
  },
];

function isIgnored(source, lineIndex, ruleId) {
  const lines = source.split("\n");
  const here = lines[lineIndex - 1] ?? "";
  const above = lines[lineIndex - 2] ?? "";
  const marker = `datetime-lint-ignore: ${ruleId}`;
  return here.includes(marker) || above.includes(marker);
}

function isInBlockComment(source, index) {
  const before = source.slice(0, index);
  let depth = 0;
  let i = 0;
  while (i < before.length) {
    if (before[i] === "/" && before[i + 1] === "*") {
      depth++;
      i += 2;
    } else if (before[i] === "*" && before[i + 1] === "/") {
      depth = Math.max(0, depth - 1);
      i += 2;
    } else {
      i++;
    }
  }
  return depth > 0;
}

const findings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const rel = path.relative(process.cwd(), file);
  if (SKIP_FILES.has(rel)) continue;

  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      if (rule.rejectIf && !rule.rejectIf(match[0])) continue;
      const index = match.index ?? 0;
      if (isInBlockComment(source, index)) continue;
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

console.log(`Date/time audit passed (${fieldNames.length} @db.Date/@db.Time fields tracked).`);
