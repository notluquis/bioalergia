import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * Mobile drawer specs — covers the surface that the rest of the e2e
 * suite is *blind to* because the drawer is hidden by default. axe,
 * layout-integrity, route-snapshots and Chromatic stories all scan
 * with the drawer closed, so a `Drawer.Dialog` missing its accessible
 * name, a phantom-second-panel from styling the wrong element, or
 * a button without an aria-label inside the drawer all sail through
 * green CI. This spec opens the drawer first, then asserts.
 *
 * Scoped to the `mobile` Playwright project (the drawer is
 * `md:hidden` — the desktop shell renders the persistent rail
 * instead, no drawer to test).
 */

test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "drawer is mobile-only (md:hidden)");

test.describe("mobile drawer", () => {
  test("opens, has accessible name, axe-clean, ESC closes", async ({ authedPage }) => {
    await authedPage.goto("/", { waitUntil: "domcontentloaded" });
    await authedPage.waitForLoadState("load");
    await authedPage
      .locator("#main-content > *, main > *")
      .first()
      .waitFor({ state: "attached", timeout: 10_000 });

    // (1) open via the in-Header toggle (the canonical hamburger entry).
    const toggle = authedPage.locator("#mobile-menu-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();

    // (2) the dialog is rendered + reachable to AT.
    const dialog = authedPage.getByRole("dialog", { name: /navegación principal/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // (3) axe scan scoped to the drawer surface — catches missing
    // dialog name, button-name, contrast and ARIA issues that the
    // outer-page scans never see.
    const results = await new AxeBuilder({ page: authedPage })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag22aa", "best-practice"])
      .disableRules([
        // React Aria's id generator emits `_r_<base36>_` ids that axe-core
        // 4.11 still rejects — same upstream quirk allowlisted in
        // a11y.spec.ts (HeroUI v3 dependency range).
        "aria-valid-attr-value",
        // Tracked separately on the outer pages — the Dropdown trigger
        // at the bottom of the drawer (user pill) wraps a button.
        "nested-interactive",
      ])
      .analyze();
    expect(
      results.violations,
      results.violations
        .map((v) => `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`)
        .join("\n")
    ).toEqual([]);

    // (4) close button exists + works (Drawer.CloseTrigger).
    const closeBtn = authedPage.getByRole("button", { name: "Cerrar menú", exact: true });
    await expect(closeBtn).toBeVisible();

    // (5) ESC closes (React Aria dialog primitive default).
    await authedPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3_000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("traps focus inside the drawer while open", async ({ authedPage }) => {
    await authedPage.goto("/", { waitUntil: "domcontentloaded" });
    await authedPage.waitForLoadState("load");
    await authedPage
      .locator("#main-content > *, main > *")
      .first()
      .waitFor({ state: "attached", timeout: 10_000 });

    await authedPage.locator("#mobile-menu-toggle").click();
    const dialog = authedPage.getByRole("dialog", { name: /navegación principal/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Tab repeatedly; every focused element must remain inside the dialog.
    // 12 tabs is well past the in-drawer focusable count (logo + nav items
    // + user pill + close button) so a leak would surface within the loop.
    for (let i = 0; i < 12; i++) {
      await authedPage.keyboard.press("Tab");
      const focusInsideDialog = await authedPage.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return dlg ? dlg.contains(document.activeElement) : false;
      });
      expect(focusInsideDialog, `focus escaped the dialog after Tab #${i + 1}`).toBe(true);
    }

    await authedPage.keyboard.press("Escape");
  });

  test("no horizontal overflow inside the drawer", async ({ authedPage }) => {
    await authedPage.goto("/", { waitUntil: "domcontentloaded" });
    await authedPage.waitForLoadState("load");
    await authedPage
      .locator("#main-content > *, main > *")
      .first()
      .waitFor({ state: "attached", timeout: 10_000 });

    await authedPage.locator("#mobile-menu-toggle").click();
    const dialog = authedPage.getByRole("dialog", { name: /navegación principal/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The drawer panel must contain its own content — no nav item bleeds
    // past the dialog's right edge. Mirrors layout-integrity's bleed
    // check, scoped to the dialog.
    const bleeders = await dialog.evaluate((dlg) => {
      const dialogRight = dlg.getBoundingClientRect().right;
      const out: string[] = [];
      for (const el of Array.from(dlg.querySelectorAll<HTMLElement>("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.clientWidth <= 1 || el.clientHeight <= 1) continue; // sr-only
        if (r.right > dialogRight + 2) {
          out.push(
            `${el.tagName.toLowerCase()} → right ${Math.round(r.right)}px (dialog ${Math.round(dialogRight)}px)`
          );
        }
      }
      return out.slice(0, 8);
    });
    expect(bleeders, bleeders.join("\n")).toEqual([]);

    await authedPage.keyboard.press("Escape");
  });
});
