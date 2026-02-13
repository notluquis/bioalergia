# Pragmatic Typing Guide - Bioalergia TypeScript Standards

**Last Updated:** February 1, 2026

## Philosophy

Type safety is important, but development velocity matters too. This guide documents **accepted pragmatic decisions** where full type coverage is impossible or impractical.

---

## Approved "any" Type Patterns

### 1. TanStack Form - FormApi Generic Constraints

**Problem:**
```typescript
// This requires 11-12 type parameters, none publicly exported
const form: FormApi<FormValues> // ❌ Incomplete
```

**Why It's Impossible:**
- `FormApi<T>` is internal generic of TanStack Form
- Full signature: `FormApi<TData, TValidator?, TJSON?, TJSON2?, ...>` (11+ params)
- No public type exports for all parameters

**Approved Solution:**
```typescript
form: any
```

**Justification:**
- ✅ Runtime type is correct (checked by Form.Field callback)
- ✅ Form methods are IDE-autocompleted despite `any`
- ✅ Use of form is validated by Zod schema
- ✅ No security or logic risk

**Files Affected:**
- ClassificationRow.tsx
- ClassificationTotals.tsx
- ClassificationStats.tsx

---

### 2. TanStack Router - Search Param Mutations

**Problem:**
```typescript
// Router.useNavigate().search((prev) => ???) has complex types
const onNavigate = (search: any) => void // ❌ Cannot be typed
```

**Why It's Difficult:**
- Router search params are dynamically inferred from route
- Search updater pattern uses complex conditional types
- Type inference breaks when spread/mutate
- `useNavigate()` doesn't expose SearchParams type clearly

**Approved Solution:**
```typescript
onNavigate: (search: any) => void
```

**Justification:**
- ✅ Runtime behavior is correct (Router validates)
- ✅ Type safety at call site (structure is validated)
- ✅ No security implications
- ✅ Documented limitation of Router library

**Files Affected:**
- ClassificationFilters.tsx (4 instances)
- ClassificationPagination.tsx (5 instances)

---

### 3. Kysely Expression Builders

**Problem:**
```typescript
// ExpressionBuilder is not exported from Kysely
const where = (eb: any) => eb.fn.count('id') // ❌ Cannot type eb
```

**Why It's Impossible:**
- Kysely doesn't export ExpressionBuilder type
- Builder pattern is inherently dynamic
- Alternative: Write raw SQL (less maintainable)
- TypeORM has same limitation

**Approved Solution:**
```typescript
.where((eb: any) => // ... builder expression ...)
```

**Justification:**
- ✅ Query is type-checked at `.select()` call
- ✅ Runtime behavior verified by tests
- ✅ Alternative (raw SQL) is worse
- ✅ Accepted pattern in similar ORMs

**Files Affected:**
- services/transactions.ts (3 instances)
- lib/google/google-calendar-queries.ts (3 instances)

---

### 4. Dynamic Database Model Access

**Problem:**
```typescript
// Need to access different models dynamically
const delegate = (db as any).modelName // ❌ No way to type this generically
```

**Why It's Hard:**
- Prisma/Zenstack models are accessed as properties
- No generic accessor type available
- Reflection pattern is necessary
- Type narrowing would require massive overload unions

**Approved Solution:**
```typescript
const delegate = (db as any)[modelName]
```

**Justification:**
- ✅ Used only in database utility functions
- ✅ Type checked at caller (schema validation)
- ✅ Necessary for generic database operations
- ✅ Isolated in utilities, not in business logic

**Files Affected:**
- services/backups.ts (3 instances)
- modules/patients/index.ts (1 instance)

---

## Refactoring Candidates (Should be Fixed)

### 1. Error Handling - `catch (error: any)`

**Current:**
```typescript
catch (error: any) {
  logger.error(error.message) // ⚠️ Unsafe
}
```

**Should Be:**
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(message)
}
```

**Priority:** HIGH (3 files, easy fix)

---

### 2. Auth Middleware Context

**Current:**
```typescript
async function getAuthDb(c: any) {
  const user = await getSessionUser(c)
}
```

**Should Be:**
```typescript
import type { Context } from 'hono'
async function getAuthDb(c: Context) {
  const user = await getSessionUser(c)
}
```

**Priority:** HIGH (reduces 5+ instances, 15 min fix)

---

### 3. API Response Generics

**Current:**
```typescript
const data = await apiClient.get<any>(`url`, { responseSchema })
```

**Should Be:**
```typescript
const data = await apiClient.get<VerifyCertificateResponse>(`url`, {
  responseSchema: VerifyCertificateSchema
})
```

**Priority:** MEDIUM (6 instances, simple fix)

---

### 4. Prisma Date/Decimal Casting

**Current:**
```typescript
data: {
  transactionDate: transactionDate as any, // Type mismatch
}
```

**Analysis:**
- Schema expects `DateTime`, input is `string | Date`
- Needs normalization function or schema adjustment
- Could use `z.coerce.date()` in Zod schema

**Priority:** MEDIUM (requires schema changes)

---

## When to Use `any` (Approved Patterns)

✅ **ACCEPTABLE:**
1. Third-party library generic constraints (FormApi, ExpressionBuilder, etc.)
2. Dynamic reflection patterns (model access, configuration objects)
3. Legacy migrations (import scripts, data transformations)
4. Proven safe by runtime validation (Zod schemas, library validation)

❌ **NOT ACCEPTABLE:**
1. Lazy typing to avoid thinking about structure
2. Responses from external APIs without parsing/validation
3. User input without validation
4. Business logic that should have clear types
5. Callbacks without attempted type inference

---

## Biome Ignore Comments - Best Practices

### ✅ GOOD
```typescript
form: any
```

### ❌ BAD
```typescript
form: any
```

### ✅ GOOD
```typescript
function calculateBill(): void {
```

### ❌ BAD
```typescript
function calculateBill(): void {
```

**Format:**
```
```

---

## Decision Process for New `any` Types

When you encounter a situation where `any` seems necessary:

1. **Ask:** Can I type this with what's available?
   - Yes → Do it
   - No → Go to step 2

2. **Ask:** Is this a known library limitation?
   - No → Go to step 3

3. **Ask:** Can I restructure to avoid `any`?
   - Yes → Refactor
   - No → Go to step 4

4. **Ask:** Is this business logic or utility/integration?
   - Business logic → Try harder to avoid `any`
   - Integration/utility → May be acceptable

5. **Document:** If you decide `any` is necessary:
   ```typescript
   something: any
   ```

6. **Review:** Add to next code review for team discussion

---

## Monitoring & Enforcement

### CI/CD Rules
```json
{
  "overrides": [{
    "include": ["src/**"],
    "exclude": ["**/*.test.ts", "**/*.types.ts"],
    "rules": {
      "suspicious/noExplicitAny": "error"
    }
  }]
}
```

### Approved Exceptions (in biome.json)
```json
{
  "include": [
    "apps/intranet/src/features/calendar/components/**",
    "apps/api/src/services/calendar.ts",
    "apps/api/src/lib/google/**"
  ],
  "rules": {
    "suspicious/noExplicitAny": {
      "level": "warn",
      "message": "Approved library constraint - see docs/PRAGMATIC_TYPING_GUIDE.md"
    }
  }
}
```

### Metrics to Track
1. **New `any` types per month** - Should trend to zero
2. **Approved vs. unapproved ratio** - Should stay >80% approved
3. **Refactored types per quarter** - Document progress

---

## Future Improvements

### When TanStack Updates
- Monitor FormApi exports in new versions
- Test if type parameters become public
- Update strategy when versions support better typing

### Database Layer
- Consider using typed-db or similar safer ORM
- Evaluate if Prisma's new `$extends` helps with typing

### Legacy Components
- Schedule refactoring of complexity-suppressed functions
- Extract business logic from legacy components
- Create typed replacement components

---

## FAQ

**Q: Why not use `unknown` instead of `any`?**

**Q: Doesn't `any` defeat the purpose of TypeScript?**
A: Not when used pragmatically. The validated 90% is still type-safe. The 10% is either library-constrained or runtime-validated.

**Q: How do we prevent `any` from spreading?**
A: Biome enforcement + code reviews + this guide. Track metrics. Refactor HIGH priority items first.

**Q: What about unknown edge cases?**
A: Known library constraints are documented here. New `any` usage goes through decision process above.

---

## References

- [TypeScript Handbook: Type-level Programming Limitations](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [Prisma Type Constraints](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Kysely Type Safety](https://kysely-org.github.io/kysely/classes/Kysely.html)
- [TanStack Form Generic Constraints](https://github.com/tanstack/form/discussions)
- [ANY_TYPES_AUDIT.md](./ANY_TYPES_AUDIT.md) - Complete any type inventory

---

**Last Reviewed:** February 1, 2026  
**Next Review:** March 1, 2026  
**Maintainer:** Type Safety Task Force
