import { expect } from "@playwright/test";
import { AUTHED_ROUTES, test as authed } from "./fixtures";

/**
 * Layout integrity guard — the cheapest, most deterministic UX regression
 * net we have. Runs on every authed route × every viewport project
 * (mobile / tablet / desktop).
 *
 * Why this spec exists: axe (a11y) checks WCAG semantics — roles, labels,
 * contrast — and is blind to layout. A `<textarea>` squeezed to 12px wide
 * (one glyph per line) still has a correct role + label, so axe passes it.
 * Chromatic tests components in isolation at a fixed canvas size, so it
 * never sees the real header + footer + data composition that produces
 * horizontal bleed. jsdom unit tests have no layout engine at all. None of
 * those would catch a breadcrumb bleeding off-screen or a flex child
 * collapsing — the failures in the May-2026 mobile screenshots.
 *
 * Three checks, ordered cheapest-first:
 *
 *  1. Document overflow (HARD). `scrollWidth <= clientWidth`. The single
 *     highest-ROI mobile check — almost always a missing `min-w-0` in a
 *     flex row or a fixed-width child shipped without an `overflow-x-auto`
 *     wrapper. On failure we attach the widest offending elements so the
 *     report points straight at the culprit.
 *
 *  2. Collapsed inputs (HARD). Any visible text-bearing input / textarea /
 *     contenteditable narrower than 24px. Catches the "vertical text"
 *     flex-collapse bug where a `flex-1` field with no `min-w-0` is crushed
 *     to ~1ch and the browser stacks glyphs vertically. Checkboxes / radios
 *     are excluded — they are legitimately small.
 *
 *  3. Viewport bleed (SOFT, advisory). Visible elements whose right edge
 *     extends past the viewport. Unlike check (1) this fires even when an
 *     ancestor `overflow-x: hidden` clips the bleed so the document never
 *     actually scrolls — the exact breadcrumb-clipped-off-screen failure
 *     from the May-2026 screenshots.
 *
 *  4. Silent text clipping (SOFT, advisory). Leaf elements whose content
 *     overflows their box without `text-overflow: ellipsis` or a scroll
 *     container. Soft because intentional clips exist; the report is a
 *     prompt to add `truncate` + a `title`, not a hard gate (yet).
 *
 * Visually-hidden elements (the `.sr-only` pattern: 1×1px clipped boxes)
 * are excluded from (3) and (4) — clipping is the whole point of sr-only.
 *
 * Extra routes beyond AUTHED_ROUTES are listed locally so a11y.spec's
 * route set stays focused; layout coverage is wider on purpose.
 */
const ROUTES: { path: string; name: string }[] = [
  ...AUTHED_ROUTES,
  { path: "/operations/shipments", name: "operations-shipments" },
  { path: "/operations/inventory", name: "operations-inventory" },
  { path: "/finanzas", name: "finanzas-overview" },
];

async function waitForRouteReady(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Production routes keep SSE / polling channels open, so `networkidle`
  // never resolves (Playwright #22897). Wait for `load` + a real React
  // child inside the main landmark — same readiness signal as a11y.spec.
  await page.waitForLoadState("load");
  await page
    .locator("#main-content > *, main > *, [role='main'] > *")
    .first()
    .waitFor({ state: "attached", timeout: 10_000 });
  // One rAF so HeroUI / React Aria portals settle before measuring.
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
}

authed.describe("layout integrity", () => {
  for (const route of ROUTES) {
    authed(
      `${route.name} (${route.path}) — no horizontal overflow`,
      async ({ authedPage }, testInfo) => {
        await waitForRouteReady(authedPage, route.path);

        const report = await authedPage.evaluate(() => {
          const doc = document.documentElement;
          const vw = doc.clientWidth;

          const describe = (el: Element) => {
            const cls =
              typeof el.className === "string" && el.className
                ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
                : "";
            return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}`;
          };

          // A 1×1px clipped box is the `.sr-only` visually-hidden pattern —
          // its content is *meant* to overflow. Never flag it.
          const isVisuallyHidden = (el: HTMLElement) => el.clientWidth <= 1 || el.clientHeight <= 1;

          // An element wide enough to exceed the viewport is fine if some
          // ancestor scrolls horizontally — that's an intentional scroll
          // region (e.g. a data table inside `overflow-x: auto`), not a
          // layout break. Only *uncontained* bleed is a bug.
          const isInsideHorizontalScroller = (el: HTMLElement) => {
            let node = el.parentElement;
            while (node && node !== document.body) {
              const ox = getComputedStyle(node).overflowX;
              if (ox === "auto" || ox === "scroll") return true;
              node = node.parentElement;
            }
            return false;
          };

          const all = Array.from(document.body.querySelectorAll<HTMLElement>("*"));

          // (1)/(3) elements bleeding past the viewport. Doubles as the
          // diagnostic for the document-overflow assertion AND as its own
          // soft check (catches bleed an ancestor `overflow:hidden` clips).
          const bleed: { sel: string; right: number }[] = [];
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (isVisuallyHidden(el)) continue;
            if (isInsideHorizontalScroller(el)) continue;
            if (rect.right > vw + 2)
              bleed.push({ sel: describe(el), right: Math.round(rect.right) });
          }
          bleed.sort((a, b) => b.right - a.right);

          // (2) visible text-entry controls collapsed below a legible width.
          // Excludes controls that are legitimately tiny: checkboxes / radios
          // and React-Aria date/number segments (`role="spinbutton"`, each
          // segment holds ~2ch like "DD" or "MM").
          const collapsed: string[] = [];
          const controls = document.querySelectorAll<HTMLElement>(
            "input, textarea, [contenteditable='true']"
          );
          for (const el of Array.from(controls)) {
            if (el instanceof HTMLInputElement) {
              if (["hidden", "checkbox", "radio", "range", "color"].includes(el.type)) continue;
            }
            if (el.getAttribute("role") === "spinbutton") continue;
            const rect = el.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            if (visible && el.clientWidth < 24) {
              collapsed.push(`${describe(el)} (clientWidth ${Math.round(el.clientWidth)}px)`);
            }
          }

          // (4) leaf elements clipping their own text with no ellipsis and no
          // scroll affordance. Advisory only.
          const clipped: string[] = [];
          for (const el of all) {
            if (el.childElementCount > 0) continue; // leaf only
            if (!el.textContent || el.textContent.trim().length === 0) continue;
            if (isVisuallyHidden(el)) continue;
            if (el.scrollWidth <= el.clientWidth + 1) continue;
            const cs = getComputedStyle(el);
            if (cs.textOverflow === "ellipsis") continue;
            if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
            clipped.push(
              `${describe(el)} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`
            );
          }

          return {
            vw,
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            bleed: bleed.slice(0, 8),
            collapsed,
            clipped: clipped.slice(0, 12),
          };
        });

        // (1) HARD — document must not scroll horizontally.
        expect(
          report.scrollWidth,
          `${route.path}: page scrolls horizontally — scrollWidth ${report.scrollWidth} > ` +
            `clientWidth ${report.clientWidth}. Widest offenders:\n` +
            report.bleed.map((b) => `  ${b.sel} → right ${b.right}px (vw ${report.vw})`).join("\n")
        ).toBeLessThanOrEqual(report.clientWidth);

        // (2) HARD — no collapsed form controls.
        expect(
          report.collapsed,
          `${route.path}: form control(s) collapsed below 24px — likely a flex ` +
            `child missing \`min-w-0\`:\n  ${report.collapsed.join("\n  ")}`
        ).toEqual([]);

        // (3) ADVISORY — viewport bleed (fires even when an ancestor clips
        // it). Emitted as a test annotation, not an assertion: it never
        // turns CI red, but every offender is visible in the HTML report.
        // Promote to a hard assertion once the per-route backlog is clean.
        if (report.bleed.length > 0) {
          testInfo.annotations.push({
            type: "layout-bleed",
            description:
              `${route.path} (vw ${report.vw}): ` +
              report.bleed.map((b) => `${b.sel} → ${b.right}px`).join("; "),
          });
        }

        // (4) ADVISORY — silent text clipping (leaf elements, no ellipsis /
        // scroll affordance). Same advisory treatment as (3).
        if (report.clipped.length > 0) {
          testInfo.annotations.push({
            type: "layout-text-clip",
            description: `${route.path}: ${report.clipped.join("; ")}`,
          });
        }
      }
    );
  }
});
