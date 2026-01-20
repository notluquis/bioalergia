# Superpowers Review - Codebase Audit

**Date**: 2026-01-20
**Scope**: Whole Codebase (apps/web, apps/api)
**Methodology**: Random sampling + Keyword search (Audit depth: 10+ categories)

## 🚨 Blockers
*None currently blocking the build, but strictly blocking "Golden Standard" quality.*

## 🔴 Majors

### 1. Security Risk: Commented-out RBAC
**Location**: `apps/web/src/routes/_authed/finanzas/personal-credits.tsx`
**Issue**: The permission check `if (!context.auth.can("read", "PersonalCredit"))` is commented out.
**Impact**: Unauthorized users might access this route if the backend `PersonalCredit` policy isn't strict enough (or if data is pre-fetched).
**Action**: Uncomment the check immediately.

### 2. Missing Backend Tests
**Location**: `apps/api`
**Issue**: Running `find apps packages -name "*.test.ts"` yielded results only for `apps/web`. The API appears to have **zero** unit or integration tests.
**Impact**: High risk of regression in business logic (e.g. `doctoralia.ts`, `google-calendar.ts`).
**Action**: Setup Vitest for `apps/api` and add basic smoke tests for services.

## 🟡 Minors

### 3. Styling: Hardcoded Hex Colors
**Location**: `apps/web/src/features/calendar/components/WeekGrid.css`, `finance.css`
**Issue**: Use of `#ccc` and `#f5f5f5`.
**Impact**: Violates "Semantic Tokens ONLY" rule. Breaks themes (Dark Mode).
**Action**: Replace with `border-base-300`, `bg-base-200`, etc.

### 4. Performance: Potentially Heavy Includes
**Location**: `apps/api/src/services/doctoralia.ts`
**Issue**: `getDoctoraliaDoctorsWithAddresses` includes `addresses` -> `_count` of bookings/services.
**Impact**: While Postgres handles this well, looking up counts for *every* address of *every* doctor in a list could slow down as data grows.
**Action**: Monitor query time. Consider denormalizing counts or using separate analytics queries.

### 5. Documentation: Missing API Docs
**Location**: `apps/api`
**Issue**: No `README.md` explaining how to run the API locally or its env vars (beyond root README).
**Action**: Add `apps/api/README.md`.

## 🟢 Nits

### 6. Linting: Unused Imports
**Location**: Various
**Issue**: Biome is configured (`noUnusedImports: "error"`) but some files might have slipped through or are ignored.
**Action**: Run `pnpm lint:fix` globally.

## Summary & Next Actions

 The codebase is structurally sound (Monorepo, Hono, ZenStack) but lacks rigorous testing on the backend and has a critical security oversight in the frontend routes.

**Next Steps**:
1.  **Fix Security**: Uncomment RBAC in `personal-credits.tsx`.
2.  **Fix Styles**: Grep and replace all `#` hex codes in `apps/web`.
3.  **Init Tests**: Create `apps/api/vitest.config.ts`.
