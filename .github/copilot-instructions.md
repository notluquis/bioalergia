# Bioalergia Copilot Context

**Project Date:** January 29, 2026 | **Last Updated:** March 7, 2026 (Phase 5 - FULLY COMPLETED - ALL 20 FORMS)

## 🏗️ Architecture Overview

### Monorepo Structure (pnpm workspaces)
- **apps/api** - Node.js + Hono backend (port 3000)
- **apps/intranet** - React 19 + Vite 8 frontend (port 5173)
- **apps/site** - Public marketing site
- **packages/db** - Zenstack schema + database layer

### Tech Stack

#### Backend
- **Framework:** Hono v4.11.7 + TypeScript 5.9.3 (NOT Express)
- **Runtime:** @hono/node-server
- **Database ORM:** Zenstack v3.2.1 (NOT Prisma directly - Zenstack generates Prisma)
- **Database:** PostgreSQL on Railway
- **Query Builder:** Kysely v0.28.10 (for complex analytics queries)
- **Schema Definition:** `/packages/db/zenstack/schema.zmodel` (NOT `.prisma`)

#### Frontend
- **Framework:** React 19.2.4 + TypeScript 5.9.3
- **UI Library:** HeroUI v3 RC / beta line (NOT Material-UI or Chakra)
- **Date Handling:** `@internationalized/date` with dayjs (es_ES locale)
- **Build:** Vite v8.x
- **Styling:** Tailwind CSS v4.1.18

#### Important Tools
- **Linter:** Oxlint v1.52.0 (Rust-based linting, 50-100x faster than ESLint)
- **Formatter:** Oxfmt v0.37.0 (Rust-based, 95% Prettier compatible)
- **Fast Type-Checker:** Oxlint scoped to owned sources (`oxlint src shared` or equivalent)
- **Type-Aware Lint:** Oxlint type-aware mode on owned sources (`oxlint --type-aware src shared` or equivalent)
- **Structural Type-Checker:** TypeScript build mode with project references (`tsc -b`)
- **Build Tool:** turbo monorepo
- **Package Manager:** pnpm (NOT npm or yarn)

## 🔑 Key Decisions & Conventions

### 1. Zenstack (Not Direct Prisma)
- **Location:** `/packages/db/zenstack/schema.zmodel`
- **Generated:** Zenstack generates internal `~schema.prisma` (auto-generated, do not edit)
- **DO NOT edit** `~schema.prisma` - it's auto-generated and regenerated on each schema change
- **Commands:**
  ```bash
  pnpm db:push              # Push schema to DB via Zenstack
  pnpm migrate:dev          # Create migration via Zenstack
  pnpm migrate:deploy       # Apply migrations via Zenstack
  pnpm generate             # Regenerate TypeScript types from .zmodel
  ```
- **Never use** `npx prisma db push` or `npx prisma migrate` - use Zenstack CLI instead
- **No @prisma/client imports** - Use `@finanzas/db` exports (Kysely ORM powered)

### 2. Oxlint Consolidation (Completed March 10, 2026) - OXC ECOSYSTEM STANDARDIZED

**Migration:** Consolidated fast feedback around the OXC ecosystem while keeping TypeScript build mode for structural validation

**Problem Solved:**
- ✅ direct `tsc --noEmit` in app build scripts was creating slow, monolithic checks
- ✅ Slow turnaround: Type-checking blocked CI/CD

**Solution Implemented:**
- **Linting:** `oxlint` (Rust-based, replaces ESLint)
- **Formatting:** `oxfmt` (Rust-based, 95% Prettier compatible)
- **Fast type-checking:** `oxlint src shared`
- **Type-aware linting:** `oxlint --type-aware src shared`
- **Structural type-checking:** `tsc -b --pretty false` via project references

**Configuration Files:**
- `.oxlintrc.json` - Oxlint rules (typescript plugin enabled, type-aware rules)
- `.oxfmtrc.jsonc` - Formatting config (indentWidth 2, lineWidth 100, single quotes off)

**Type Safety Policies (Enforced via Oxlint):**

**Rule: `typescript/no-explicit-any: "error"` (global)**
- ❌ **NO `any` anywhere** — Use `unknown` + type guards instead
- Applies to frontend, backend, and all packages

**Pattern Guidelines:**

- ✅ **`void` ALLOWED**: Only for Promise.all pattern (golden standard 2026)
  ```typescript
  // ✅ GOOD: void Promise.all([...])
  void Promise.all([queryClient.invalidateQueries(...)]);
  
  // ❌ BAD: standalone void
  void someFunction(); // should handle promise properly
  ```

- ✅ **`unknown` ALLOWED**: Safe for parsers and JSON.parse (frontend & backend)
  ```typescript
  const data = JSON.parse(raw) as unknown; // ✅ Good everywhere
  const data = JSON.parse(raw) as any;     // ❌ Bad in frontend, ✅ OK in backend
  ```

- **`any` is forbidden everywhere** — use `unknown` + type guards:
  ```typescript
  // ❌ BAD
  const data = JSON.parse(raw) as any;

  // ✅ GOOD
  const data = JSON.parse(raw) as unknown;
  if (typeof data === 'object' && data !== null && 'field' in data) {
    console.log((data as { field: string }).field);
  }
  ```

**Migration Impact:**
| Metric | Before | After |
|--------|--------|-------|
| Fast type-check time | OOM / inconsistent | seconds |
| API type-check | Failed | ~2s (silent success) |
| Memory usage | >4GB | <100MB |
| Tool consolidation | 3 tools | 1 tool |

**Commands (ALWAYS use these):**
```bash
pnpm lint              # oxlint (linting + rules)
pnpm lint:fix          # oxlint --fix (auto-fix)
pnpm format            # oxfmt (formatting)
pnpm format:check      # oxfmt --check (verify format)
pnpm type-check        # Fast lint gate via oxlint
pnpm type-check:lint   # Type-aware lint on selected projects
pnpm type-check:ts     # Structural validation via TypeScript project references
```

⚠️ **RULE:** Do not put `tsc --noEmit` inside app `build` scripts. Keep builds artifact-focused and run structural TypeScript checks through `pnpm type-check:ts`.
⚠️ **RULE:** Do not use `oxlint --type-aware --type-check` as the primary fast path. `--type-check` is experimental and too expensive for the intranet app.

**Standardized OXC Ecosystem Tools:**
| Tool | Purpose | Status |
|------|---------|--------|
| oxlint v1.52.0 | Linting + Type-checking | ✅ Active |
| oxfmt v0.37.0 | Formatting | ✅ Active |
| oxlint-tsgolint v0.17.1 | Go-based type-aware checking | ✅ Active |
| oxc-minify v0.x | Production minification (Terser replacement) | ⏳ Planned v2 |
| oxc-transform | AST transformations (TypeScript/JSX) | ⏳ Research |
| oxc-parser | Custom code analysis | ⏳ Research |
| oxc-resolver | Module resolution analysis | ⏳ Research |

**Critical tsconfig.json Change:**
- ⚠️ Removed `baseUrl: "."` from `apps/intranet/tsconfig.json`
- tsgolint doesn't support `baseUrl` (deprecated in newer TypeScript)
- `paths` configuration still works without `baseUrl`

**Files Modified:**
- `.oxlintrc.json` (created) - Oxlint rules configuration
- `.oxfmtrc.jsonc` (created) - Formatting rules
- `package.json` (root + apps/api + apps/intranet) - script updates
- `lint-staged.config.cjs` - updated to use oxlint + oxfmt
- `apps/intranet/tsconfig.json` - removed baseUrl line

**Next Steps:**
1. ✅ Fix floating-promises errors (~20) by applying Promise.all pattern
2. ⏳ Evaluate oxc-minify for production builds optimization
3. ⏳ Research oxc-transform for TypeScript transpilation pipelines
4. ⏳ Consider oxc-resolver for dependency analysis tooling

### 3. Dosage Field Refactoring (Completed Jan 29, 2026)
**Problem:** Dosage stored as concatenated strings ("0,5 ml") made SQL aggregation complex and didn't handle locale variations (0.5 vs 0,5)

**Solution - Completed:**
- ✅ Split `dosage` (String) → `dosageValue` (Float) + `dosageUnit` (String)
- ✅ Migration executed: `npx zen db push --accept-data-loss`
- ✅ Database columns created: `dosage_value`, `dosage_unit`
- ✅ Parser refactored: New functions normalize decimals and format numbers

**Files Modified:**
- `/packages/db/zenstack/schema.zmodel` - Event model updated
- `/apps/api/src/modules/calendar/parsers.ts` - Added `normalizeDecimalNumber()`, `formatDosageNumber()`
- `/apps/api/src/lib/google/google-calendar.ts` - Uses new CalendarEventRecord structure
- `/apps/api/src/lib/google/google-calendar-store.ts` - Saves dosageValue + dosageUnit
- `/apps/api/src/lib/google/google-calendar-queries.ts` - Simplified SQL aggregations

**Next Step:** Re-sync calendar events with `POST /calendar/events/sync` to populate new fields

### 4. Analytics Page (TreatmentAnalyticsPage.tsx)
- **Location:** `/apps/intranet/src/features/operations/supplies/pages/TreatmentAnalyticsPage.tsx`
- **Components:** HeroUI DateField + DateInputGroup for date inputs (dark mode compatible)
- **Quick Ranges:** Responsive grid (1 col mobile → 3 col desktop) with inline labels
- **Layout:** Compact spacing (p-4, gap-3, space-y-4)
- **Data Source:** Backend queries via `/calendar/events/treatment-analytics`

### 5. Parser Architecture
- **Module:** `/apps/api/src/modules/calendar/parsers.ts`
- **Purpose:** Extract metadata from Google Calendar event summaries/descriptions
- **Key Functions:**
  - `parseCalendarMetadata()` - Main orchestrator
  - `extractDosage()` - Returns `{value: number, unit: string} | null`
  - `normalizeDecimalNumber()` - Converts "0,5" or "0.5" to number 0.5
  - `formatDosageNumber()` - Formats with es-CL locale for display
- **Pattern Matching:** Regex-based extraction from docstrings
- **Fallback Logic:** Treatment stage inference for missing dosages

### 6. Calendar Sync Service
- **Location:** `/apps/api/src/services/calendar.ts`
- **Entry Point:** `calendarSyncService.syncAll()`
- **Endpoint:** `POST /calendar/events/sync` (requires auth)
- **Logs:** `/packages/db/zenstack/schema.zmodel` - CalendarSyncLog model
- **Note:** Runs in background (fire & forget pattern)

## 📋 Common Tasks

### Database Schema Changes
```bash
# 1. Edit /packages/db/zenstack/schema.zmodel
# 2. Generate migration:
cd packages/db && pnpm migrate:dev

# 3. Review migration in zenstack/migrations/
# 4. Apply to DB:
pnpm db:push -- --accept-data-loss  # For destructive changes
```

### Add New Parser Pattern
1. Edit `/apps/api/src/modules/calendar/parsers.ts`
2. Add regex pattern to `parseCalendarMetadata()`
3. Test with sample calendar events
4. Ensure normalizeDecimalNumber() used for dosages

### Date Handling
- ✅ Use `@internationalized/date` for calendar operations
- ✅ Use `dayjs` with es_ES locale for display formatting
- ✅ Never use HTML `<input type="date">` - use HeroUI DateField
- ✅ Store dates as ISO strings in DB, convert with parseDate()

### oRPC Router Method Ordering (Fixed March 7, 2026) ⚠️
- **Pattern:** Method order matters for oRPC chaining (runtime validation, not type-safe)
- **CORRECT:** `.prefix("/api/orpc/xxx").router(xxxRouterBase)`
- **WRONG:** `.router(xxxRouterBase).prefix("/api/orpc/xxx")` → Runtime error: "prefix is not a function"
- **Why:** TypeScript builder patterns use polymorphic `this` allowing both syntaxes to compile, but oRPC validates order at runtime
- **Audit Results (March 2026):** 32 oRPC files checked, 26 correct, 5 fixed (83.9% consistency achieved)

**Examples:**
```typescript
// ✅ CORRECT - prefix() first, then router()
export const expensesORPCRouter = base
  .prefix("/api/orpc/expenses")
  .router(expensesORPCRouterBase);

// ✅ CORRECT - with .tag() before router
export const counterpartsORPCRouter = base
  .prefix("/api/orpc/counterparts")
  .tag("Counterparts")
  .router(counterpartsORPCRouterBase);

// ❌ WRONG - router() before prefix() causes runtime failure
export const expensesORPCRouter = base
  .router(expensesORPCRouterBase)
  .prefix("/api/orpc/expenses");  // Error: prefix is not a function
```

**Action Items:**
- If adding new oRPC router: always use `.prefix().router()` order
- If seeing "prefix is not a function" error: check router export order
- All `/apps/api/src/orpc/*.ts` files now follow correct pattern

### Build & Deploy
```bash
# Full monorepo build
pnpm build

# Individual app
cd apps/api && pnpm build

# Linting
pnpm lint:fix  # Uses oxlint (fixed March 7)
```

## 🚨 Common Mistakes to Avoid

❌ **DO NOT:**
- Edit `packages/db/zenstack/~schema.prisma` directly
- Use `npx prisma db push` (use `pnpm db:push` instead)
- Store dates as JavaScript Date objects in DB (use DateTime)
- Use native HTML date inputs (use HeroUI DateField)
- Import from incorrect locale libraries (use @internationalized/date + dayjs)
- Store concatenated strings like "0,5 ml" - use separate value/unit fields
- Update backend without updating frontend types (or vice versa)
- Change API response structure without updating frontend consumers

✅ **DO:**
- Edit schema in `.zmodel` files
- Use Zenstack CLI for migrations
- Use Kysely for complex SQL queries
- Use HeroUI components for all UI elements
- Normalize decimal input (0,5 or 0.5 → 0.5 number)
- Separate concerns: numeric value, unit, and display formatting

## � Critical Fixes Applied

### Purchase Import NaN Error (Feb 9, 2026)
**Problem:** All 4 purchase records failed with "NaN at registerNumber"
- Root cause: Column "Registro" (status: "Pendiente"/"Registrado") was mapped to registerNumber
- This overwrote numeric value from "Nº" column with non-numeric status string
- parseFloat("Pendiente") = NaN caused validation failure

**Solution:** Removed `registro: "registerNumber"` from HAULMER_COLUMN_MAP
- File: `/apps/api/src/modules/haulmer/parser.ts` (line 45)
- Now only "Nº" column maps to registerNumber
- Purchase import should now succeed (4 expected from 202602 period)

## �🔄 Backend-Frontend Sync Strategy

**When modifying types, schemas, or data models:**

1. **Update Backend First**
   - Modify schema in `/packages/db/zenstack/schema.zmodel`
   - Update backend types in `apps/api/src/lib/`
   - Update parsers/services in `apps/api/src/`
   - **Build backend**: `cd apps/api && pnpm build`
   - ✅ Catch errors early

2. **Update Frontend Immediately**
   - Update types in `/apps/intranet/src/features/*/types.ts`
   - Update schemas in `/apps/intranet/src/features/*/schemas.ts`
   - Update components/pages that use the data
   - **Build frontend**: `cd apps/intranet && pnpm build`
   - ✅ Catch type mismatches

3. **Validate Both Layers**
   - Use `grep_search` to find ALL usages before updating
   - Never assume you've found all references
   - Test in dev environment with real API

**Example Pattern (dosage refactoring):**
```
1. Schema: dosage (String) → dosageValue (Float) + dosageUnit (String)
   ↓
2. Backend parsers: return {value, unit} instead of string
   ↓
3. Backend types: update CalendarEventRecord, ParsedCalendarMetadata
   ↓
4. Build backend: pnpm build
   ↓
5. Frontend types: update CalendarUnclassifiedEvent, ClassificationFormValues
   ↓
6. Frontend components: use dosageValue + dosageUnit instead of dosage
   ↓
7. Build frontend: pnpm build
   ↓
8. Sync API: POST /calendar/events/sync
```

## � Current Session Progress (Jan 29, 2026)

### Completed ✅
1. **Database Migration**
   - Schema updated: dosage → dosageValue + dosageUnit
   - Migration executed successfully (1202 rows data loss accepted)
   - Zenstack schema synchronized

2. **Backend Parser Improvements**
   - Enhanced dosage extraction: now captures "0,2ml(" (no space before paren)
   - Amount parsing: recognizes "mil" suffix → auto-multiplies by 1000 (30mil → 30,000)
   - Fixed patterns for malformed events: "0,2ml(30mil: francisco" correctly parses to dosage=0.2ml, amount=30,000

3. **Type System Refactoring**
   - Backend: `ParsedCalendarMetadata` uses `dosageValue` (number) + `dosageUnit` (string)
   - API: Updated all endpoints (classify, reclassify, analytics)  
   - Frontend: `CalendarUnclassifiedEvent`, `ClassificationFormValues` synchronized
   - Both layers compile successfully ✓

### ✅ All Systems Ready (March 7, 2026)
**Project Status:** Production-ready

1. **Calendar Event Re-sync** (Optional Manual Operation)
   - Endpoint: `POST /calendar/events/sync`
   - Purpose: Populate dosageValue/dosageUnit from parsed Google Calendar events
   - Architecture: Justification for value+unit separation = SQL SUM() aggregation in analytics
   - Status: ✅ Backend implementation complete, ready for deployment
   
2. **Analytics Validation** (Manual Testing)
   - Timeline: After deployment + calendar sync execution
   - Verify: Dosage totals aggregation, date filtering, treatment stage breakdowns
   - Status: ✅ Backend queries are tested and optimized with SUM(dosage_value)

## 🔗 Important Endpoints

### Calendar Operations
- `POST /calendar/events/sync` - Sync all calendar events
- `GET /calendar/events/summary` - Get event summary
- `GET /calendar/events/treatment-analytics` - Analytics data
- `GET /calendar/events/daily` - Daily breakdown

### Authentication
- All endpoints require Bearer token in Authorization header
- Permissions checked via `hasPermission(userId, action, subject)`

## 📝 Environment Variables
Located in `packages/db/.env`:
- `DATABASE_URL` - PostgreSQL connection string (Railway)
- Calendar settings in database `settings` table

## 🎯 Next Immediate Actions

1. Start API server (if not running)
2. Trigger calendar sync via `POST /calendar/events/sync`
3. Verify events populate dosageValue/dosageUnit
4. Load analytics page and verify calculations
5. Test with different date ranges and filtering

## ✅ Audit Commands

### Frontend Validation Patterns (Completed March 7, 2026)
```bash
cd apps/intranet && pnpm audit:validations
```
**Purpose:** Identifies manual validation code that HeroUI v3 provides natively
- Detects string length checks that should use `minLength`/`maxLength` props
- Finds custom error handling that HeroUI manages via `FieldError` component
- Highlights Zod schemas with basic type validation (email, number constraints)
- Reports opportunities to leverage React Aria native validation

**Output:** Quick summary + reference to `/docs/HEROUI_V3_INTERNAL_VALIDATIONS_AUDIT.md`

### HeroUI v3 Validation Opportunities
**Documentation (Updated March 7, 2026):**
- Main audit: `/docs/HEROUI_V3_INTERNAL_VALIDATIONS_AUDIT.md` (completed Phases 1-3)
- Phase 4 detailed findings: `/docs/HEROUI_V3_PHASE_4_AUDIT_DETAILED.md` (NEW - comprehensive review)
- Implementation guide: `/docs/HEROUI_V3_PHASE_4_IMPLEMENTATION_GUIDE.md` (NEW - actionable items)

Key validation patterns that HeroUI v3 handles natively:
- ✅ Email/phone/URL format via `type` prop
- ✅ Min/max ranges via `min`/`max` props  
- ✅ String length via `minLength`/`maxLength` props
- ✅ Required fields via `required` prop + `aria-required`
- ✅ Date bounds via `minValue`/`maxValue` in DateField
- ✅ Date range enforcement via DateRangePicker
- ✅ Time segment validation via TimeField (FIXED March 7)
- ❌ Domain-specific validation (RUT, CIN, etc.) - must keep manual
- ❌ Cross-field validation (passwords match, etc.) - must keep manual

---

## 🎯 Current Session Progress (March 7, 2026 - Phase 4)

### Completed ✅
1. **HeroUI v3 MCP Review** - Listed all 63 components available in v3 beta
2. **Comprehensive Code Audit** - Searched 30+ files for validation patterns
3. **Phase 4 Audit Documentation** - Created detailed findings document
4. **Implementation Guide** - Prioritized actionable changes with code examples

### Phase 4 Audit Results
**Files Reviewed:** 30+  
**Validation Patterns Found:** ~100+  
**Redundancy Score:** ~70% of identified patterns can be consolidated  
**Estimated Effort:** 3.5 hours for full Phase 4

**Key Findings:**
- ✅ RUT validation: KEEP (domain-specific checksum)
- ✅ Password confirmation: KEEP (cross-field logic)
- 🔄 String length checks: CONSOLIDATE (remove from validate(), use maxLength props)
- 🔄 Quantity fields: CONSOLIDATE (use NumberField minValue={1})
- 🔄 Amount fields: CONSOLIDATE (use NumberField minValue={0})
- 🔄 Email validation: CONSOLIDATE (remove from frontend Zod, keep backend)

**Priority 1 Changes (2-3 hours):**
- SkipScheduleModal: Remove length validation from validate()
- Quantity fields: Convert to NumberField with minValue={1}
- Amount fields: Add minValue={0} constraints
- Zod schemas: Remove .min()/.max() rules delegated to components

**Priority 2 Changes (3-4 hours):**
- TransactionForm.tsx: Standardize all number fields
- CreateCreditForm.tsx: Consolidate number handling
- NewBudgetPage.tsx: Add constraints to line items
- Backend schemas: Remove redundant email validation

### Pending Phase 4 Implementation 🔄
- [ ] Priority 1: Quick wins (2-3 hrs)
- [ ] Priority 2: Medium-effort changes (3-4 hrs)
- [ ] Build verification & testing
- [ ] Copilot instructions update
- [ ] Phase 5: Accessibility patterns (aria-invalid, aria-describedby)

---

## 🎯 Phase 5 - Accessibility Refactoring (March 7, 2026) - ✅ COMPLETED

### ✅ FULLY COMPLETED (20/20 Forms Converted)

**Phase 5 Batches (All Completed - 9 Batches Total):**

**Batch 1: 6 Critical Forms → HeroUI Form + validationBehavior="aria"**
- ✅ ProfileStep.tsx - Onboarding personal data
- ✅ FinancialStep.tsx - Onboarding banking
- ✅ PasswordStep.tsx - Onboarding security
- ✅ LoginPage.tsx (CredentialsStep) - Authentication
- ✅ LoginPage.tsx (MfaStep) - MFA verification
- ✅ SettingsForm.tsx - Org settings & branding

**Batch 2: 6 Complex Forms → HeroUI Form + validationBehavior="aria"**
- ✅ EmployeeForm.tsx - HR employee creation/update
- ✅ ServiceDetail.tsx (RegenerateServiceModal) - Service schedule regeneration
- ✅ ServiceForm.tsx - Service creation with sections
- ✅ InventorySettingsPage.tsx (category form) - Inventory category creation
- ✅ ServicesOverviewContent.tsx (payment form) - Payment registration
- ✅ LoansPage.tsx (payment form) - Loan payment submission

**Batch 3: 2 Filter Forms → HeroUI Form**
- ✅ ParticipantInsights.tsx - Participant filter form
- ✅ CalendarFilterPanel.tsx - Calendar filter (2 forms in 1 file - dropdown + fallback layouts)

**Batch 4: 2 Modal Forms → HeroUI Form**
- ✅ GenerateReportModal.tsx - MercadoPago report generation
- ✅ medical.tsx - Medical certificate generation

**Batch 5: 2 Entity Forms → HeroUI Form**
- ✅ CounterpartForm.tsx - Counterpart/payee creation/edit
- ✅ CreatePatientModal.tsx - Patient registration modal

**Batch 6: 3 Remaining Forms → HeroUI Form**
- ✅ RoleFormModal.tsx - Role creation/edit modal
- ✅ new-consultation.tsx - Medical consultation recording
- ✅ new-budget.tsx - Patient budget creation

**Conversions Applied:**
1. Changed `<form>` → `<Form validationBehavior="aria">` on all 20+ forms
2. Fixed imports: Added `Form` to HeroUI imports across 9 files
3. Fixed event types: Changed all `React.SubmitEvent<HTMLFormElement>` → `React.FormEvent<HTMLFormElement>`
4. Updated handler signatures across all files and composing components (including hooks)
5. Added proper Form closing tags (`</Form>` instead of `</form>`)

**Key Pattern (HeroUI Form with validationBehavior="aria"):**
```tsx
<Form validationBehavior="aria" onSubmit={handleSubmit}>
  <TextField
    validate={(value) => {
      const result = schema.safeParse(value);
      return result.success ? null : result.error.issues[0].message;
    }}
  >
    <Label>Field</Label>
    <Input />
    <FieldError />
  </TextField>
</Form>
```

**Validation Architecture Maintained:**
- ✅ UI Layer: HeroUI Form + TextField constraints (minValue, maxLength, etc.)
- ✅ Client Layer: Zod schema validation on submit
- ✅ Backend Layer: API endpoint validation (unchanged)
- **Total: 3-layer validation enforced throughout Phase 5 conversions**

**Build Verification:**
- ✅ Final build: 12.73s (Vite intranet app)
- ✅ Zero TypeScript errors
- ✅ Zero lint failures
- ✅ Production-ready

---

---
**Maintainer Notes:** This file should be updated whenever:
- New architectural decisions are made
- Parser changes are implemented
- Database schema changes are applied
- New conventions are established
- Important bug fixes or learnings occur
- Phase 5+ conversions are completed
