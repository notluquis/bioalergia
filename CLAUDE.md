# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Medical clinic management system (Bioalergia) — monorepo with pnpm workspaces, Turborepo orchestration.

## Commands

```bash
# Development
pnpm dev                    # Start all apps in dev mode
pnpm -F @finanzas/api dev   # API only (port 3000, Node 26 native --watch)
pnpm -F @finanzas/intranet dev  # Frontend only (port 5173, Vite)

# Build
pnpm build                  # Full monorepo build (turbo)

# Lint & Format
pnpm lint                   # oxlint (Rust-based, NOT eslint)
pnpm lint:fix               # oxlint --fix
pnpm format                 # oxfmt (Rust-based, NOT prettier)
pnpm format:check           # oxfmt --check
pnpm type-check             # tsgo (TS 7 native, NOT tsc) across workspace
pnpm -F @finanzas/api lint:type-aware  # oxlint + tsgolint (type-aware rules, ~3.5s)
pnpm check                  # lint + type-check combined

# Tests
pnpm test                   # vitest across all packages
pnpm -F @finanzas/api test  # API tests only
pnpm -F @finanzas/intranet test  # Intranet tests only
# Single test file: cd apps/api && pnpm vitest run src/path/to/file.test.ts

# Database (run from packages/db)
cd packages/db
pnpm generate               # Regenerate types from .zmodel (zen generate --lite)
pnpm db:push                # Push schema to DB
pnpm migrate:dev            # Create new migration
pnpm migrate:deploy         # Apply pending migrations
```

## Architecture

### Monorepo Structure

- `apps/api` — Hono v4 backend (Node.js, Node 26 native TS runtime (type-stripping), port 3000)
- `apps/intranet` — React 19 + Vite 8 SPA (TanStack Router, port 5173)
- `apps/site` — Public marketing site
- `apps/doctoralia-scraper` — External data scraper
- `apps/local-mail-agent` — Email processing daemon
- `packages/db` — ZenStack schema + Kysely ORM layer (PostgreSQL)
- `packages/orpc-contracts` — Shared oRPC contract definitions (Zod v4 schemas)

### Backend (apps/api)

- **Framework:** Hono (NOT Express)
- **ORM:** ZenStack v3 — schema in `packages/db/zenstack/schema.zmodel` (NOT Prisma directly)
- **Query builder:** Kysely for complex SQL
- **RPC:** oRPC with contract-first design. Router files in `apps/api/src/orpc/`
- **Auth:** PASETO tokens, argon2 passwords, WebAuthn/TOTP MFA
- **Modules:** Domain logic in `apps/api/src/modules/` (calendar, certificates, haulmer, patients)

### Frontend (apps/intranet)

- **UI Library:** HeroUI v3 (compound components pattern, React Aria-based)
- **Routing:** TanStack Router with file-based routes in `src/routes/`
- **State:** TanStack Query for server state, oRPC client for API calls
- **Styling:** Tailwind CSS v4
- **Forms:** HeroUI Form with `validationBehavior="aria"`, Zod validation
- **i18n:** i18next (Spanish)
- **Features:** Organized by domain in `src/features/`

### Shared Contracts

- `packages/orpc-contracts` defines typed API contracts shared between API and intranet
- Import paths: `@finanzas/orpc-contracts/auth`, `@finanzas/orpc-contracts/patients`, etc.
- DB types: `@finanzas/db`, `@finanzas/db/schema`, `@finanzas/db/hooks`

## Key Conventions

### oRPC Router Ordering

Method order matters at runtime: always `.prefix()` before `.router()`:

```typescript
// CORRECT
export const fooORPCRouter = base.prefix("/api/orpc/foo").router(fooRouterBase);
// WRONG — runtime error: "prefix is not a function"
export const fooORPCRouter = base.router(fooRouterBase).prefix("/api/orpc/foo");
```

### Database Schema

- Edit ONLY `packages/db/zenstack/schema.zmodel` — never edit generated Prisma files
- Never use `npx prisma` commands — use `zen` CLI via package scripts
- Access policies defined in `.zmodel` with `@@allow`/`@@deny`

### Type Safety

- `any` is banned globally (oxlint `typescript/no-explicit-any: "error"`)
- Use `unknown` + type guards instead
- No `@prisma/client` imports — use `@finanzas/db` exports

### Frontend Patterns

- All UI components: HeroUI v3 compound components (Card.Header, Card.Content, etc.)
- Date handling: `@internationalized/date` + dayjs (es locale)
- Never use native HTML date inputs — use HeroUI DateField/DateRangePicker
- Forms use `<Form validationBehavior="aria">` from HeroUI
- Confirmation dialogs: NEVER use `window.confirm/alert/prompt`. Use `confirmAction()` from `@/components/ui/ConfirmDialog` (returns `Promise<boolean>`; supports `variant: "danger"`, `requireText` for NHS-style typed confirms, custom labels). Enforced by `scripts/audit-design-tokens.mjs` rule `native-confirm` — CI blocks on violations.
- Loading skeletons inside semantic elements (`<h*>`, table `rowheader` cells) need explicit a11y or axe flags them: wrap parent with `aria-busy="true"` + `aria-label="Cargando…"`, mark skeleton `aria-hidden="true"`. See `DataTable.tsx` + `MercadoPagoSettingsPage.tsx` for canonical pattern.

### Tooling

- Package manager: pnpm (NOT npm/yarn)
- Node.js >= 26 required (native TS type-stripping is stable; no `--experimental-strip-types` flag needed)
- Type-check: **tsgo** (TS 7 native preview), NOT `tsc`. Composite refs use `tsc --build` for the orchestration graph until `tsgo --build` reaches GA (target July 2026).
- Pre-commit: husky + lint-staged (oxlint --fix + oxfmt)
- `routeTree.gen.ts` is auto-generated by TanStack Router plugin — never edit

## Type-check architecture (post-Phase 3 perf migration)

`apps/api` uses **project references + composite tsconfigs per layer** to keep `app.ts` type-check at ~2s wall (was >180s hung pre-migration). Layout:

```
apps/api/
  tsconfig.json                  # top-level: references the 4 composites below
  src/utils/tsconfig.json        # composite leaf — no internal deps
  src/lib/tsconfig.json          # composite — references utils
  src/modules/tsconfig.json      # composite — references lib + utils
  src/services/tsconfig.json     # composite — references lib + modules + utils
```

DAG strict: `lib → modules → services → orpc/routes → app.ts`. Upper tier can import from any lower tier, NEVER the reverse. Audit at `/tmp/api-dag-audit.md` if it exists (regen by re-running Phase 1 agent).

**`isolatedDeclarations: true`** enabled on utils + lib (hygiene gate, parallel `.d.ts` emit). **Intentionally NOT** on modules + services — their exports include ZenStack helpers whose deeply-inferred return types are effectively unutterable as explicit annotations, and forcing them would inflate the union surface tsgo has to materialize (net-negative for the perf cliff Phase 3 fixed). Revisit when ZenStack v4 ships flatter generated types.

## ZenStack v3.7 type patterns (golden 2026)

### `mode: "insensitive"` literal widening

When `mode: "insensitive"` appears inside an array literal pushed to `WhereInput[]` (or any `OR: [...]`/`AND: [...]` array), TS widens it to `string`. `StringFilter.mode` expects the literal union `"default" | "insensitive"`, so assignment fails. Use `as const`:

```typescript
where.OR = [
  { name: { contains: q, mode: "insensitive" as const } },  // ✅
  { rut:  { contains: q, mode: "insensitive" as const } },  // ✅
];
```

This is the canonical TS 3.4+ literal-preservation idiom — ZenStack v3's own type tests use the same pattern; **not** a hotfix. `WhereInput` is **NOT** wrapped in XOR; only `CreateInput`/`UpdateInput` are (post PR #2627).

### Service helper type aliases

Don't:
```typescript
type RoleCreateInput = NonNullable<RoleCreateArgs["data"]>;
export async function createRole(data: RoleCreateInput) {
  return db.role.create({ data });  // ❌ TS2322 — XOR can't be re-narrowed
}
```

Do:
```typescript
import type { RoleUncheckedCreateInput } from "@finanzas/db/input";
export async function createRole(data: RoleUncheckedCreateInput) {
  return db.role.create({ data });  // ✅
}
```

`@finanzas/db/input` already exports `XUncheckedCreateInput` + `XCheckedCreateInput` per model. Pick the branch you actually use (Unchecked = FK fields, what 99% of API code does). Don't recreate aliases via `NonNullable<Args["data"]>`.

### Don't unwrap relation type with `[number]` ad-hoc — use the pattern consistently

For callback params on ZenStack `findMany().map(...)` chains where TS can't infer:

```typescript
const items = await db.x.findMany({ include: { y: true } });
items.map((it: (typeof items)[number]) => it.y.foo);
```

`(typeof X)[number]` is the canonical TS 3.1+ array-element-type extraction. Used by ZenStack's own examples + Prisma docs + cal.com/dub.co. Cosmetic alias `type ArrayElement<T> = T extends readonly (infer U)[] ? U : never` is optional.

## Test mocks (vitest)

When mocking `@finanzas/db`, ALSO mock `@finanzas/db/slices` if any imported service transitively uses the sliced client (the `dbClinicalSeries` export). Slices call `db.$setOptions(...)` at module-load time; if the main mock is `{}` without `$setOptions`, all tests in the file fail at import with `TypeError: db.$setOptions is not a function`.

`vi.mock` factories are HOISTED above all `const` declarations. Either keep state inside the factory or use `vi.hoisted`:

```typescript
const { mockDb } = vi.hoisted(() => {
  const mockDb = { x: { findMany: vi.fn() } };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
```

## Build vs runtime separation

`apps/api` `build` script is a **no-op** — Railway runs `.ts` source directly via Node 26 native type-stripping. Build pipeline:

| Task | Tool | Notes |
|---|---|---|
| Build (Railway) | none (no-op) | `.ts` source ships; Node strips at load |
| Dev watch | `node --watch --enable-source-maps src/index.ts` | NOT tsx |
| Type-check | `tsgo --noEmit -p apps/api/tsconfig.json` | uses composite refs |
| Composite rebuild | `tsc --build apps/api/src/{utils,lib,modules,services}/tsconfig.json` | until tsgo --build GAs |
| Lint (fast) | `oxlint` | non-type-aware, ~150ms |
| Lint (CI/type-aware) | `oxlint --type-aware` (`pnpm -F @finanzas/api lint:type-aware`) | ~3.5s on api alone, slower on intranet |
| Format | `oxfmt` | NOT prettier |
| Tests | `vitest` (NOT vitest --transform) | Node 26 native TS |

**Avoid**: `tsx`, `tsc` (use `tsgo`), Node `<26`, decorators / enums / namespaces (Node 26 strip-types rejects them; `--experimental-transform-types` was removed).

## ZenStack runtime gotcha — `db.$setOptions`

`packages/db/src/slices.ts` calls `db.$setOptions(...)` at module-load to produce sliced ZenStack clients (e.g. `dbClinicalSeries`). The method exists on `ZenStackClient` instances but NOT on `ZenStackClient.prototype` — calling it on a partial mock (`{}`) crashes immediately. See "Test mocks" above for the mock pattern.

## Session perf history (informational)

The current type-check setup is the result of a 6-phase migration. Highlights:

- **Phase 1 (audit)**: 279 ts files, 766 internal edges, 3 cycles, 74 upward DAG violations.
- **Phase 2 (DAG cleanup)**: moved auth/config/authz/schedulers to correct tier; broke cycles; ended with 0 cycles + 0 upward edges.
- **Phase 3 (composite tsconfigs)**: 4 composites + project references. `app.ts` type-check **>180s → 2s wall** (-99%).
- **Phase 4 (isolatedDeclarations on utils + lib)**: hygiene gate; ~95 annotations added; ~24 files touched.
- **Phase 5 (XOR upstream cleanup)**: reverted local `pnpm patch` on `@zenstackhq/orm@3.7`; fixed `mode` literals with `as const`. Aligned with ZenStack v3.7 upstream intent.

Don't re-introduce the XOR pnpm patch — composite refs are what actually fix the cliff. Don't re-disable composite tsconfigs.
