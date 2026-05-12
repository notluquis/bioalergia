# Quality gates (2026 standard)

`.github/workflows/quality.yml` runs five parallel jobs on every PR and
push to `main` / `forthcoming-ocelot`. All five must stay green for merge.

| Job                 | Tool                                            | What it checks                                                                                                                                                                                                                                            | Local script                                                                           |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `design-token lint` | `apps/intranet/scripts/audit-design-tokens.mjs` | banned anti-patterns: hardcoded hex, `window.confirm/alert/prompt`, native `<input type="date                                                                                                                                                             | time                                                                                   | datetime-local">`, body text < 12 px, `bg-white`outside QR/email allowlist,`Card.Heading` (HeroUI v3 doesn't expose it) | `pnpm -F @finanzas/intranet audit:design` |
| `knip (advisory)`   | knip 6                                          | unused files, exports, deps. Advisory: exits 0 even on findings while the 71-file backlog is worked down                                                                                                                                                  | `pnpm audit:dead` (strict) / `pnpm audit:dead:advisory` (CI)                           |
| `size-limit`        | size-limit 12 + `@size-limit/file`              | per-chunk gzip budgets (initial JS, initial CSS, lazy CashFlow / ClinicalSeries / MercadoPago / wa-cloud, Recharts)                                                                                                                                       | `pnpm -F @finanzas/intranet build && pnpm -F @finanzas/intranet audit:size`            |
| `playwright + axe`  | Playwright 1.60 + `@axe-core/playwright` 4.10   | smoke (login mounts, no JS pageerror) + axe scan on `/login` plus 7 authed routes (`/`, `/patients`, `/clinical`, `/finanzas/cash-flow`, `/calendar`, `/settings/mercadopago`, `/wa-cloud`) tagged `wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, `best-practice` | `pnpm -F @finanzas/intranet audit:e2e` (sets `E2E_USER` / `E2E_PASS` to unlock authed) |
| `lighthouse-ci`     | `@lhci/cli` 0.15                                | Core Web Vitals 2026 budgets against `/login`: perf ≥ 0.85, a11y ≥ 0.95, LCP ≤ 2500 ms, TBT ≤ 200 ms (INP lab proxy), CLS ≤ 0.1, FCP ≤ 1800 ms, TTI ≤ 3500 ms, unused JS ≤ 100 KiB                                                                        | `pnpm -F @finanzas/intranet audit:perf` (needs system Chrome)                          |

Run everything locally: `pnpm audit:all`.

## Anti-pattern suppressions

`scripts/audit-design-tokens.mjs` accepts three escape hatches:

1. **Path allowlists** in the script (`HEX_ALLOWLIST_PATHS`,
   `BG_WHITE_ALLOWLIST_PATHS`) for permanently-excluded files (QR canvases,
   email iframes, user-stored DB color values).
2. **Per-line:** `// design-lint-ignore: <ruleId>` immediately above the
   offending line — for one-off intentional exceptions.
3. **Per-file:** `// design-lint-ignore-file: <ruleId>[,<ruleId>]` in the
   first 30 lines — used today for three chart-palette files
   (`features/doctoralia/analytics/types.ts`,
   `features/finance/dte-analytics/types.ts`,
   `features/finance/dte-analytics/components/DteMonthlySummaryPanel.tsx`)
   that still hardcode hex; each carries a `TODO(2026-Q3)` to migrate to
   `useChartPalette()`.

## Theme tokens

`apps/intranet/src/index.css` defines two layers:

1. **HeroUI v3 semantic anchors** — `--accent`, `--accent-foreground`,
   `--success`, `--warning`, `--danger`, `--surface`, `--surface-secondary`,
   `--surface-tertiary`, `--overlay`, `--muted`, `--border`, `--separator`.
   Lightness values verified to hit WCAG 2.2 AA 4.5:1 for normal-weight
   text on the brand color.
2. **v2-style aliases** — `--primary`, `--content1..4`, `--default-50..900`,
   `--foreground-300..800`, etc. Tailwind utilities (`text-default-400`,
   `bg-content1`, `text-foreground-500`) resolve through these.

Always use tokens. `pnpm audit:design` enforces no raw hex outside the
allowlist.

## CSP under `vite preview`

Production runs behind Caddy, which substitutes the
`{{ placeholder "http.request.uuid" }}` sentinel with a real per-request
UUID and emits a matching `Content-Security-Policy` header.
`vite preview` doesn't, so React was getting blocked.
`apps/intranet/vite.config.ts` adds a `configurePreviewServer` middleware
to:

1. Read `dist/client/index.html`.
2. Replace every `{{ placeholder "http.request.uuid" }}` with a fresh
   `randomUUID()`.
3. Set the matching CSP header
   (`script-src 'self' 'nonce-X' 'strict-dynamic' 'unsafe-inline' https:`
   plus the same style/font/img/connect rules as the Caddyfile).

Both Lighthouse CI and Playwright now drive the production bundle through
this middleware.

## Why we removed `'unsafe-hashes'`

The bundle previously shipped one inline event handler
(`<link onload="this.media='all'">` for the deferred webfont swap). That
required `'unsafe-hashes' 'sha256-MhtPZX…'` in the CSP. Per the 2026
OWASP CSP Cheat Sheet, `'unsafe-hashes'` should be a last resort; we
moved the swap into a nonced inline `<script>` that calls
`addEventListener("load", …)`, then dropped the directive.

## Known gaps vs the 2026 golden standard

Documented for future cleanup; do not reintroduce silently:

1. **No WebKit coverage.** Mobile project uses Chromium with iPhone
   viewport emulation only. Deferred to keep CI fast (WebKit binary is
   ~80 MB and adds an extra job). Re-add once WebKit-only regressions
   start mattering (text-size-adjust, form input quirks).
2. **size-limit on file globs, not `import` mode.** `@size-limit/preset-app`
   would catch tree-shaking regressions but requires entry-module sources
   and a Puppeteer runtime cycle. File globs are sufficient for the
   per-route chunk budgets we actually gate on.
3. **Lighthouse runs against `/login` only.** Authed routes need a
   cookie/header injection helper; pending an `E2E_USER` / `E2E_PASS`
   secret + Playwright-style storageState handoff into LHCI.
4. **knip is advisory.** 71 files still flagged. Walk down by feature
   before flipping `audit:dead:strict`.
5. **CrUX field data not wired.** Lab metrics (TBT) are a proxy for INP;
   field INP needs the `lighthouse-plugin-crux` plugin once we have
   enough traffic for the 28-day rolling window.

## CI Node version

Workflow uses Node 25 (matches local + Railway). `package.json` engines
field still advertises `>=26`; pnpm emits an informational `WARN
Unsupported engine` line but the workspace builds and tests cleanly.
Bump engines + CI together when comfortable upgrading Railway.

## Secrets

- `E2E_USER` / `E2E_PASS` — repo secrets used by the `playwright + axe`
  job to log in for the authed a11y matrix. Without them the auth fixture
  is `test.skip()`d (4 tests run instead of 18). Fork PRs intentionally
  cannot read these per GitHub policy; only branch pushes get the full
  matrix.
- `CHROMATIC_PROJECT_TOKEN_INTRANET` / `CHROMATIC_PROJECT_TOKEN_SITE` —
  consumed by `chromatic.yml` for visual regression on Storybook stories.
