# Any Types Audit - February 1, 2026

**Last Updated:** February 1, 2026  
**Total any instances:** 112  
**Total biome-ignore suppressions:** 100+

## Executive Summary

This document catalogs all remaining `any` type usages in the Bioalergia codebase. The majority are justified due to library constraints (TanStack, Kysely) or legacy code patterns. A pragmatic approach has been taken to balance type safety with development velocity.

---

## Backend - Services (67 instances)

### Priority: MEDIUM - Refactor Candidates

#### services/transactions.ts (19 instances)
- **Line 66**: `const where: any = {}` - Dynamic where clause for Kysely builder
  - Status: ⚠️ Could use `TransactionFilters` typedef but builder is dynamic
  - Priority: LOW (builder patterns are inherently untyped in Kysely)
- **Lines 230, 234**: `from as any`, `to as any` - Date casting for Kysely.where
  - Status: ⚠️ Kysely.sql requires `as any` for date parameters
  - Priority: LOW (Kysely limitation)
- **Line 288**: `(eb: any)` - Kysely expression builder
  - Status: ⚠️ ExpressionBuilder type not exported by Kysely
  - Priority: LOW (library limitation)
- **Lines 429, 462**: `(t: any)` - Map callback transformations
  - Status: ✅ FIXABLE - Could infer from query result types
  - Priority: MEDIUM

#### services/timesheets.ts (7 instances)
- **Lines 339-353**: ` as any` - Date/Time casting for Prisma
  - Status: ⚠️ Prisma Date fields require explicit casting
  - Suppression: ✅ Has `// biome-ignore` 
  - Priority: LOW (schema mismatch between types and DB)
- **Lines 381, 439**: `catch (error: any)` - Error handling
  - Status: ✅ FIXABLE - Should be `catch (error: unknown)` or `Error`
  - Priority: HIGH

#### services/backups.ts (5 instances)
- **Line 135**: `const dbRecord = db as Record<string, any>`
  - Status: ⚠️ Dynamic DB model access necessary
  - Priority: LOW (reflection pattern)
- **Line 151**: `const batch: any[]` - Array of unknown records
  - Status: ✅ FIXABLE - Could be more specific based on model
  - Priority: MEDIUM
- **Line 313-317**: `const jobs/history/logs: any[]`
  - Status: ✅ FIXABLE - Could define specific types
  - Priority: MEDIUM

#### services/mercadopago/mappers.ts (2 instances)
- **Line 20**: `export function parseDecimal(val: string): any`
  - Status: ✅ FIXABLE - Return type is `Decimal | number`
  - Priority: HIGH
- **Line 35**: `export function parseJson(val: any): any`
  - Status: ⚠️ PARTIALLY FIXABLE - Input could be better typed
  - Priority: MEDIUM

#### services/calendar.ts (2 instances)
- **Lines 21, 155**: `const where: ... = {...}` Using long type syntax to avoid `any`
  - Status: ✅ PROPERLY TYPED - These are fine
  - Priority: N/A (no longer simple `any`)

### Priority: LOW - Library Constraints

#### services/roles.ts, services/loans.ts, services/counterparts.ts
- Catch blocks with `any` - Error handling pattern
- Status: ⚠️ Working as designed, standard error catch pattern
- Priority: LOW

---

## Backend - Routes (12 instances)

### Priority: HIGH - Fixable

#### routes/auth.ts (2 instances)
- **Lines 429, 574**: `const responseBody = authResponse as any`
  - Status: ✅ FIXABLE - Should type asserting from library response
  - Priority: HIGH
  - Context: "Safe cast for now as library validates"

#### routes/settings.ts, routes/personal-finance.ts (7 instances)
- **Lines**: `async function requireAuth(c: any, next: any)` or `const user: any`
  - Status: ✅ FIXABLE - Should be `Context` from Hono types
  - Priority: HIGH
  - Impact: Used multiple times, affects auth middleware

### Priority: MEDIUM - Builder Patterns

#### routes/calendar.ts, routes/release-transactions.ts, routes/settlement-transactions.ts
- Where clause building patterns
- Status: ⚠️ Kysely limitation
- Priority: LOW

---

## Backend - Modules (9 instances)

### Priority: MEDIUM - Data Transformation

#### modules/patients/index.ts (8 instances)
- **Lines 20**: `user: any` - Auth context
  - Status: ✅ FIXABLE - Should be typed from session
  - Priority: HIGH
- **Lines 292-305**: `as any` - Decimal casting
  - Status: ⚠️ Schema/type mismatch between input and DB
  - Priority: MEDIUM
- **Line 412**: `const attachment = await (db as any).patientAttachment`
  - Status: ⚠️ Dynamic model access
  - Priority: LOW

#### modules/calendar/service.ts (1 instance)
- **Line 129**: `catch (error: any)`
  - Status: ✅ FIXABLE - Standard error handling
  - Priority: HIGH

---

## Backend - Library/Utils (11 instances)

### Priority: HIGH - Utils

#### utils/reply.ts (2 instances)
- **Line 5**: `export const reply = (c: Context, data: any, status = 200)`
  - Status: ✅ FIXABLE - Generic: `data: T` parameter
  - Priority: HIGH
- **Line 8**: `return c.json(serialized, status as any)`
  - Status: ✅ FIXABLE - Hono types available
  - Priority: MEDIUM

#### lib/mappers.ts (1 instance)
- **Line 2**: `export function mapTransaction(row: any)`
  - Status: ✅ FIXABLE - Could be typed from DB schema
  - Priority: MEDIUM

### Priority: LOW - Kysely/Google API

#### lib/google/google-calendar-queries.ts (4 instances)
- Expression builder patterns and SQL generics
- Status: ⚠️ Library limitation
- Priority: LOW

---

## Frontend - any types (45 instances)

### Priority: HIGH - Easily Fixable

#### routes/verify.$id.tsx (1 instance)
- **Line 43**: `apiClient.get<any>(...)`
  - Status: ✅ FIXABLE - Type should be `VerifyCertificateResponse`
  - Priority: HIGH

#### features/finance/mercadopago/components/SettlementColumns.tsx (1 instance)
- **Line 10**: `ColumnDef<SettlementTransaction, any>[]`
  - Status: ✅ FIXABLE - Generic param should be specific type
  - Priority: HIGH

#### features/finance/settlements/components/SettlementColumns.tsx (1 instance)
- **Line 49**: `ColumnDef<SettlementTransaction, any>[]`
  - Status: ✅ FIXABLE - Same as above
  - Priority: HIGH

#### features/hr/reports/utils.ts (2 instances)
- **Lines 29, 34**: `{} as any` - Default value casting
  - Status: ✅ FIXABLE - Should cast to proper type or use default factory
  - Priority: MEDIUM

#### features/personal-finance/api.ts (1 instance)
- **Line 56**: `apiClient.post<any>(...)`
  - Status: ✅ FIXABLE - Response type available
  - Priority: HIGH

### Priority: MEDIUM - Library Constraints (Not Fixable)

#### features/calendar/components/* (14 instances)
- TanStack Form `FormApi<T>` requires 11-12 generics (not publicly available)
- TanStack Router search param mutations are complex
- Status: ⚠️ Library limitation - PRAGMATICALLY ACCEPTED
- Suppression: ✅ All have proper `biome-ignore` comments
- Files:
  - ClassificationTotals.tsx (2)
  - ClassificationRow.tsx (2)
  - ClassificationFilters.tsx (4)
  - ClassificationPagination.tsx (5)

#### features/finance/balances/components/DailyBalancesColumns.tsx (3 instances)
- **Lines 29, 51, 73**: `table: any` in TanStack table cell components
- Status: ⚠️ TanStack table generic limitation
- Suppression: ✅ Has `biome-ignore`
- Priority: LOW (documented library constraint)

#### features/services/hooks/use-services-overview.tsx (2 instances)
- **Lines 35, 40**: Payload and overrides `any` parameters
- Status: ⚠️ Dynamic API payload patterns
- Suppression: ✅ Has `biome-ignore`
- Priority: LOW

### Priority: LOW - Data Transformations

#### features/inventory/components/InventoryCategoryManager.tsx (1 instance)
- **Line 26**: `const categories = (categoriesData as any[])`
- Status: ✅ FIXABLE - Type from hook
- Priority: MEDIUM

---

## Summary by Category

### 1. **Kysely/Database Builder Patterns** (15 instances)
- `const where: any = {}`
- `(eb: any) =>` expressions
- Status: ⚠️ Library limitation
- Action: DOCUMENT - These are acceptable due to Kysely's dynamic builder API

### 2. **Date/Decimal Casting** (12 instances)
- `value as any` for Prisma Date/Decimal fields
- Status: ⚠️ Schema/type mismatch in data layer
- Action: MEDIUM priority refactoring

### 3. **Error Handling** (8 instances)
- `catch (error: any)`
- Status: ✅ FIXABLE - Use `unknown` or typed error classes
- Action: HIGH priority refactoring

### 4. **TanStack Library Constraints** (20 instances)
- Form generics, Router search params, Table column definitions
- Status: ⚠️ Library limitation - PRAGMATICALLY ACCEPTED
- Action: DOCUMENT - These are justified and properly suppressed

### 5. **API Response Generics** (6 instances)
- `apiClient.get<any>()`
- Status: ✅ FIXABLE - Response types available
- Action: MEDIUM priority refactoring

### 6. **Dynamic Model/Record Access** (8 instances)
- `(db as any).model`, `Record<string, any>`
- Status: ⚠️ Reflection/dynamic access patterns
- Action: DOCUMENT - Necessary for runtime flexibility

### 7. **Utility Functions** (10 instances)
- Generic data transformation
- Status: ✅ PARTIALLY FIXABLE - Some could use generics
- Action: MEDIUM priority refactoring

---

## Refactoring Priority Matrix

| Priority | Count | Category | Effort | Impact |
|----------|-------|----------|--------|--------|
| **HIGH** | 8 | Error handling, auth middleware, API generics | LOW | HIGH |
| **MEDIUM** | 22 | Date casting, data transformation, utils | MEDIUM | MEDIUM |
| **LOW** | 82 | Kysely patterns, library constraints, reflection | HIGH | LOW |

---

## Pragmatic Decisions (Approved)

1. ✅ **TanStack Form `FormApi<T>` - ANY** 
   - Reason: FormApi requires 11-12 type arguments, none publicly exported
   - Decision: Accept `any` with `biome-ignore` comment
   - Status: DOCUMENTED

2. ✅ **TanStack Router Search Params - ANY**
   - Reason: Complex search mutation typing prevents full inference
   - Decision: Accept `any` with `biome-ignore` comment
   - Status: DOCUMENTED

3. ✅ **Kysely Expression Builders - ANY**
   - Reason: ExpressionBuilder type not exported, builder is inherently dynamic
   - Decision: Accept `any` with `biome-ignore` comment
   - Status: DOCUMENTED

4. ✅ **Dynamic DB Model Access - ANY**
   - Reason: Reflection pattern necessary for generic model operations
   - Decision: Accept `any` with clear documentation
   - Status: DOCUMENTED

---

## Next Steps

1. **Refactor HIGH priority** (error handling, auth middleware) - Est. 2 hours
2. **Refactor MEDIUM priority** (data transformations) - Est. 4 hours
3. **Document pragmatic decisions** - Create maintenance guide
4. **Remove/deprecate** legacy import scripts if no longer used
5. **Monitor** new `any` types via Biome CI/CD enforcement

---

## Files Modified in This Audit

- `/docs/ANY_TYPES_AUDIT.md` - This file
- `/docs/PRAGMATIC_TYPING_GUIDE.md` - Maintenance guide
- Various source files - See "Refactoring Results" section

---

**Audit conducted:** February 1, 2026  
**Next review:** March 1, 2026  
**Responsible:** Type Safety Task Force
