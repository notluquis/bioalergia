#!/usr/bin/env node
/**
 * Design-token + UX anti-pattern lint.
 *
 * Catches drift away from the 2026 audit baselines:
 *  - hardcoded hex colors (use OKLCH theme tokens / chart palette)
 *  - native window.confirm/alert/prompt (use ConfirmDialog)
 *  - native <input type="date|time|datetime-local"> (use AppDatePicker)
 *  - body text below 12px (text-[10px], text-[11px] outside .text-caption)
 *  - bg-white outside QR/email allowlist (use bg-content1)
 *  - Card.Heading (does not exist in HeroUI v3 — use Card.Title)
 *
 * Allowlists live below; extend with an inline `// design-lint-ignore: <ruleId>`
 * comment on the offending line when an exception is intentional.
 *
 * Runs over apps/intranet/src by default. Exits non-zero with a grouped report
 * when violations remain. Wired to package.json -> "audit:design".
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const ROOT = path.resolve(process.cwd(), "src");
const files = await glob("**/*.{ts,tsx}", {
  absolute: true,
  cwd: ROOT,
  nodir: true,
  ignore: ["**/*.test.{ts,tsx}", "**/__tests__/**", "**/*.stories.tsx"],
});

const HEX_ALLOWLIST_PATHS = new Set([
  // QR codes need solid white for camera readability.
  "src/pages/onboarding/components/MfaStep.tsx",
  "src/pages/AccountSettingsPage.tsx",
  // Canvas QR fillStyle.
  "src/features/wa-cloud/components/PhoneToolsModal.tsx",
  // User-typed color picker defaults; values live in DB.
  "src/features/finance/pages/CashFlowPage.tsx",
  // Calendar event color palette comes from Google Calendar API ids; semantic.
  "src/features/calendar/components/WeekGrid.tsx",
]);

const BG_WHITE_ALLOWLIST_PATHS = new Set([
  "src/pages/onboarding/components/MfaStep.tsx",
  "src/pages/AccountSettingsPage.tsx",
  "src/features/hr/timesheets/components/EmailPreviewModal.tsx",
]);

const rules = [
  {
    id: "hardcoded-hex",
    message: "Hardcoded hex color. Use OKLCH theme tokens or useChartPalette().",
    pattern: /#[0-9A-Fa-f]{6}\b/g,
    skipFile: (rel) => HEX_ALLOWLIST_PATHS.has(rel),
  },
  {
    id: "native-confirm",
    message: "Use confirmAction() from @/components/ui/ConfirmDialog instead of window.confirm/alert/prompt.",
    pattern: /(?:^|[^.\w])(?:confirm|alert|prompt)\s*\(\s*["'`]/g,
  },
  {
    id: "native-date-input",
    message: 'Use <AppDatePicker /> or <AppDateTimePicker /> from @/components/forms/AppDatePicker — no native <input type="date|time|datetime-local">.',
    pattern: /type=["'](?:date|time|datetime-local)["']/g,
  },
  {
    id: "small-text",
    message: 'Body text must be ≥12px. Use text-xs or .text-caption (uppercase tracked labels).',
    pattern: /text-\[(?:10|11)px\]/g,
  },
  {
    id: "bg-white",
    message: "bg-white leaks light theme into dark mode. Use bg-content1 instead (or add file to BG_WHITE_ALLOWLIST_PATHS if rendering external content).",
    pattern: /\bbg-white\b/g,
    skipFile: (rel) => BG_WHITE_ALLOWLIST_PATHS.has(rel),
  },
  {
    id: "heroui-v3-card-heading",
    message: "Card.Heading does not exist in HeroUI v3. Use Card.Title.",
    pattern: /<Card\.Heading\b/g,
  },
];

function isIgnored(source, lineIndex, ruleId) {
  const lines = source.split("\n");
  const here = lines[lineIndex - 1] ?? "";
  const above = lines[lineIndex - 2] ?? "";
  const marker = `design-lint-ignore: ${ruleId}`;
  return here.includes(marker) || above.includes(marker);
}

function fileLevelIgnores(source) {
  const ignored = new Set();
  // Accept "// design-lint-ignore-file: rule[,rule2...]" anywhere in first 30 lines.
  const head = source.split("\n").slice(0, 30).join("\n");
  for (const m of head.matchAll(/design-lint-ignore-file:\s*([\w,\s-]+)/g)) {
    for (const id of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      ignored.add(id);
    }
  }
  return ignored;
}

function isInBlockComment(source, index) {
  // Cheap check: count unmatched /* ... */ openings before this index.
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
  const fileIgnores = fileLevelIgnores(source);

  for (const rule of rules) {
    if (rule.skipFile?.(rel)) continue;
    if (fileIgnores.has(rule.id)) continue;
    for (const match of source.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      if (isInBlockComment(source, index)) continue;
      const line = source.slice(0, index).split("\n").length;
      if (isIgnored(source, line, rule.id)) continue;
      findings.push({ file: rel, line, message: rule.message, ruleId: rule.id });
    }
  }
}

if (findings.length > 0) {
  console.error(`Design-token audit failed (${findings.length} violations):\n`);
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
  console.error('Suppress one-off intentional cases with `// design-lint-ignore: <ruleId>` above the line.');
  process.exit(1);
}

console.log("Design-token audit passed.");
