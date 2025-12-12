## finanzas-app — Copilot / AI agent quick instructions

Short, actionable guidance so an AI agent can be productive immediately in this repo.

Recent Major Changes (Last 30 Days)

**Authentication & User Management (Dec 2024):**

- `passwordHash` is now **optional** in Prisma schema (`String?`) — supports passkey-only users.
- Migration `20251212_make_password_optional` deployed: `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`.
- New `passkeyOnly` option in `server/routes/user-management.ts` — creates users without password (passwordHash=null).
- `src/pages/admin/AddUserPage.tsx` — new checkbox "Solo Passkey (sin contraseña)" to create passkey-only users.
- `server/routes/auth.ts` — safe null passwordHash handling: PENDING_SETUP users can login without password, ACTIVE users with null passwordHash must use passkey.
- `src/features/auth/pages/LoginPage.tsx` — password field not `required`, removed duplicate toast error (kept inline error only).

**Docker & Build Optimizations (Dec 2024):**

- `Dockerfile` — switched to `node:current-slim` (Debian/glibc, ~30% faster than Alpine/musl).
- OpenSSL installed explicitly: `RUN apt-get update -y && apt-get install -y openssl` in base and runner stages.
- Prisma binary target: `ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"` (fixes "failed to detect libssl" warning).

**Dependency Updates (Dec 2024):**

- `@simplewebauthn/types` deprecated (v12) → removed package, updated imports to use `@simplewebauthn/browser` and `@simplewebauthn/server` types directly (v13+).
- `src/pages/ChunkLoadErrorPage.tsx` — now lazy-loaded with React.lazy() + Suspense (fixed Vite bundle duplication warning).

**Calendar & API Infrastructure (Dec 2024):**

- **Calendar API**: Use `src/features/calendar/api.ts` for all calendar operations — already has `fetchCalendarSummary`, `fetchCalendarDaily`, `syncCalendarEvents`, `fetchCalendarSyncLogs`, `fetchUnclassifiedCalendarEvents`, `classifyCalendarEvent`.
- **Calendar Hooks**: Use `src/features/calendar/hooks/useCalendarEvents.ts` — provides complete state management for calendar filters, sync status, and data fetching. Exposes `hasRunningSyncFromOtherSource` to detect RUNNING syncs from any source.
- **Calendar Types**: All types defined in `src/features/calendar/types.ts` — use these instead of creating duplicates. CalendarSyncLog includes "RUNNING" | "SUCCESS" | "ERROR" status.
- **Settings Pages**: `src/pages/settings/CalendarSettingsPage.tsx` uses existing calendar API functions, shows RUNNING state with auto-refresh only when RUNNING (no unnecessary polling).
- **Backend Endpoints**: `GET /api/calendar/calendars` returns list of calendars with event counts. All calendar routes in `server/routes/calendar-events.ts`.
- **Error Handling**: `server/lib/google-calendar-store.ts` wraps all calendar upserts in try-catch with detailed logging. Follows Google Calendar API best practices for exponential backoff on 403/429 errors.
- **Sync Lock**: `server/services/calendar.ts` manages RUNNING sync lock with 5-minute stale timeout (reduced from 10min). Automatically marks stale syncs as ERROR.
- **UI State**: All calendar UI components (`CalendarSettingsPage`, `CalendarSyncHistoryPage`, `CalendarSummaryPage`) display RUNNING state with badge-warning + spinner. Auto-refresh every 5s only when status=RUNNING (conditional polling via useEffect).
- **Google Calendar Webhooks**: Documented in `docs/google-calendar-webhooks.md`. Push notifications available but not implemented (polling every 15min sufficient for current scale). Use webhooks when >100 active users or need <5min latency.

**Schema Consistency (Dec 2024):**

- Fixed all raw SQL queries to match Prisma schema mappings (`@@map` and `@map` directives).
- `people` table (not `person`), `events` table (not `google_calendar_events`), `external_event_id` column (not `event_id`).
- All `$queryRaw` calls verified against schema: `server/lib/google-calendar-queries.ts`, `server/services/transactions.ts`.

Read first (highest value)

- `server/routes/user-management.ts` — user creation with passkeyOnly option (passwordHash=null for passkey-only users).
- `server/routes/auth.ts` — Passkey (WebAuthn) + email/password + MFA authentication flows, **handles null passwordHash safely**.
- `prisma/schema.prisma` (line 132) — passwordHash is now `String?` (nullable), supports passkey-only users.
- `src/pages/admin/AddUserPage.tsx` — user creation form with passkeyOnly checkbox.
- `src/features/auth/pages/LoginPage.tsx` — minimalist passkey-first login UI (biometría → email/password → MFA), **password not required, no toast errors**.
- `server/db.ts` — canonical DB helpers and `upsertWithdrawals` (deterministic, chunked upsert).
- `server/config.ts` — session configuration (24h duration), JWT secrets, cookie options.
- `server/routes/transactions.ts` — preview/import endpoints and the legacy compatibility wrapper (`/api/transactions/withdrawals/upload`).
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — client-side CSV preview/import flow (PapaParse ➜ /preview ➜ /import).
- `src/components/ui/ChunkErrorBoundary.tsx` — Error Boundary for chunk loading failures (production 404 handling).
- `Dockerfile` — node:current-slim with OpenSSL, Prisma debian-openssl-3.0.x binary target.
- `src/components/ThemeToggle.tsx`, `tailwind.config.cjs`, `src/index.css` — theming and global CSS tokens; prefer DaisyUI tokens.
- `vite.config.ts` — VitePWA configuration (manifest, icons, service worker, build optimization).

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

- **Never create mock data**: Always use real API endpoints. Calendar API already exists in `src/features/calendar/api.ts`.
- **Check for existing APIs first**: Search `src/features/*/api.ts` and `server/routes/*.ts` before creating new endpoints or duplicating types.
- **Reuse existing hooks**: Check `src/features/*/hooks/` for state management hooks before creating new ones.
- **Calendar sync state**: Always display RUNNING/SUCCESS/ERROR states in calendar UIs. Use auto-refresh (5s interval) to detect state changes. Disable sync buttons when status is RUNNING.
- **Error handling**: Wrap all external API calls (Google Calendar, Prisma upserts) in try-catch with detailed logging including input values and error stack traces.
- **Google Calendar API**: Follow exponential backoff for 403/429 rate limit errors. Log all calendar ID mapping failures with googleId context.
- Use DaisyUI semantic classes; avoid hard-coded whites or hex colors. Search `bg-white` and `glass-` when migrating UI.
- Centralize CTAs via `src/components/Button.tsx` (variants: primary/secondary, sizes: xs/sm/md/lg).
- Theme: set `document.documentElement.data-theme` to `bioalergia` or `bioalergia-dark` and toggle `html.classList.dark` for dark-mode-specific Tailwind behaviors.
- DB: preserve deterministic upsert behavior: API responses must include `{ inserted, updated, skipped, total }`.
- Auth sessions: configured to 24 hours in `server/config.ts` (`sessionCookieOptions.maxAge`). Do not change without user approval.
- Chunk errors: wrapped in `ChunkErrorBoundary` (see `src/main.tsx`). Service Worker update listener checks every 60s for new builds.
- Login UX: passkey-first flow (biometría → email/password → MFA). Keep minimalist aesthetic, no decorative gradients.
- PWA manifest: never create `public/manifest.json` manually — it's auto-generated by VitePWA plugin in `vite.config.ts`.
- **Raw SQL queries**: Must use PostgreSQL table/column names from Prisma schema (check `@@map` and `@map` directives). Use snake_case in SQL, camelCase in TypeScript/Prisma.

Important files & quick tour

- `src/features/calendar/api.ts` — centralized calendar API calls (sync, fetch logs, classify events). **Use these instead of creating new API calls**.
- `src/features/calendar/hooks/useCalendarEvents.ts` — complete calendar state management hook with filters, sync, etc.
- `src/features/calendar/types.ts` — all calendar-related TypeScript types. **Do not duplicate these**.
- `server/routes/calendar-events.ts` — all calendar endpoints (summary, daily, sync, logs, classify, calendars list).
- `server/lib/google-calendar-queries.ts` — raw SQL queries for calendar aggregations (fixed to match schema).
- `server/lib/google-calendar.ts` — Google Calendar API integration and sync logic.
- `server/db.ts` — upsertWithdrawals, internal config (DB overrides for chunk size)
- `server/config.ts` — session duration (24h), JWT secrets, cookie options
- `server/routes/auth.ts` — Passkey + email/password + MFA endpoints
- `server/routes/transactions.ts` — preview/import & compatibility wrapper
- `src/features/auth/pages/LoginPage.tsx` — minimalist passkey-first login UI
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — CSV parse/preview UI
- `src/components/ui/ChunkErrorBoundary.tsx` — chunk loading error handling (production 404s)
- `src/lib/swUpdateListener.ts` — Service Worker update detection (60s polling)
- `src/pages/ChunkLoadErrorPage.tsx` — dedicated error page with cache cleanup + retry
- `src/main.tsx` — app entry point, ChunkErrorBoundary wrapper, SW listener init
- `src/index.css` — global normalizations, `.app-grid`, `.card-grid`
- `index.html` — apple-touch-icon meta tags (180x180 for Apple Passwords), theme-color
- `vite.config.ts` — VitePWA config (manifest auto-generation, icons, shortcuts, share target)
- `tailwind.config.cjs` — daisyUI themes and darkMode: 'class'
- `generated/` — Prisma client (do not edit)

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
- Do not manually create `public/manifest.json` — VitePWA auto-generates it from `vite.config.ts`.
- Do not change session duration (`server/config.ts` maxAge) without user approval — currently set to 24 hours.
- Do not remove ChunkErrorBoundary wrapper in `src/main.tsx` — it handles production chunk 404s gracefully.
- Do not alter LoginPage aesthetic (minimalist, passkey-first) without explicit request.

If you want this adjusted (more frontend/backend split, example PR templates, or an automated codemod plan), tell me which and I'll update the file or create PR scaffolding.

# Copilot / AI agent instructions for finanzas-app

Short, actionable instructions so AI coding agents are productive immediately.

1. High-level architecture (what to know first)

- Frontend: React + TypeScript + Vite (entry: `src/main.tsx`, styles in `src/index.css`). Tailwind + DaisyUI theme configured in `tailwind.config.cjs`. Theme toggle implemented in `src/components/ThemeToggle.tsx`.
- Backend: Node + Express + TypeScript under `server/`. Routes live in `server/routes/*.ts` and DB logic in `server/db.ts`. DB uses MySQL via `mysql2/promise`. Prisma client artifacts are in `generated/`.
- Data flows:
  - CSV upload flow is intentionally preview-first: client parses CSV -> POST `/api/transactions/withdrawals/preview` (preview existing withdraws) -> POST `/api/transactions/withdrawals/import` (server upsert).
  - Legacy compatibility wrapper exists: `POST /api/transactions/withdrawals/upload` (server-side parsing -> upsert) — do not remove without checking external callers.

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
- Error handling: all route-based lazy imports are wrapped in `ChunkErrorBoundary` (see `src/main.tsx`). Service Worker update listener (`src/lib/swUpdateListener.ts`) checks for updates every 60s, no forced reload.
- **Auth flow**: passkey-first (biometría preferred), then email/password, then MFA. Session duration is 24 hours (`server/config.ts`). **Passkey-only users** (passwordHash=null) can only authenticate via passkey. **PENDING_SETUP users** can login with or without password (temporary state before passkey setup).
- PWA manifest: auto-generated by VitePWA plugin in `vite.config.ts`. Includes icons, shortcuts, share_target, and Apple-specific metadata.
- Apple Passwords integration: use `apple-touch-icon` 180x180 (`index.html`) for optimal favicon display in iOS/macOS password managers.

4. Files to read first (quick tour paths)

- `server/routes/user-management.ts` — user creation/invitation endpoints, passkeyOnly option support.
- `server/routes/auth.ts` — Passkey (WebAuthn) + email/password + MFA authentication, null passwordHash handling.
- `prisma/schema.prisma` — User model (line 132: passwordHash is String?, nullable for passkey-only users).
- `src/pages/admin/AddUserPage.tsx` — user creation form with passkeyOnly checkbox.
- `server/db.ts` — canonical upsert logic and internal config APIs.
- `server/config.ts` — session duration (24h), JWT secrets, cookie options.
- `server/routes/transactions.ts` — preview/import/upload endpoints.
- `src/features/auth/pages/LoginPage.tsx` — minimalist passkey-first login UI (no required password, inline errors only).
- `src/features/transactions/components/PayoutPreviewUpload.tsx` — client CSV parse & preview workflow.
- `src/components/ui/ChunkErrorBoundary.tsx` — Error Boundary for chunk loading failures.
- `src/lib/swUpdateListener.ts` — Service Worker update detection (60s polling, no forced reload).
- `src/pages/ChunkLoadErrorPage.tsx` — dedicated error page with cache cleanup + retry button.
- `src/main.tsx` — app entry point, ChunkErrorBoundary wrapper, SW listener initialization.
- `src/components/ThemeToggle.tsx` and `tailwind.config.cjs` — theme tokens and dark mode.
- `src/index.css` — global normalization and layout helpers (.app-grid, .card-grid).
- `index.html` — apple-touch-icon meta tags (180x180 for Apple Passwords/Keychain).
- `vite.config.ts` — VitePWA configuration (manifest, icons, service worker, code splitting).
- `Dockerfile` — node:current-slim with OpenSSL, Prisma debian-openssl-3.0.x binary target.
- `test/withdrawals.integration.test.ts` — example integration test and how to run it.

5. Safety/do-not-break rules (critical)

- Do not delete or change the compatibility endpoint (`/api/transactions/withdrawals/upload`) without confirming there are no external callers.
- When changing DB upsert behavior, preserve deterministic reporting: API responses should continue returning `{ inserted, updated, skipped, total }`.
- For UI migrations, prefer incremental changes (one page/component per PR) and run `npm run build` after each patch to catch TypeScript or PostCSS issues early.
- Backwards compatibility: existing external scripts may call legacy endpoints — deprecate with caution and keep wrappers when needed.
- Do not manually create `public/manifest.json` — VitePWA auto-generates it from `vite.config.ts`.
- Do not change session duration (`server/config.ts` maxAge) without user approval — currently set to 24 hours.
- Do not remove ChunkErrorBoundary wrapper in `src/main.tsx` — it handles production chunk 404s gracefully.
- Do not alter LoginPage aesthetic (minimalist, passkey-first) without explicit request.
- **Database Migrations**: Never modify deployed migrations. Always create new migrations with `npx prisma migrate dev --name descriptive_name`. Run `npx prisma migrate status` to verify migration state before deploying.
- **Prisma Schema Changes**: When changing nullable fields or adding constraints, test with existing production data patterns. Run `npx prisma generate` after schema changes.
- **Docker/Railway Deployment**: Do not change Dockerfile base image or Prisma binary targets without testing build. OpenSSL is required for Prisma, binary target must match base image OS (debian-openssl-3.0.x for node:current-slim).
- **Strict Pre-commit Hooks**: The project uses `husky` and `lint-staged`. Commits WILL FAIL if there are unused imports, unused variables, or type errors. Always run `npm run type-check` and `npm run lint` BEFORE attempting to commit.

6. Testing and verification for PRs

- Local verification checklist for any PR:
  - Run `npm run type-check` (TS types)
  - Run `npm run lint` (code style)
  - Run `npm run build` (frontend production build) — note: DaisyUI/PostCSS vendor warnings may appear; they are informational unless you plan to upgrade PostCSS/Tailwind/daisyUI.
  - If you touched imports or server routes, run `npm run build:server` and `npm run server` to smoke-test APIs.
  - If you changed the withdrawals flow, run `npm run test:withdrawals` with `RUN_WITHDRAWALS_IT=1` and a valid `TEST_COOKIE`.

**Expected Build Warnings (Safe to Ignore):**

- `npm warn deprecated sourcemap-codec, source-map, node-domexception` — Transitive dependencies from vite-plugin-pwa/workbox-build (latest versions, no updates available)
- `PostCSS: Unknown at rule: @property` — daisyUI uses modern CSS Houdini features, fully functional in target browsers

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
- To add a new icon size for Apple Passwords:
  - Generate icon with `sips -z 180 180 icon-192.png --out icon-180.png` in `public/icons/`.
  - Add to `vite.config.ts` VitePWA manifest icons array: `{ src: "/icons/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any maskable" }`.
  - Add to `index.html` apple-touch-icon: `<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />`.
- To handle new chunk loading patterns:
  - Ensure all lazy route imports in `src/main.tsx` are wrapped by `ChunkErrorBoundary`.
  - Service Worker listener in `src/lib/swUpdateListener.ts` handles update detection automatically.
- To change session duration:
  - Edit `server/config.ts` → `sessionCookieOptions.maxAge` (currently `24 * 60 * 60 * 1000` = 24 hours).
  - Document the change and get user approval first.

9. When in doubt (escalation)

- If a change touches bulk DB imports, ask a human to run a canary import or review the `server/db.ts` chunk-size defaults (env + DB override).
- If a build produces unfamiliar PostCSS warnings, they are usually informational (daisyUI uses modern CSS); escalate if you plan to update PostCSS / Tailwind.

— end of instructions —
