import { AxeBuilder } from "@axe-core/playwright";
import { test as plain, expect } from "@playwright/test";
import { AUTHED_ROUTES, test as authed } from "./fixtures";

/**
 * Axe-core a11y scan on critical routes.
 *
 * Standard: WCAG 2.2 AA (`wcag22aa`) plus best-practice rules. Failing a
 * violation surfaces full node + selector + impact in the HTML report.
 *
 * Allowlist (`disableRules`) is empty by design — add a rule id with a
 * justification + tracking ticket if a known false-positive needs to be
 * silenced. Never silence by category.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const DISABLED_RULES: string[] = [
  // Example: "color-contrast", // tracked in #LIN-1234
];

plain.describe("a11y / unauthenticated", () => {
  plain("login page is WCAG 2.2 AA clean", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(TAGS)
      .disableRules(DISABLED_RULES)
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

authed.describe("a11y / authenticated", () => {
  for (const route of AUTHED_ROUTES) {
    authed(`${route.name} (${route.path}) is WCAG 2.2 AA clean`, async ({ authedPage }) => {
      await authedPage.goto(route.path);
      // Wait for any Suspense fallback to finish before scanning.
      await authedPage.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page: authedPage })
        .withTags(TAGS)
        .disableRules(DISABLED_RULES)
        .analyze();
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  }
});

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]
): string {
  if (violations.length === 0) return "";
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 5)
        .map((n) => `    - ${n.target.join(" ")}: ${n.failureSummary}`)
        .join("\n");
      return `[${v.impact ?? "?"}] ${v.id} — ${v.help}\n  ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}
