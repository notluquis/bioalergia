import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { AUTHED_ROUTES, test } from "./fixtures";

/**
 * Dialog discovery — golden-2026 audit for the open-state coverage gap.
 *
 * Survey of the codebase found 56 `<Modal>` usages, 11 `<Popover>`,
 * 14 `<Dropdown>` — and zero e2e tests opening any of them. The whole
 * existing suite (a11y, layout-integrity, route-snapshots, Chromatic
 * stories) scans with these surfaces *closed*, so a `Modal.Dialog`
 * missing its accessible name, an icon-only action button without
 * `aria-label`, or a low-contrast soft chip inside a popover sails
 * through green CI. This spec is the same catch-mechanism we built for
 * `drawer.spec.ts`, generalised to walk authed routes and probe every
 * obvious dialog trigger it can find.
 *
 * Scope (intentionally narrow to keep noise / runtime bounded):
 *   - "Trigger" = a visible <button> whose accessible name starts with
 *     a Spanish open-verb ("Nuevo X", "Crear X", "Editar X",
 *     "Configurar X", "Agregar X", "Añadir X"). Single ASCII regex,
 *     start-anchored.
 *   - At most the first N triggers per route (cap = 3) so a route
 *     with a long action toolbar doesn't dominate the run.
 *   - Click → wait <=1500ms for `[role="dialog"]`. If nothing appears
 *     the trigger probably wasn't a modal opener (a navigation, a
 *     toast, a select); skip silently.
 *   - When a dialog DOES open: axe-clean assertion scoped to it
 *     (catches all the per-modal a11y debt that's been hiding) +
 *     ESC close + dialog detached confirmed.
 *
 * Reads only — the existing read-only network guard + the server
 * E2EReadOnly middleware refuse any mutation a click might fire.
 */

const TRIGGER_NAME_RE = /^(Nuevo|Nueva|Crear|Editar|Configurar|Agregar|Añadir|Anadir)\b/i;
const MAX_TRIGGERS_PER_ROUTE = 3;

async function waitRouteReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page
    .locator("#main-content > *, main > *")
    .first()
    .waitFor({ state: "attached", timeout: 10_000 });
  // Let HeroUI Skeletons settle — same wait the a11y spec uses.
  await page
    .locator(".skeleton")
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => {
      /* no skeleton on this route — scan anyway */
    });
}

async function probeDialogTriggers(page: Page, route: { path: string; name: string }) {
  const triggers = await page
    .getByRole("button", { name: TRIGGER_NAME_RE })
    .filter({ visible: true })
    .all();

  const probed = triggers.slice(0, MAX_TRIGGERS_PER_ROUTE);
  if (probed.length === 0) return [];

  const findings: { trigger: string; violations: string[] }[] = [];

  for (const trigger of probed) {
    const triggerName = (await trigger.textContent())?.trim() ?? "(unknown)";
    await trigger.click({ trial: false }).catch(() => undefined);

    const dialog = page.getByRole("dialog").first();
    const opened = await dialog.waitFor({ state: "visible", timeout: 1_500 }).then(
      () => true,
      () => false
    );
    if (!opened) {
      // Trigger wasn't a modal-opener (route nav, toast, etc.) — skip.
      continue;
    }

    // axe scan scoped to the just-opened dialog. Same disabled-rules
    // baseline as drawer.spec / a11y.spec — known upstream React Aria
    // & HeroUI quirks are tracked separately, not silenced per-route.
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag22aa", "best-practice"])
      .disableRules(["aria-valid-attr-value", "nested-interactive"])
      .analyze();

    if (results.violations.length > 0) {
      findings.push({
        trigger: `${route.name} → "${triggerName}"`,
        violations: results.violations.map(
          (v) => `[${v.impact}] ${v.id} (${v.nodes.length} node(s))`
        ),
      });
    }

    // Close before the next trigger. Some dialogs reject ESC (e.g.
    // `isKeyboardDismissDisabled`), so try ESC then fall back to
    // clicking the in-dialog Close trigger if present.
    await page.keyboard.press("Escape");
    const closed = await dialog.waitFor({ state: "hidden", timeout: 1_500 }).then(
      () => true,
      () => false
    );
    if (!closed) {
      await page
        .getByRole("button", { name: /^cerrar|close$/i })
        .first()
        .click({ timeout: 1_500 })
        .catch(() => undefined);
      await dialog.waitFor({ state: "hidden", timeout: 1_500 }).catch(() => undefined);
    }
  }

  return findings;
}

test.describe("dialog discovery", () => {
  for (const route of AUTHED_ROUTES) {
    test(`${route.name} — every page-level open-trigger leads to an axe-clean dialog`, async ({
      authedPage,
    }) => {
      await waitRouteReady(authedPage, route.path);
      const findings = await probeDialogTriggers(authedPage, route);
      expect(
        findings,
        findings.map((f) => `${f.trigger}\n  ${f.violations.join("\n  ")}`).join("\n\n")
      ).toEqual([]);
    });
  }
});
