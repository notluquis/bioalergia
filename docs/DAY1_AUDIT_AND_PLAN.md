# DAY 1 AUDIT: All `any` Types Detected & Refactoring Plan

**Date:** February 1, 2026  
**Methodology:** Grep search + manual verification  
**Based on:** Official Zenstack v3, Hono documentation

---

## 📍 IMPORTANT: Zenstack v3 Type System

This project uses **Zenstack v3** with `ZenStackClient` (NOT Prisma Client directly).

### Type Generation Pattern:
```typescript
// Zenstack generates types in @finanzas/db/zenstack/input.ts
// Example for Role model:

import type { RoleCreateArgs, RoleUpdateArgs, RoleWhereInput } from '@finanzas/db'

// Extract data type using helper pattern:
type RoleCreateInput = NonNullable<RoleCreateArgs['data']>
type RoleUpdateInput = NonNullable<RoleUpdateArgs['data']>
```

### Available Type Patterns:
- `${Model}CreateArgs['data']` - Create input
- `${Model}UpdateArgs['data']` - Update input
- `${Model}WhereInput` - Where clause
- `${Model}FindManyArgs` - Find many options
- `${Model}GetPayload<{}>` - Query result type

## 📊 SUMMARY

- **Total `any` instances found:** 47
- **Files affected:** 15
- **Priority distribution:** CRITICAL=22 | HIGH=15 | MEDIUM=10

---

## 🎯 REFACTORING ROADMAP

### CRITICAL Priority (22 instances) - Week 1
These are in business logic and must be fixed first

#### 1. **Service CRUD Functions** (10 instances)
Files: `services/services.ts`, `services/roles.ts`, `services/loans.ts`, `services/counterparts.ts`, `services/daily-production-balances.ts`

**Pattern (Zenstack v3):**
```typescript
// BEFORE (any - type checking disabled)
export async function createService(data: any) { ... }
export async function updateService(id: number, data: any) { ... }

// AFTER (type-safe with Zenstack v3)
import type { ServiceCreateArgs, ServiceUpdateArgs } from "@finanzas/db"

type ServiceCreateInput = NonNullable<ServiceCreateArgs['data']>
type ServiceUpdateInput = NonNullable<ServiceUpdateArgs['data']>

export async function createService(data: ServiceCreateInput) { ... }
export async function updateService(id: number, data: ServiceUpdateInput) { ... }
```

**Instances:**
- `services/services.ts:30` - `createService(data: any)`
- `services/services.ts:44` - `updateService(id: number, data: any)`
- `services/roles.ts:17` - `createRole(data: any)`
- `services/roles.ts:30` - `updateRole(id: number, data: any)`
- `services/loans.ts:24` - `createLoan(data: any)`
- `services/loans.ts:34` - `updateLoan(id: number, data: any)`
- `services/loans.ts:51` - `createLoanSchedule(data: any)`
- `services/loans.ts:58` - `updateLoanSchedule(id: number, data: any)`
- `services/counterparts.ts:31` - `createCounterpart(data: any)`
- `services/counterparts.ts:79` - `updateCounterpart(id: number, data: any)`

**Refactoring Effort:** 2-3 hours  
**Complexity:** Low (straightforward Zenstack type mapping)  
**Impact:** HIGH (eliminates `any` from entire CRUD layer)

---

#### 2. **Error Handlers** (5 instances)
Files: `services/roles.ts`, `routes/roles.ts`

**Pattern:**
```typescript
// BEFORE (any - error properties unchecked)
catch (e: any) {
  logger.error("Error:", e.message)
}

// AFTER (type-safe with discriminated union)
import { ServiceError, parseError } from "@/lib/service-types"

catch (error) {
  const err = parseError(error)
  if (err.type === "prisma_error") {
    logger.error("Prisma error:", err.code, err.message)
  }
}
```

**Instances:**
- `services/roles.ts:146` - `catch (e: any)`
- `routes/roles.ts:62` - `catch (e: any)`
- `routes/roles.ts:88` - `catch (e: any)`
- `routes/roles.ts:139` - `catch (e: any)`
- `services/timesheets.ts:339,341` - `workDate as any`, `startTime as any`

**Refactoring Effort:** 1-2 hours  
**Complexity:** Low (use parseError helper)  
**Impact:** HIGH (prevents error property access bugs)

---

#### 3. **Transaction Query Builders** (7 instances)
File: `services/transactions.ts`

**Pattern:**
```typescript
// BEFORE (any - loses column type checking)
.where((eb: any) => eb.and([...]))
const from as any  // date type lost

// AFTER (type-safe with column types)
.where((eb) => eb.and([...]))  // eb type inferred correctly
const from: Date | undefined = ...
```

**Instances:**
- `services/transactions.ts:66` - `const where: any = {}`
- `services/transactions.ts:230` - `from as any`
- `services/transactions.ts:234` - `to as any`
- `services/transactions.ts:288` - `(eb: any) =>`
- `services/transactions.ts:300,302` - `from as any`, `to as any`
- `services/transactions.ts:336` - `(eb: any) =>`

**Refactoring Effort:** 2-3 hours  
**Complexity:** Medium (understand Kysely ExpressionBuilder)  
**Impact:** HIGH (enables Kysely type inference)

---

### HIGH Priority (15 instances) - Week 1-2

#### 4. **Response Type Wrappers** (8 instances)
Files: `services/transactions.ts:429`, `services/transactions.ts:462`, `services/mercadopago/mappers.ts`

**Pattern:**
```typescript
// BEFORE (any - loses result type)
.map((t: any) => ({ amount: t.amount }))

// AFTER (type-safe mapping)
.map((t: Transaction) => ({ amount: t.amount }))
```

**Instances:**
- `services/transactions.ts:429` - `map((t: any) => ...)`
- `services/transactions.ts:462` - `map((m: any) => ...)`
- `services/mercadopago/mappers.ts:20` - `parseDecimal(val: string): any`
- `services/mercadopago/mappers.ts:35` - `parseJson(val: any): any`
- `services/mercadopago/mappers.ts:51` - `mapRowToSettlementTransaction(row: any)`
- `services/mercadopago/mappers.ts:117` - `mapRowToReleaseTransaction(row: any)`

**Refactoring Effort:** 1-2 hours  
**Complexity:** Low-Medium (create proper input types)  
**Impact:** HIGH (enables result type inference)

---

#### 5. **Backup Service Reflection** (5 instances)
File: `services/backups.ts`

**Pattern:**
```typescript
// BEFORE (any - needed for dynamic model access)
const batch: any[] = await modelDelegate.findMany(...)
const history: any[] = []
const modelDelegate = (db as any)[model]

// AFTER (type-safe with generic)
const batch: T[] = await modelDelegate.findMany(...)
const history: BackupRecord[] = []
const modelDelegate = db[model as keyof typeof db]
```

**Instances:**
- `services/backups.ts:138,151,315,317,460` - Multiple `any` in dynamic model reflection

**Refactoring Effort:** 2-3 hours  
**Complexity:** High (generic model reflection)  
**Impact:** MEDIUM (reflection pattern is inherently complex)

---

#### 6. **Notification Service** (1 instance, but complex)
File: `services/notifications.ts:15`

**Pattern:**
```typescript
// BEFORE (any - loses PushSubscription typing)
subscription: { endpoint: string; keys: any }

// AFTER (type-safe with PushSubscriptionJSON)
import type { PushSubscriptionJSON } from "web-push"
subscription: PushSubscriptionJSON
```

**Refactoring Effort:** 1 hour  
**Complexity:** Low (use official type)  
**Impact:** MEDIUM

---

### MEDIUM Priority (10 instances) - Week 2-3

#### 7. **MercadoPago Ingestion**
File: `services/mercadopago/ingest.ts:74`

```typescript
const cleanRow: any = {}  // Should be SettlementRow or similar
```

**Refactoring Effort:** 1-2 hours

---

## 📋 IMPLEMENTATION ADDRESS ORDER

### Phase 1: Foundation (TODAY)
1. ✅ Create `lib/service-types.ts` with base types
2. Create migration guide with before/after examples
3. Prepare refactoring template

### Phase 2: CRITICAL Services (Tomorrow)
1. `services/services.ts` - CRUD functions (10 instances)
2. `services/roles.ts` - Error handlers (2 instances)
3. `routes/roles.ts` - Error handlers (3 instances)
4. Test & build validation

### Phase 3: Query Builders (Day 3)
1. `services/transactions.ts` - Kysely builders (7 instances)
2. `services/transactions.ts` - Response mappers (2 instances)
3. Test analytics queries

### Phase 4: Mappers & Complex Types (Day 4)
1. `services/mercadopago/mappers.ts` - Response mapping (4 instances)
2. `services/backups.ts` - Dynamic reflection (5 instances)
3. Test backup & restore

---

## 🛠️ CONCRETE REFACTORING EXAMPLES

### Example 1: CRUD Service Functions

**File:** `services/services.ts`

**BEFORE:**
```typescript
// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
export async function createService(data: any) {
  return await db.service.create({
    data,
    include: { counterpart: true }
  })
}
```

**AFTER (Zenstack v3):**
```typescript
import type { ServiceCreateArgs, ServiceUpdateArgs } from "@finanzas/db"

type ServiceCreateInput = NonNullable<ServiceCreateArgs['data']>
type ServiceUpdateInput = NonNullable<ServiceUpdateArgs['data']>

export async function createService(data: ServiceCreateInput) {
  return await db.service.create({
    data,
    include: { counterpart: true }
  })
}

export async function updateService(id: number, data: ServiceUpdateInput) {
  return await db.service.update({
    where: { id },
    data,
    include: { counterpart: true }
  })
}
```

**CLI Check:**
```bash
# Verify Zenstack types are available
grep -r "ServiceCreateArgs" packages/db/src/zenstack/input.ts

# Build to verify types work
cd apps/api && pnpm build
```

---

### Example 2: Error Handler

**File:** `services/roles.ts`

**BEFORE:**
```typescript
try {
  await db.role.create({ data })
} catch (e: any) {
  logger.error("Error creating role:", e.message)
  throw e
}
```

**AFTER (Zenstack v3 with lib/service-types.ts):**
```typescript
import { parseError, isDbError } from "@/lib/service-types"

try {
  await db.role.create({ data })
} catch (error) {
  const err = parseError(error)
  
  if (isDbError(err)) {
    logger.error("Database error:", {
      code: err.code,
      message: err.message,
    })
  } else {
    logger.error("Error creating role:", err.type, err.message)
  }
  
  throw error  // re-throw original
}
```

---

### Example 3: Kysely Query Builder

**File:** `services/transactions.ts`

**BEFORE:**
```typescript
const where: any = {}
if (from) where.transactionDate = { ">=": from as any }
query = query.where((eb: any) => eb.and([...]))
```

**AFTER:**
```typescript
interface TransactionWhere {
  transactionDate?: { ">=": Date } | { "<=": Date }
}

const where: TransactionWhere = {}
if (from && from instanceof Date) {
  where.transactionDate = { ">=": from }
}
// No `as any` - Kysely infers types correctly
```

---

## 📚 RESOURCES & REFERENCES

### Official Documentation Used:
1. **Zenstack Schema & Type Generation**
   - File: `/packages/db/zenstack/schema.zmodel`
   - Generated types: `/packages/db/zenstack/~schema.prisma`
   - Prisma Client: `@prisma/client`

2. **Prisma Input Types**
   - Reference: `Prisma.ModelCreateInput`, `Prisma.ModelUpdateInput`
   - Listed in generated schema

3. **Hono Middleware**
   - Type: `createMiddleware<Env>`
   - Variables: `c.var` and `c.set()`

4. **Kysely Query Builder**
   - ExpressionBuilder typing
   - Where clause composition

---

## ✅ VALIDATION CHECKLIST

Before marking as complete:
- [ ] All types compile (no TypeScript errors)
- [ ] All `any` replacements use official types
- [ ] Tests pass (if applicable)
- [ ] No `biome-ignore` comments added (types are proper)
- [ ] Documentation updated with migration pattern
- [ ] Similar patterns found and fixed in other files

---

## 📝 NOTES FOR IMPLEMENTATION

1. **Always verify Prisma types exist** before refactoring
   - Generate schema if needed: `cd packages/db && pnpm generate`

2. **Use existing utility functions**
   - Error parsing: `parseError()` from `lib/service-types.ts`
   - Response building: `successResponse()`, `errorResponse()`

3. **TypeScript compiler is your friend**
   - TS will tell you exactly what type should be
   - Red squiggles = missing types

4. **Test with database operations**
   - Create test records to verify types work
   - Run actual queries, not just type checks

5. **Commit frequently**
   - One file at a time
   - Each commit: "refactor: remove any type from service X"

---

## 🎯 Success Metrics

After completing this 4-phase refactoring:

| Metric | Before | After |
|--------|--------|-------|
| Total `any` instances | 47 | ~15 |
| CRITICAL `any` | 22 | 0 |
| Services typed | 0% | 100% |
| Error handlers typed | 0% | 100% |
| Biome errors | 33 | ~20 |
| Build time | - | No regression |
| Type coverage | - | 95%+ |

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Status:** READY FOR PHASE 1 IMPLEMENTATION
