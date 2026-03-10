# oRPC Type Safety Strategy
**Date:** March 10, 2026 | **Status:** ESTABLISHED | **Context:** Bioalergia Monorepo

## Purpose

This document explains the intentional type safety patterns used in the oRPC migration for bioalergia's frontend (Intranet) and backend (API) communication layer.

---

## Architecture: Frontend → oRPC Client → Backend

```
App Code ↓ [Type-safe via Zod]
   ↓
oRPC Client (finance/orpc.ts) ↓ [SuperJSONLink serialization]
   ↓
HTTP/fetch ↓ [unknown[], Decimal, Date serialization]
   ↓
Backend oRPC Routes ↓ [Unknown types at boundary]
   ↓
Zod Validation + Database ↓ [Type-safe queries]
```

### Type Safety Boundaries

1. **Frontend Consumption** ✅ STRICT
   - oRPC returns validated data
   - Consumer uses `schema.parse(data)` before use
   - Result is strictly typed

2. **Serialization Layer** ✅ SAFE
   - SuperJSONLink handles Decimal, Date, SIGINT
   - Transparent to application code
   - No type loss (round-trip serialization verified)

3. **oRPC Interface** ⚠️ LOOSE BUT INTENTIONAL
   - `data: unknown[]` reflects API flexibility
   - Each consumer validates what they expect
   - Prevents premature type narrowing at boundary

4. **Backend** ✅ STRICT
   - All database operations type-safe via Zenstack
   - Zod schemas validate before persistence
   - No `any` in core business logic

---

## Pattern 1: Discriminated Unions (IDEAL)

### Use Case
When there's a clear "success" vs "error" path

### Example: Auth Flows
```typescript
// Feature: PasskeyRegistrationResult (useOnboardingForm.ts)
type PasskeyRegistrationResult = 
  | { type: "success"; options: PublicKeyCredentialCreationOptionsJSON }
  | { type: "error"; status: "error"; message?: string }

// Usage: Type-safe narrowing
if (result.type === "error") {
  throw new Error(result.message)  // ✅ Only .message available
} else {
  startRegistration({ optionsJSON: result.options })  // ✅ Only .options available
}
```

### Benefits
- ✅ Perfect TypeScript narrowing
- ✅ No casting needed
- ✅ Compiler enforces exhaustiveness

### Files Using This
- `apps/intranet/src/features/auth/orpc.ts` (11 methods)
- `apps/intranet/src/features/calendar/orpc.ts` (partial)
- `apps/intranet/src/pages/onboarding/hooks/useOnboardingForm.ts`

---

## Pattern 2: Boundary Validation (PRAGMATIC)

### Use Case
When response structure varies based on query parameters or business rules

### Example: Finance Transactions
```typescript
// Frontend oRPC client definition (loose type)
transactionsList: () => Promise<{
  data: unknown[]  // ← Generic because different queries return different data
  meta?: { page: number; total: number }
  status: "ok"
}>

// Frontend consumer (type-safe after validation)
const response = await financeORPCClient.transactionsList()
const transactions = TransactionListSchema.parse(response.data)  // ✅ Strict after parse
```

### Why This Pattern Exists
1. **Backend Flexibility**: API returns generic objects based on context
2. **Serialization**: Decimal/Date types require SuperJSON round-trip
3. **Consumer Choice**: Each consumer validates according to their needs
4. **Decoupling**: oRPC layer doesn't enforce specific types

### Validation Strategy
```typescript
// Consumer-side validation (apps/intranet/src/features/finance/api.ts)
export async function fetchTransactions() {
  const response = await financeORPCClient.transactionsList()
  
  // Moment of type narrowing
  const validated = TransactionSchema.array().parse(response.data)
  
  return validated  // ✅ Now strictly typed as Transaction[]
}
```

### When This Is Safe
✅ SuperJSONLink guarantees serialization integrity  
✅ Zod schema validates at consumer boundary  
✅ Backend enforces constraints at insert/update  
✅ Type system narrows after validation  

### When This Would Be Problematic
❌ If consumers forgot to validate (should catch in code review)  
❌ If schema and backend diverge (should fail in tests)  
❌ If bypassing validation with `as any` (linting prevents this)  

### Files Using This
- `apps/intranet/src/features/finance/api.ts` (6 endpoints with loose data)
- `apps/intranet/src/features/finance/orpc.ts` (23 methods, `data: unknown[]`)
- Mercado Pago sync reports

---

## Pattern 3: Schema Pass through (ACCEPTABLE)

### Use Case
When database returns extra columns or optional relations

### Example: Person with Optional Relations
```typescript
/**
 * .passthrough() allows database to return:
 * - Extra computed columns
 * - Optional relations (employee, user, counterpart)
 * - Future schema additions without code changes
 *
 * Safe because: only defined fields are accessed in code
 */
const PersonWithExtrasSchema = z.object({
  id: z.number(),
  names: z.string(),
  employee: z.unknown().nullable().optional(),
  user: z.unknown().nullable().optional(),
  // ... other fields
}).passthrough()  // ✅ Extra fields silently ignored

// Usage: Only defined fields accessible
const person = PersonWithExtrasSchema.parse(dbResult)
console.log(person.names)      // ✅ OK
console.log(person.unknownCol) // ❌ TS error - not defined
```

### Why Pass through Is Needed
1. **Prisma Behavior**: `include: {employee: true}` adds extra fields
2. **Future-Proofing**: New DB columns don't break parsing
3. **DRY**: Don't repeat schema definitions for every combination

### Risk Mitigation
- Extra fields cannot be accidentally accessed
- Only explicit fields in schema are available
- TypeScript enforces field access

### Files Using This
Frontend:
- `apps/intranet/src/features/people/api.ts` (2 schemas) ✅ Documented

Backend (out of scope for this audit):
- `apps/api/src/orpc/personal-finance.ts`
- `apps/api/src/orpc/services.ts`
- Other backend routes

---

## Type Safety Audit Results

| Component | Pattern | Status | Justification |
|-----------|---------|--------|---------------|
| Auth flows (11 methods) | Discriminated Union | ✅ Perfect | Clear success/error paths |
| Calendar ops (15 methods) | Discriminated Union + Strict | ✅ Perfect | Well-typed responses |
| Doctoralia (11 methods) | Strict Response Types | ✅ Perfect | Tightly coupled API |
| Data import (2 methods) | Strict Response Types | ✅ Perfect | Simple CRUD operations |
| Finance (23 methods) | Boundary Validation | ✅ Acceptable | Flexible API design |
| People schema | Pass through | ✅ Documented | Optional relations handling |

---

## Guidelines for New oRPC Endpoints

### When Adding New Frontend Endpoints

**Step 1: Define Clear Return Type**
```typescript
// Choose ONE pattern based on your use case

// Pattern A: Discriminated Union (for divergent paths)
type MyResponse = 
  | { status: "ok"; data: MyData }
  | { status: "error"; message: string }

// Pattern B: Strict Response (for simple cases)
type MyResponse = {
  data: MyData
  status: "ok"
}

// Pattern C: Boundary Validation (for flexible API)
type MyResponse = {
  data: unknown
  status: "ok"
}
```

**Step 2: Update Frontend oRPC Client**
```typescript
type MyORPCClient = {
  myMethod: () => Promise<MyResponse>
}
```

**Step 3: Consumer Validates if Using Pattern C**
```typescript
const response = await myClient.myMethod()
const validated = MyDataSchema.parse(response.data)  // ✅ Narrow to strict type
```

---

## ErrorHandling Strategy

### Current Practice
All error handlers use `instanceof Error` checks:

```typescript
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data)
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500)
  }
  return new ApiError("Error inesperado", 500, error)
}
```

### Why NOT `catch (error: any)`
- `any` bypasses TypeScript checking
- `unknown` enforces narrowing via type guards
- Better handles non-Error objects thrown (rare but real)

### Rule
✅ Always use `unknown` in error handlers  
✅ Type-narrow with `instanceof` or `typeof` checks  
❌ Never use `catch (error: any)`

---

## Validation Flow Example

### Complete Type Journey: Finance Transaction

```
Backend returns: { id: 1, amount: "150.50", date: "2026-03-10T12:00:00Z" }
                  ↓ (SuperJSON deserialization)
oRPC response: { data: [{ id: 1, amount: Decimal(150.50), date: Date(...) }] }
                  ↓ (unknown[] at boundary)
Consumer receives: { data: unknown[] }
                  ↓ (Zod validation - CRITICAL MOMENT)
const validated = TransactionSchema.parse(response.data)
                  ↓
Result: { id: 1; amount: Decimal; date: Date; }[]
        (100% type-safe, compiler enforced)
                  ↓
Application code: Uses transaction.amount with full IDE autocomplete
```

At each step, TypeScript knows the precise type or requires validation.

---

## Best Practices Summary

### ✅ DO

1. Use discriminated unions for branching logic
2. Use boundary validation for flexible APIs
3. Document `.passthrough()` usage with JSDoc
4. Validate with Zod before using unknown data
5. Use `instanceof` to narrow error types
6. Keep SuperJSONLink configuration consistent

### ❌ DON'T

1. Use `any` to bypass type system
2. Access `unknown` properties without validation
3. Assume API response structure without parsing
4. Mix multiple validation libraries
5. Use `as any` casts instead of proper types
6. Return unvalidated data from API consume functions

---

## Testing Strategy

### Type-Level Tests
- TypeScript compiler (`pnpm type-check`) ✅ Runs in CI
- Discriminated union exhaustiveness checking
- Schema inference validation

### Runtime Tests
- Zod schema parsing with invalid data
- SuperJSON round-trip serialization
- Error handler type narrowing

### Example Test
```typescript
// Verify discriminated union exhaustiveness
const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${x}`)
}

function handleResult(result: PasskeyRegistrationResult) {
  if (result.type === "success") {
    startRegistration({ optionsJSON: result.options })
  } else if (result.type === "error") {
    showError(result.message)
  } else {
    assertNever(result)  // ✅ TS error if new union member added
  }
}
```

---

## References

- [Zod Discriminated Unions](https://v3.zod.dev/) 
- [PRAGMATIC_TYPING_GUIDE.md](./PRAGMATIC_TYPING_GUIDE.md) - Approved `any` patterns
- [oRPC Documentation](https://github.com/unizhao/orpc)
- [SuperJSON Guide](https://github.com/blitz-js/superjson)

---

## Document Version History

| Date | Changes |
|------|---------|
| March 10, 2026 | Initial audit and strategy documentation |

## Next Review

- Q2 2026: Evaluate if any new loose types can be tightened
- Monitor: New oRPC endpoints follow guidelines
- Consider: Stricter Zod schemas for high-risk domains (auth, finance)

