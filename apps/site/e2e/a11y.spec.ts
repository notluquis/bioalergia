import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Basic axe-core a11y scan on key public routes.
 *
 * Standard: WCAG 2.2 AA plus best-practice rules (mirrors apps/intranet's
 * a11y.spec.ts tag set). This suite gates only on CRITICAL violations so it
 * stays a useful smoke signal without becoming a flaky full-conformance gate —
 * tighten to all impacts once the surface is clean.
 *
 * Run desktop-only to avoid double-scanning the same DOM per viewport project.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const ROUTES = ["/", "/aprende"] as const;

test.describe("a11y (public site)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "desktop-only scan");

  for (const route of ROUTES) {
    test(`${route} has no critical axe violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // Let the SPA shell + lazy sections settle before scanning so axe sees
      // the mounted landmarks/headings (avoids racing React).
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

      const critical = results.violations.filter((v) => v.impact === "critical");
      const summary = critical
        .map((v) => `${v.id} (${v.nodes.length} node(s)): ${v.help}`)
        .join("\n");
      expect(critical, `Critical a11y violations on ${route}:\n${summary}`).toEqual([]);
    });
  }
});
