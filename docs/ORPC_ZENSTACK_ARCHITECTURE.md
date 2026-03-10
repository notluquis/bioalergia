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
               │ /api/orpc/auth/rpc/*
               │ /api/orpc/csv-upload/rpc/*
               │ /api/orpc/calendar/rpc/*
               │ /api/orpc/dte/rpc/*
               │ /api/orpc/dte-analytics/rpc/*
               │ /api/orpc/dte-analytics/event-links/rpc/*
               │ /api/orpc/doctoralia/rpc/*
               │ /api/orpc/employees/rpc/*
               │ /api/orpc/expenses/rpc/*
               │ /api/orpc/haulmer/rpc/*
               │ /api/orpc/integrations/rpc/*
               │ /api/orpc/inventory/rpc/*
               │ /api/orpc/mercadopago/rpc/*
               │ /api/orpc/roles/rpc/*
               │ /api/orpc/counterparts/rpc/*
               │ /api/orpc/finance/rpc/*
               │ /api/orpc/users/rpc/*
               │ /api/orpc/people/rpc/*
               │ /api/orpc/patients/rpc/*
               │ /api/orpc/personal-finance/rpc/*
               │ /api/orpc/settings/rpc/*
               │ /api/orpc/notifications/rpc/*
               │ /api/orpc/services/rpc/*
               │ /api/orpc/supplies/rpc/*
               │ /api/orpc/timesheets/rpc/*
               │ /api/orpc/production-balances/rpc/*
               │ /api/orpc/balances/rpc/*
               │ /api/orpc/release-transactions/rpc/*
               │ /api/orpc/settlement-transactions/rpc/*
               │ /api/orpc/backups/rpc/*
               │ /api/orpc/transactions-insights/rpc/*
               ▼
┌──────────────────────────────────────────────┐
│ Backend (Hono 4.12.5 + oRPC 1.13.6)          │
│                                              │
│ ├─ SuperJSONRPCHandler                       │
│ │  └─ Handles Date/BigInt/Special types      │
│ │                                            │
│ ├─ Auth Router                               │
│ │  • /login                                  │
│ │  • /login/mfa                              │
│ │  • /me/session                             │
│ │  • /mfa/*                                  │
│ │  • /passkey/*                              │
│ │                                            │
│ ├─ Calendar Router                           │
│ │  • /events/classify                        │
│ │  • /events/unclassified                    │
│ │  • /events/reclassify (jobs)               │
│ │  • /events/sync (async)                    │
│ │  • More...                                 │
│ │                                            │
│ ├─ CSV Upload Router                         │
│ │  • /preview                                │
│ │  • /import                                 │
│ │                                            │
│ ├─ DTE Sync Router                           │
│ │  • /sync-history                           │
│ │  • /sync                                   │
│ │                                            │
│ ├─ Doctoralia Router                         │
│ │  • /status                                 │
│ │  • /facilities                             │
│ │  • /calendar/appointments                  │
│ │  • /sync                                   │
│ │  • OAuth callbacks/webhooks siguen REST    │
│ │                                            │
│ ├─ DTE Event Links Router                    │
│ │  • /suggestions                            │
│ │  • /auto-link                              │
│ │  • /confirm-link                           │
│ │  • More...                                 │
│ │                                            │
│ ├─ DTE Analytics Router                      │
│ │  • /sales/summary                          │
│ │  • /purchases/summary                      │
│ │  • /sales/details                          │
│ │  • /purchases/details                      │
│ │  • /sales/available-periods                │
│ │  • /purchases/available-periods            │
│ │                                            │
│ ├─ Employees Router                          │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Expenses Router                           │
│ │  • /                                       │
│ │  • /stats                                  │
│ │  • resto sigue placeholder                 │
│ │                                            │
│ ├─ Haulmer Router                            │
│ │  • /available-periods                      │
│ │  • /sync                                   │
│ │  • /sync/incremental                       │
│ │                                            │
│ ├─ Integrations Router                       │
│ │  • /google/url                             │
│ │  • /google/status                          │
│ │  • /google/disconnect                      │
│ │                                            │
│ ├─ Inventory Router                          │
│ │  • /categories                             │
│ │  • /items                                  │
│ │  • /movements                              │
│ │                                            │
│ ├─ MercadoPago Router                        │
│ │  • /reports                                │
│ │  • /sync/logs                              │
│ │  • /process-report                         │
│ │  • Descarga binaria y webhook siguen REST  │
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
│ ├─ Finance Router                            │
│ │  • /transactions                           │
│ │  • /categories                             │
│ │  • /auto-category-rules                    │
│ │  • /compensation-profiles                  │
│ │                                            │
│ ├─ Users Router                              │
│ │  • /                                       │
│ │  • /profile                                │
│ │  • /invite                                 │
│ │  • /setup                                  │
│ │  • /{id}/status                            │
│ │                                            │
│ ├─ People Router                             │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Patients Router                           │
│ │  • /                                       │
│ │  • /{patientId}                            │
│ │  • /consultations                          │
│ │  • /{patientId}/budgets                    │
│ │  • /payments                               │
│ │  • /{patientId}/payments                   │
│ │  • /sources/dte                            │
│ │                                            │
│ ├─ Personal Finance Router                   │
│ │  • /credits                                │
│ │  • /credits/{id}                           │
│ │  • /credits/{id}/installments/{n}/pay      │
│ │                                            │
│ ├─ Settings Router                           │
│ │  • /internal                               │
│ │  • /branding/upload                        │
│ │                                            │
│ ├─ Notifications Router                      │
│ │  • /subscribe                              │
│ │  • /unsubscribe                            │
│ │  • /send-test                              │
│ │                                            │
│ ├─ Services Router                           │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │  • /{id}/schedules                         │
│ │  • /schedules/{id}/pay                     │
│ │  • /schedules/{id}/unlink                  │
│ │                                            │
│ ├─ Supplies Router                           │
│ │  • /common                                 │
│ │  • /requests                               │
│ │  • /requests/{id}/status                   │
│ │                                            │
│ ├─ Timesheets Router                         │
│ │  • /summary                                │
│ │  • /months                                 │
│ │  • /employee-range                         │
│ │  • /employee-detail                        │
│ │  • /multi-month                            │
│ │  • /multi-detail                           │
│ │  • /prepare-email-payload                  │
│ │  • blob/assets siguen raw fuera de oRPC    │
│ │                                            │
│ ├─ Production Balances Router                │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Balances Router                           │
│ │  • /                                       │
│ │  • Guarda saldo diario y reporte por fecha │
│ │                                            │
│ ├─ Transactions Insights Router              │
│ │  • /stats                                  │
│ │  • /participants                           │
│ │  • /participants/{id}                      │
│ │                                            │
│ ├─ Release Transactions Router               │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Settlement Transactions Router            │
│ │  • /                                       │
│ │  • /{id}                                   │
│ │                                            │
│ ├─ Backups Router                            │
│ │  • /                                       │
│ │  • /history                                │
│ │  • /logs                                   │
│ │  • /{fileId}/tables                        │
│ │  • /{fileId}/restore                       │
│ │  • Progress SSE sigue en /api/backups/...  │
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

## Intentional REST Exceptions

Not everything should move to oRPC. These remain intentionally outside the RPC boundary:

- `multipart/form-data`
  - Patient attachment upload in `features/patients/api.ts`
- OAuth redirect/callback flows
  - Doctoralia calendar auth start/redirect/callback
- SSE / event streams
  - Backup progress stream
- Binary downloads
  - MercadoPago report download
  - Raw blob/image fetches used by timesheet export

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
│   ├── finance.ts
│   ├── notifications.ts
│   ├── people.ts
│   ├── personal-finance.ts
│   ├── production-balances.ts
│   ├── settings.ts
│   ├── services.ts
│   ├── users.ts
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
| 2026-03-10 | ✅ Done | DTE Analytics (summary/details/periods) |
| 2026-03-10 | ✅ Done | Employees |
| 2026-03-10 | ✅ Done | Integrations (Google Drive) |
| 2026-03-10 | ✅ Done | Inventory |
| 2026-03-10 | ✅ Done | Roles |
| 2026-03-10 | ✅ Done | Counterparts |
| 2026-03-10 | ✅ Done | Finance |
| 2026-03-10 | ✅ Done | Users |
| 2026-03-10 | ✅ Done | People |
| 2026-03-10 | ✅ Done | Personal Finance |
| 2026-03-10 | ✅ Done | Settings |
| 2026-03-10 | ✅ Done | Notifications |
| 2026-03-10 | ✅ Done | Services |
| 2026-03-10 | ✅ Done | Supplies |
| 2026-03-10 | ✅ Done | Production Balances |
| 2026-03-10 | ✅ Done | Balances + Release/Settlement Transactions |
| 2026-03-10 | ✅ Done | Backups |
| 2026-03-10 | ✅ Done | Transactions Insights |

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

## Intentional REST Exceptions

The frontend should use oRPC by default. The remaining direct REST/SSE flows are intentional:

- `patients` attachments stay on REST because they upload `multipart/form-data`
- `doctoralia` OAuth start/redirect/callback stay on REST because they are browser redirect flows
- `backups` progress stays on `EventSource`/SSE at `/api/backups/progress`

Everything else should migrate through feature-level `orpc.ts` + `api.ts` boundaries.

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
