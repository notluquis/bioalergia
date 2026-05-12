# A11y backlog (axe baseline)

Surfaced by `pnpm -F @finanzas/intranet audit:a11y` against the deployed
build. Each rule is currently in `AUTHED_DISABLED_RULES`
(`apps/intranet/e2e/a11y.spec.ts`); CI fails only on **new** violations.
Walk down the list, drop the rule from the array, push.

## Open

| Rule | Impact | Spec | Where | Owner | Tracked |
|---|---|---|---|---|---|
| `nested-interactive` + `no-focusable-content` | serious | WCAG 4.1.2 | HeroUI v3 `Dropdown.Trigger` / `Popover.Trigger` / `Tooltip.Trigger` render `<button>` containing internal React Aria button. Pending HeroUI upstream fix or wrapper. | — | — |
| `color-contrast` | serious | WCAG 1.4.3 | ~12 spots: Sidebar inactive nav text, table column headers, chip soft variants. Walk down with `--foreground-{300,400}` ramp from `index.css`. | — | — |
| `landmark-complementary-is-top-level` + `landmark-is-top-level` | moderate | WCAG 1.3.1 | `_authed.tsx` wraps right-side rail in `<aside>` inside `<main>`. Lift `<aside>` outside main landmark. | — | — |
| `page-has-heading-one` | moderate | best-practice | Authed routes lack `<h1>`. Each page should expose a level-1 heading (visually-hidden via `sr-only` if header design forbids). | — | — |
| `target-size` + `target-offset` | serious | WCAG 2.5.8 | Mobile (iPhone viewport): icon-only chips on table rows render <44px. The `.button--icon-only` global rule from `20b1d217` covers icon-only Buttons but not Chip-as-button or custom click targets. | — | — |

## Workflow

```bash
# Local diff against current baseline:
E2E_USER=… E2E_PASS=… E2E_BASE_URL=https://intranet.bioalergia.cl \
  pnpm -F @finanzas/intranet audit:a11y

# After fixing a rule across the app, drop it from AUTHED_DISABLED_RULES,
# push, watch CI flag any regression. If green, commit baseline tightening.
```
