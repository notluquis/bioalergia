import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
// Both `plain` and `authed` are the same `test` export — it carries the
// auto-applied readOnlyGuard fixture, then `authed` adds the `authedPage`
// on top. Aliased below for readability of the two describes.
import { AUTHED_ROUTES, test as authed, test as plain } from "./fixtures";

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

/**
 * Per-route allowlist. Each entry is real backlog — track + fix one rule
 * at a time across the app, then drop from the list. Don't add new entries
 * without an issue link.
 *
 * Empty (`UNAUTHED_DISABLED_RULES`) for /login: that surface is small
 * enough to keep at zero.
 */
const UNAUTHED_DISABLED_RULES: string[] = [];

const AUTHED_DISABLED_RULES: string[] = [
  // TODO(a11y): HeroUI v3 Dropdown/Popover/Tooltip Trigger renders a
  //  button > React Aria internal button (nested-interactive). Pending
  //  upstream HeroUI fix or render-prop migration.
  //  `no-focusable-content` is the axe sub-check that fires alongside
  //  this rule but is not addressable via disableRules (internal name).
  "nested-interactive",
  // (color-contrast was previously disabled while Sidebar / MobileNav /
  //  DataTable headers / FacetedFilter were bumped one step down the
  //  contrast ramp — fix landed in 0110025b. Lifted from baseline
  //  2026-05-13; if a regression re-introduces a low-contrast pair this
  //  rule will fail authed CI again.)
  // TODO(a11y): some authed pages wrap right-side rails in <aside> inside
  //  <main>. Walk down per page (Home + Dashboard fixed in 5c11f6b7,
  //  remaining: counterparts, services, wa-cloud, finance/loans).
  //  Empirical: rule is still active in axe-core 4.11 despite an open
  //  deprecation issue (#4950 unresolved as of May 2026), so keep in
  //  baseline until the asides are lifted.
  "landmark-complementary-is-top-level",
  // TODO(a11y): authed routes lack <h1>. Each page/route should expose a
  //  level-1 heading (visually-hidden if header design forbids it).
  "page-has-heading-one",
  // TODO(a11y): mobile touch-target audit — several icon-only chips on
  //  the table rows render <44px on the iPhone viewport.
  //  `target-offset` is an axe internal check on top of target-size, not
  //  a separately-disableable rule.
  "target-size",
  // TODO(a11y): heading-order is a best-practice rule (not WCAG SC).
  //  Several feature pages skip h1→h3/h4 because the visually-hidden h1
  //  comes from RouteHeading. Walk down per page (Home: fixed; cash-flow:
  //  h3+h4 with no h2; clinical-records: h2 inside h3 wrapper). Drop
  //  this entry once all routes start at h2 directly under the sr-only h1.
  "heading-order",
  // HeroUI v3 Tabs (React Aria) generates aria-controls IDs containing
  //  `_r_<base36>_` — axe-core 4.11 regex rejects the leading underscore.
  //  This is a React-Aria upstream id-generator quirk (issue #5112,
  //  patched on @react-aria/utils 4.x main but not yet released in the
  //  HeroUI v3 dependency range). Drop once HeroUI bumps the dep.
  "aria-valid-attr-value",
  // (aria-prohibited-attr previously listed because HeroUI v3 Spinner
  //  rendered <span aria-label> with no role; resolved by routing every
  //  loading indicator through @/components/ui/LoadingSpinner which wraps
  //  HeroUI's Spinner in a role="status" aria-live region. If a regression
  //  re-adds <Spinner aria-label> directly, this rule will fire again.)
];

plain.describe("a11y / unauthenticated", () => {
  plain("login page is WCAG 2.2 AA clean", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    // Wait for the SPA shell to mount before axe runs — otherwise the scan
    // races React and intermittently fails `landmark-one-main` /
    // `page-has-heading-one` against a bare <html>.
    await page.waitForLoadState("load");
    await page.locator("form, #main-content, main").first().waitFor({
      state: "attached",
      timeout: 10_000,
    });
    const results = await new AxeBuilder({ page })
      .withTags(TAGS)
      .disableRules(UNAUTHED_DISABLED_RULES)
      .analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

authed.describe("a11y / authenticated", () => {
  for (const route of AUTHED_ROUTES) {
    authed(`${route.name} (${route.path}) is WCAG 2.2 AA clean`, async ({ authedPage }) => {
      await authedPage.goto(route.path, { waitUntil: "domcontentloaded" });
      // Production pages keep open SSE / polling channels, so networkidle
      // never resolves (Playwright issue #22897 — networkidle is officially
      // discouraged). Wait for `load` + a real readiness signal: the main
      // landmark must contain at least one child rendered by React. No
      // arbitrary sleeps.
      await authedPage.waitForLoadState("load");
      await authedPage
        .locator("#main-content > *, main > *, [role='main'] > *")
        .first()
        .waitFor({ state: "attached", timeout: 10_000 });
      // Let loading skeletons settle before scanning. HeroUI's <Skeleton>
      // renders placeholder cells with no text — axe flags them
      // (`empty-table-header`) if it scans mid-load. Wait for the first
      // skeleton to detach; tolerate routes that render none.
      await authedPage
        .locator(".skeleton")
        .first()
        .waitFor({ state: "detached", timeout: 10_000 })
        .catch(() => {
          /* no skeleton on this route, or it never cleared — scan anyway */
        });
      const results = await new AxeBuilder({ page: authedPage })
        .withTags(TAGS)
        .disableRules(AUTHED_DISABLED_RULES)
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
