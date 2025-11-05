## finanzas-app — Copilot / AI agent quick instructions

Short, actionable guidance so an AI agent can be productive immediately in this repo.

Read first (highest value)

- `server/db.ts` — canonical DB helpers and `upsertWithdrawals` (deterministic, chunked upsert).
- `server/routes/transactions.ts` — preview/import endpoints and the legacy compatibility wrapper (`/api/transactions/withdrawals/upload`).
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — client-side CSV preview/import flow (PapaParse ➜ /preview ➜ /import).
- `src/components/ThemeToggle.tsx`, `tailwind.config.cjs`, `src/index.css` — theming and global CSS tokens; prefer DaisyUI tokens.

How to run (short list)

- Frontend dev: `npm run dev` (Vite)
- Backend dev: `npm run server`
- Full dev (frontend + backend): `npm run dev:full`
- Build frontend: `npm run build`; server build: `npm run build:server`
- Typecheck: `npm run type-check`; Lint: `npm run lint`

Frontend vs Backend agent notes

- Frontend agent: focus on `src/` only. Prefer DaisyUI tokens (`bg-base-100`, `card`, `input input-bordered`). Use `src/components/Button.tsx` for CTA consistency. When changing visuals, run `npm run build` and check ThemeToggle (dark/light/system).
- Backend agent: focus on `server/`. Prefer reusing `upsertWithdrawals` for bulk imports. When editing DB code, run `npm run build:server` and smoke-test `POST /api/transactions/withdrawals/preview` and `/import`.

Project-specific conventions (do these)

- Use DaisyUI semantic classes; avoid hard-coded whites or hex colors. Search `bg-white` and `glass-` when migrating UI.
- Centralize CTAs via `src/components/Button.tsx` (variants: primary/secondary, sizes: xs/sm/md/lg).
- Theme: set `document.documentElement.data-theme` to `bioalergia` or `bioalergia-dark` and toggle `html.classList.dark` for dark-mode-specific Tailwind behaviors.
- DB: preserve deterministic upsert behavior: API responses must include `{ inserted, updated, skipped, total }`.

Important files & quick tour

- `server/db.ts` — upsertWithdrawals, internal config (DB overrides for chunk size)
- `server/routes/transactions.ts` — preview/import & compatibility wrapper
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — CSV parse/preview UI
- `src/index.css` — global normalizations, `.app-grid`, `.card-grid`
- `tailwind.config.cjs` — daisyUI themes and darkMode: 'class'
- `generated/` — Prisma client (do not edit)

PR checklist (UI migrations — required)

1. Make one visual page/component change per PR.
2. Replace `bg-white` / `glass-*` → `bg-base-100` / `card` / `input input-bordered` (conservative substitutions only).
3. Use `Button` wrapper for CTAs. Add screenshots (light + dark) in PR description.
4. Run: `npm run type-check && npm run lint && npm run build` and paste results in PR.
5. If you touched server routes, run `npm run build:server` and smoke-test endpoints.

Testing and verification

- Integration test for withdrawals: `npm run test:withdrawals` (set `RUN_WITHDRAWALS_IT=1` and `TEST_COOKIE`).
- For quick manual preview/import smoke-test:
  - Start backend: `npm run server`
  - Start frontend (dev): `npm run dev`
  - Use `PayoutPreviewUpload` UI to parse a CSV, call `/preview`, inspect diff, then `/import`.

Search helpers & common commands

- Find remaining legacy visuals: `grep -R "bg-white\|glass-" src | sed -n '1,120p'`
- Find legacy uploader callers: `grep -R "/api/transactions/withdrawals/upload" -n || true`
- Quick fetch of uncommitted changes: `git status --porcelain`

Safety rules (do not break)

- Do not remove `/api/transactions/withdrawals/upload` without confirming no external callers.
- Preserve the upsert return shape `{ inserted, updated, skipped, total }`.
- Avoid large single-commit visual overhauls; prefer incremental PRs with builds/screenshots.

Context7 / docs note

- If you want an internal design guide for DaisyUI tokens, add `docs/CONTEXT7.md` describing the theme tokens and example components. I can scaffold this if requested.

If you want this adjusted (more frontend/backend split, example PR templates, or an automated codemod plan), tell me which and I'll update the file or create PR scaffolding.

# Copilot / AI agent instructions for finanzas-app

Short, actionable instructions so AI coding agents are productive immediately.

1. High-level architecture (what to know first)

- Frontend: React + TypeScript + Vite (entry: `src/main.tsx`, styles in `src/index.css`). Tailwind + DaisyUI theme configured in `tailwind.config.cjs`. Theme toggle implemented in `src/components/ThemeToggle.tsx`.
- Backend: Node + Express + TypeScript under `server/`. Routes live in `server/routes/*.ts` and DB logic in `server/db.ts`. DB uses MySQL via `mysql2/promise`. Prisma client artifacts are in `generated/`.
- Data flows:
  - CSV upload flow is intentionally preview-first: client parses CSV -> POST `/api/transactions/withdrawals/preview` (preview existing withdraws) -> POST `/api/transactions/withdrawals/import` (server upsert).
  - Legacy compatibility wrapper exists: `POST /api/transactions/withdrawals/upload` (server-side parsing -> upsert) — do not remove without checking external callers.
- Key files: `server/db.ts` (upsertWithdrawals, internal config helpers), `server/routes/transactions.ts` (preview/import/compat endpoints), `src/features/transactions/components/PayoutPreviewUpload.tsx` (client CSV preview), `src/index.css` (global normalization), `tailwind.config.cjs`, `src/components/Button.tsx`, and `src/components/ThemeToggle.tsx`.

2. How to run + key developer commands

- Frontend dev: `npm run dev` (Vite)
- Backend dev: `npm run server`
- Full dev (front + back): `npm run dev:full`
- Production build: `npm run build` (frontend), `npm run build:server` (server)
- Run the integration helper test for withdrawals (local): set env `RUN_WITHDRAWALS_IT=1` and `TEST_COOKIE` and run `npm run test:withdrawals` (see `test/withdrawals.integration.test.ts`).
- Check types: `npm run type-check` (tsc --noEmit)
- Lint: `npm run lint`
- Always run `npm run build` and `npm run type-check` after substantive changes.

3. Project conventions and patterns (what an agent must follow)

- The UI uses DaisyUI semantics (prefer `bg-base-100`, `card`, `input input-bordered`, etc.) — avoid hardcoding `bg-white` or hex colors. Search for `glass-` and `bg-white` when migrating visuals.
- Use the polymorphic `Button` primitive (`src/components/Button.tsx`) instead of ad-hoc `<button>` classes; it maps our variants to DaisyUI btn classes.
- Theme toggling: prefer tokens from `tailwind.config.cjs` and `data-theme` on `document.documentElement`; avoid inline color overrides that prevent dark theme from working.
- Backend DB ops: `upsertWithdrawals` canonicalizes JSON and uses chunked INSERT ... ON DUPLICATE KEY UPDATE — prefer to reuse it for bulk imports, do not reimplement ad-hoc upsert logic.
- Admin/ops config: `BIOALERGIA_X_UPSERT_CHUNK_SIZE` env var can be overridden from DB via internal settings key `bioalergia_x.upsert_chunk_size`. See `server/routes/settings.ts` and `server/db.ts`.

4. Files to read first (quick tour paths)

- `server/db.ts` — canonical upsert logic and internal config APIs.
- `server/routes/transactions.ts` — preview/import/upload endpoints.
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — client CSV parse & preview workflow.
- `src/components/ThemeToggle.tsx` and `tailwind.config.cjs` — theme tokens and dark mode.
- `src/index.css` — global normalization and layout helpers (.app-grid, .card-grid).
- `test/withdrawals.integration.test.ts` — example integration test and how to run it.

5. Safety/do-not-break rules (critical)

- Do not delete or change the compatibility endpoint (`/api/transactions/withdrawals/upload`) without confirming there are no external callers.
- When changing DB upsert behavior, preserve deterministic reporting: API responses should continue returning `{ inserted, updated, skipped, total }`.
- For UI migrations, prefer incremental changes (one page/component per PR) and run `npm run build` after each patch to catch TypeScript or PostCSS issues early.
- Backwards compatibility: existing external scripts may call legacy endpoints — deprecate with caution and keep wrappers when needed.

6. Testing and verification for PRs

- Local verification checklist for any PR:
  - Run `npm run type-check` (TS types)
  - Run `npm run lint` (code style)
  - Run `npm run build` (frontend production build) — note: DaisyUI/PostCSS vendor warnings may appear; they are informational unless you plan to upgrade PostCSS/Tailwind/daisyUI.
  - If you touched imports or server routes, run `npm run build:server` and `npm run server` to smoke-test APIs.
  - If you changed the withdrawals flow, run `npm run test:withdrawals` with `RUN_WITHDRAWALS_IT=1` and a valid `TEST_COOKIE`.

7. Search helpers & quick gambits

- Find remaining non-semantic UI styling to convert:
  - grep for `glass-` and `bg-white` to locate legacy glass-morphism or fixed-white surfaces.
- Find API usages:
  - grep for `/api/transactions/withdrawals/upload` to check callers.
- Look for Prisma-generated artifacts in `generated/` (client lives there).

8. Small, practical examples

- To preview import flow client → server:
  - client parses CSV (PapaParse) → POST `/api/transactions/withdrawals/preview` with `{ ids: string[] }` → server responds mapping of existing canonical JSONs → client shows diffs → POST `/api/transactions/withdrawals/import` with parsed payouts to commit.
- To change a UI card:
  - Replace `class="bg-white/70 rounded-2xl"` → `class="card bg-base-100 rounded-2xl shadow"` and ensure text uses semantic color classes (e.g., `text-slate-600` or `text-primary`).

9. When in doubt (escalation)

- If a change touches bulk DB imports, ask a human to run a canary import or review the `server/db.ts` chunk-size defaults (env + DB override).
- If a build produces unfamiliar PostCSS warnings, they are usually informational (daisyUI uses modern CSS); escalate if you plan to update PostCSS / Tailwind.

10. Where to document new conventions

- Add short notes to `docs/` and update `checklist-daisyui.md` (already present) when you introduce or change UI conventions.

— end of instructions —
