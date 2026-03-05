import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const ROOT = path.resolve(process.cwd(), "src");
const files = await glob("**/*.{ts,tsx}", {
  absolute: true,
  cwd: ROOT,
  nodir: true,
});

/**
 * Guardrails for HeroUI v3 composition:
 * 1) Button should use onPress instead of onClick.
 * 2) Do not cast PressEvent to React.MouseEvent.
 * 3) Avoid preventDefault/stopPropagation in onPress handlers.
 */
const rules = [
  {
    id: "button-onclick",
    message: "HeroUI Button debe usar onPress (no onClick).",
    pattern: /<Button\b[\s\S]*?\bonClick=/g,
  },
  {
    id: "press-mouseevent-cast",
    message: "No castear eventos de onPress a React.MouseEvent.",
    pattern: /as\s+unknown\s+as\s+React\.MouseEvent|as\s+React\.MouseEvent/g,
  },
  {
    id: "press-prevent-default",
    message: "No usar preventDefault/stopPropagation dentro de onPress.",
    pattern: /onPress=\{[\s\S]{0,220}?(preventDefault|stopPropagation)\(/g,
  },
];

const findings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (!source.includes('@heroui/react')) {
    continue;
  }

  for (const rule of rules) {
    const matches = source.matchAll(rule.pattern);
    for (const match of matches) {
      const index = match.index ?? 0;
      const line = source.slice(0, index).split("\n").length;
      findings.push({
        file: path.relative(process.cwd(), file),
        line,
        message: rule.message,
        ruleId: rule.id,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("HeroUI composition audit failed:\n");
  for (const finding of findings) {
    console.error(
      `- [${finding.ruleId}] ${finding.file}:${finding.line} -> ${finding.message}`,
    );
  }
  process.exit(1);
}

console.log("HeroUI composition audit passed.");
