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
    pattern: /<Button\b[^>]*?\bonClick=/g,
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

function findMatchingRootEnd(source, kind, start) {
  const tagPattern = new RegExp(
    `</?${kind}\\b[^>]*>|<${kind}\\.[A-Z][^>]*>|</${kind}\\.[A-Z][^>]*>`,
    "g"
  );
  tagPattern.lastIndex = start;

  let depth = 0;
  let match;
  while ((match = tagPattern.exec(source))) {
    const tag = match[0];
    if (tag.startsWith(`<${kind}`) && !tag.startsWith(`<${kind}.`) && !tag.endsWith("/>")) {
      depth += 1;
    } else if (tag.startsWith(`</${kind}`) && !tag.startsWith(`</${kind}.`)) {
      depth -= 1;
      if (depth === 0) {
        return tagPattern.lastIndex;
      }
    }
  }

  return -1;
}

function hasControlOutsideContent(block, kind) {
  if (!block.includes(`<${kind}.Control`)) {
    return false;
  }

  const controlStart = block.indexOf(`<${kind}.Control`);
  const contentStart = block.indexOf(`<${kind}.Content`);
  const contentEnd = block.indexOf(`</${kind}.Content>`);

  return !(contentStart >= 0 && controlStart > contentStart && controlStart < contentEnd);
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (!source.includes("@heroui/react")) {
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

  for (const kind of ["Checkbox", "Switch"]) {
    const rootPattern = new RegExp(`<${kind}\\b`, "g");
    let match;
    while ((match = rootPattern.exec(source))) {
      const end = findMatchingRootEnd(source, kind, match.index);
      if (end < 0) {
        continue;
      }

      if (hasControlOutsideContent(source.slice(match.index, end), kind)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          line: source.slice(0, match.index).split("\n").length,
          message: `${kind}.Control debe vivir dentro de ${kind}.Content en HeroUI v3.2+.`,
          ruleId: `${kind.toLowerCase()}-control-content`,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("HeroUI composition audit failed:\n");
  for (const finding of findings) {
    console.error(`- [${finding.ruleId}] ${finding.file}:${finding.line} -> ${finding.message}`);
  }
  process.exit(1);
}

console.log("HeroUI composition audit passed.");
