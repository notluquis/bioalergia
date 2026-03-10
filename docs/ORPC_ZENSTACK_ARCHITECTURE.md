# oRPC + Zenstack v3 Architecture

**Last Updated:** March 10, 2026  
**Status:** Production  
**Version:** oRPC v1.13.6 + Zenstack v3.4.4

## ⚠️ Key: Zenstack v3 is NOT Prisma

**Critical distinction:**
- **Zenstack v2:** Wrapper around Prisma, used `@prisma/client`
- **Zenstack v3:** Complete standalone ORM, auto-generated from `.zmodel` schema
- **This project:** Uses Zenstack v3 (NOT Prisma)

### What was removed:
```typescript
❌ DO NOT import from '@prisma/client'
❌ DO NOT use 'prisma generate'
```

### What to use instead:
```typescript
✅ import { db, authDb } from '@finanzas/db'  // Zenstack v3 ORM
✅ Use 'pnpm generate' in packages/db/        // Regenerate Zenstack types
```

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ Frontend (React 19 + TanStack Query)    │
│ • useQuery / useMutation                │
│ • createORPCClient + SuperJSONLink      │
│ • feature api.ts normalizes transport   │
└──────────────┬──────────────────────────┘
               │ HTTP(S) POST
               │ /api/orpc/calendar/rpc/*
               │ /api/orpc/dte-analytics/event-links/rpc/*
               │ /api/orpc/employees/rpc/*
               │ /api/orpc/inventory/rpc/*
               │ /api/orpc/roles/rpc/*
               │ /api/orpc/counterparts/rpc/*
               ▼
┌──────────────────────────────────────────────┐
│ Backend (Hono 4.12.5 + oRPC 1.13.6)          │
│                                              │
│ ├─ SuperJSONRPCHandler                       │
│ │  └─ Handles Date/BigInt/Special types      │
│ │                                            │
│ ├─ Calendar Router                           │
│ │  • /events/classify                        │
│ │  • /events/unclassified                    │
│ │  • /events/reclassify (jobs)               │
│ │  • /events/sync (async)                    │
│ │  • More...                                 │
│ │                                            │
│ ├─ DTE Event Links Router                    │
│ │  • /suggestions                            │
│ │  • /auto-link                              │
│ │  • /confirm-link                           │
│ │  • More...                                 │
│ │                                            │
│ ├─ Employees Router                          │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Inventory Router                          │
│ │  • /categories                             │
│ │  • /items                                  │
│ │  • /movements                              │
│ │                                            │
│ ├─ Roles Router                              │
│ │  • /permissions                            │
│ │  • /{id}/users                             │
│ │  • /mappings                               │
│ │                                            │
│ ├─ Counterparts Router                       │
│ │  • /suggestions                            │
│ │  • /unassigned-payout-accounts             │
│ │  • /{id}/summary                           │
│ │                                            │
│ └─ Service Layer                             │
│    └─ Use db/authDb from Zenstack             │
└──────────────┬───────────────────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Zenstack v3 ORM          │
    │ • db (public client)     │
    │ • authDb (+ permissions) │
    │ • kysely (raw SQL)       │
    └──────────────┬───────────┘
                   │
                   ▼
      ┌──────────────────────────┐
      │ PostgreSQL (Railway)     │
      └──────────────────────────┘
```

---

## Zenstack v3 ORM Usage

### 1. Available Clients

**From `@finanzas/db`:**

```typescript
import { db, authDb, kysely, schema } from '@finanzas/db'

// db: Public ORM client (no built-in access control)
const events = await db.event.findMany({ ... })

// authDb: Access-controlled client (respects @allow/@deny in schema)
const events = await authDb.event.findMany({ ... })

// kysely: Raw SQL queries (Kysely query builder)
const result = await kysely
  .selectFrom('Event')
  .select('*')
  .where('calendarId', '=', 'abc')
  .execute()

// schema: Complete ZModel schema definition
import { schema } from '@finanzas/db/schema'
```

### 2. ORM Methods (Generated by Zenstack)

All models have standard methods:
```typescript
db.event.findMany({ ... })      // Multiple records
db.event.findFirst({ ... })     // First matching record
db.event.findUnique({ ... })    // By primary key
db.event.count({ ... })         // Count records
db.event.create({ ... })        // Insert
db.event.update({ ... })        // Update
db.event.upsert({ ... })        // Insert or update
db.event.delete({ ... })        // Delete
```

### 3. Type Safety

All models are fully typed by Zenstack:
```typescript
import type { Event, Calendar, CalendarSyncLog } from '@finanzas/db'

const event: Event = await db.event.findUnique({ where: { id: 123 } })
// TypeScript knows all Event fields with correct types
```

---

## oRPC Pattern

### Core principle: JSON-RPC + OpenAPI

Each endpoint follows this pattern:

```typescript
const myEndpoint = requirePermission("Resource", "action")
  .route({
    method: "GET",              // HTTP method
    path: "/my-endpoint",       // Mounted under router prefix
    summary: "Endpoint description",
  })
  .input(inputSchema)           // Zod validation (request)
  .output(outputSchema)         // Zod validation (response)
  .handler(async ({ input, context }) => {
    // Handler implementation
    // - Access context.hono for Hono context
    // - Access context.user for authenticated user
    // - Use db/authDb from @finanzas/db
    return result               // Auto-serialized by SuperJSONRPCHandler
  })
```

---

## SuperJSONRPCHandler

### Why It's Needed

oRPC's standard handler can't serialize:
- ❌ `Date` objects
- ❌ `BigInt` values
- ❌ `Map` / `Set`
- ❌ Custom types

**Solution:** `SuperJSONRPCHandler` wraps FetchHandler + SuperJSON serializer

```typescript
import { SuperJSONRPCHandler } from './superjson'

export const calendarORPCHandler = new SuperJSONRPCHandler(
  calendarORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError("calendar.orpc", error, {})
      }),
    ],
    // ... other options
  }
)

// Automatically handles:
// ✅ Date → ISO string (transfer) → Date (client)
// ✅ BigInt → string (transfer) → BigInt (client)
// ✅ Decimal.js → string (transfer) → Decimal.js (client)
```

---

## Frontend Integration

### Setup

```typescript
import { createORPCClient } from "@orpc/client";
import { SuperJSONLink } from "./orpc";

const calendarORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const calendarORPCClient = createORPCClient<CalendarORPCClient>(
  calendarORPCLink,
  {
    path: ["api", "orpc", "calendar", "rpc"],
  },
);
```

TanStack Query stays one layer above that typed client. Feature `api.ts` files are the
normalization boundary: they call oRPC, validate with Zod where needed, and return UI/domain
shapes instead of raw transport envelopes.

### Usage

```typescript
// Query
const { data } = useQuery({
  queryKey: ["calendar", "classification-options"],
  queryFn: fetchClassificationOptions,
})

// Mutation with cache invalidation
const mutation = useMutation({
  mutationFn: () => classifyCalendarEvent({ ... }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["calendar", "unclassified"] })
  },
})
```

---

## Project Structure

```
apps/api/src/
├── orpc/
│   ├── calendar.ts
│   ├── dte-event-links.ts
│   ├── employees.ts
│   ├── inventory.ts
│   ├── roles.ts
│   ├── counterparts.ts
│   └── superjson.ts             ← SuperJSON serializer (custom)
│
├── services/
│   ├── calendar.ts              ← Calendar business logic
│   ├── clinical-series.ts       ← Series grouping logic
│   ├── dte-event-linking.ts     ← DTE matching logic
│   └── ... other services
│
├── lib/
│   ├── google-calendar-queries.ts   ← Query builders
│   ├── calendar-reclassify.ts       ← Classification logic
│   ├── superjson-config.ts          ← SuperJSON setup
│   └── ... other utilities
│
└── routes/
    ├── calendar.ts              ← Legacy file, not mounted in app.ts
    └── ... other REST routes
```

---

## Migration Timeline

| Date | Status | What Moved to oRPC |
|------|--------|-------------------|
| 2026-03-10 | ✅ Done | Calendar endpoints (all 13) |
| 2026-03-10 | ✅ Done | DTE Event Links (all 9) |
| 2026-03-10 | ✅ Done | Employees |
| 2026-03-10 | ✅ Done | Inventory |
| 2026-03-10 | ✅ Done | Roles |
| 2026-03-10 | ✅ Done | Counterparts |

---

## Common Mistakes to Avoid

❌ **DO NOT:**
```typescript
import { PrismaClient } from '@prisma/client'  // Zenstack v3 ≠ Prisma
import { db as prisma } from '@prisma/client'
prisma.event.findMany()                        // Wrong ORM
```

✅ **DO:**
```typescript
import { db } from '@finanzas/db'              // Zenstack v3
db.event.findMany()                            // Correct ORM
```

---

## Type Generation

When you modify `/packages/db/zenstack/schema.zmodel`:

```bash
# 1. Apply schema changes
cd packages/db

# 2. Generate types + migrations
pnpm generate

# 3. Review migration
cat zenstack/migrations/*/migration.sql

# 4. Apply to database
pnpm db:push

# 5. Rebuild backend/frontend
pnpm build
```

---

## Related Documentation

- [Zenstack v3 Docs](https://zenstack.io)
- [oRPC Docs](https://orpc.io)
- [Hono Docs](https://hono.dev)
- [PostgreSQL Dialects](https://zenstack.io/docs/orms)
