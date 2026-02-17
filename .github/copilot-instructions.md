# Bioalergia Copilot Context

**Project Date:** January 29, 2026 | **Last Updated:** Jan 29, 2026

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
- **UI Library:** HeroUI v3.0.0-beta.5 (NOT Material-UI or Chakra)
- **Date Handling:** `@internationalized/date` with dayjs (es_ES locale)
- **Build:** Vite v8.0.0-beta.10
- **Styling:** Tailwind CSS v4.1.18

#### Important Tools
- **Linter:** Biome (replaces ESLint/Prettier)
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

### 2. Dosage Field Refactoring (Completed Jan 29, 2026)
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

### 3. Analytics Page (TreatmentAnalyticsPage.tsx)
- **Location:** `/apps/intranet/src/features/operations/supplies/pages/TreatmentAnalyticsPage.tsx`
- **Components:** HeroUI DateField + DateInputGroup for date inputs (dark mode compatible)
- **Quick Ranges:** Responsive grid (1 col mobile → 3 col desktop) with inline labels
- **Layout:** Compact spacing (p-4, gap-3, space-y-4)
- **Data Source:** Backend queries via `/calendar/events/treatment-analytics`

### 4. Parser Architecture
- **Module:** `/apps/api/src/modules/calendar/parsers.ts`
- **Purpose:** Extract metadata from Google Calendar event summaries/descriptions
- **Key Functions:**
  - `parseCalendarMetadata()` - Main orchestrator
  - `extractDosage()` - Returns `{value: number, unit: string} | null`
  - `normalizeDecimalNumber()` - Converts "0,5" or "0.5" to number 0.5
  - `formatDosageNumber()` - Formats with es-CL locale for display
- **Pattern Matching:** Regex-based extraction from docstrings
- **Fallback Logic:** Treatment stage inference for missing dosages

### 5. Calendar Sync Service
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

### Build & Deploy
```bash
# Full monorepo build
pnpm build

# Individual app
cd apps/api && pnpm build

# Linting
pnpm lint:fix  # Uses Biome
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

### Pending 🔄
1. **Calendar Event Re-sync**
   - Trigger: `POST /calendar/events/sync`
   - Result: Events populate new dosageValue/dosageUnit fields
   - Status: Ready, awaiting execution

2. **Analytics Validation**
   - Verify dosage totals are correct
   - Test date filtering
   - Confirm treatment stage breakdowns

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

---
**Maintainer Notes:** This file should be updated whenever:
- New architectural decisions are made
- Parser changes are implemented
- Database schema changes are applied
- New conventions are established
- Important bug fixes or learnings occur
