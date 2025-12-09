# Testing Guide - Safety First 🛡️

## ⚠️ CRITICAL WARNING

**NEVER run tests with production DATABASE_URL!**

Tests have destructive `deleteMany()` operations. Always use a separate test database.

---

## Safe Testing Setup

### Option 1: Local Postgres (Recommended)

```bash
# Start a local test database
docker run -d \
  --name finanzas-test-db \
  -p 5433:5432 \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=finanzas_test \
  postgres:16

# Create .env.test file
cat > .env.test << EOF
DATABASE_URL=postgresql://postgres:test123@localhost:5433/finanzas_test
NODE_ENV=test
EOF

# Run migrations
dotenv -e .env.test -- npx prisma migrate deploy

# Run tests safely
dotenv -e .env.test -- npm test
```

### Option 2: Railway Staging Database

```bash
# Create a separate "staging" Postgres instance in Railway
# Update .env.test with staging DATABASE_URL

# Run tests
dotenv -e .env.test -- npm test
```

---

## Built-in Safety Guards

### Global Guard (test/setup.ts)

All tests check DATABASE_URL before running:

```typescript
beforeAll(() => {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("railway.app") || dbUrl.includes("prod")) {
    throw new Error("🚨 Tests CANNOT run against production!");
  }
});
```

If this error appears, **STOP IMMEDIATELY** and fix your DATABASE_URL.

### Per-Test Guards

Individual destructive tests also check:

```typescript
// test/auth.integration.test.ts
beforeAll(async () => {
  if (dbUrl.includes("railway.app") || dbUrl.includes("prod")) {
    throw new Error("🚨 Production DB detected!");
  }
  await prisma.user.deleteMany(); // Only runs on test DB
});
```

---

## Running Tests Safely

### Check DATABASE_URL First

```bash
# Before running tests, ALWAYS verify:
echo $DATABASE_URL

# Should be:
# ✅ postgresql://localhost:5433/finanzas_test
# ✅ postgresql://user:pass@test-db.local/test

# Should NOT be:
# ❌ railway.app
# ❌ bioalergia.cl
# ❌ intranet
```

### Run Tests

```bash
# Option A: With .env.test
dotenv -e .env.test -- npm test

# Option B: With explicit DATABASE_URL
DATABASE_URL=postgresql://localhost:5433/test npm test

# Run specific test file
dotenv -e .env.test -- npm test test/auth.integration.test.ts
```

---

## Test Categories

### Unit Tests (Safe)

- No database access
- Use mocks/stubs
- Examples: `supplies.integration.test.ts` (mocked prisma)

### Integration Tests (Destructive)

- **Require test database**
- Delete/modify data
- Examples:
  - `auth.integration.test.ts` (deletes users/people)
  - `finance.integration.test.ts` (deletes transactions/users/people)

### E2E Tests (Read-only)

- Connect to running server
- No direct DB manipulation
- Examples: `employees.integration.test.ts`, `withdrawals.integration.test.ts`

---

## Checklist Before Running Tests

- [ ] Check `DATABASE_URL` does NOT point to production
- [ ] Verify `.env.test` exists with test database URL
- [ ] Confirm test database is empty/disposable
- [ ] Run `dotenv -e .env.test -- npm test` (not just `npm test`)
- [ ] After tests, check production DB is untouched

---

## What Tests Do (High-Risk Operations)

### auth.integration.test.ts

```typescript
beforeAll(async () => {
  await prisma.user.deleteMany(); // Deletes ALL users
  await prisma.person.deleteMany(); // Deletes ALL people + CASCADE
});
```

**CASCADE Effect:** Deleting `Person` also deletes:

- Users → PushSubscriptions
- Employees → Timesheets
- Counterparts → Accounts, Services

### finance.integration.test.ts

```typescript
beforeAll(async () => {
  await prisma.transaction.deleteMany(); // Deletes ALL transactions
  await prisma.user.deleteMany(); // Deletes ALL users
  await prisma.person.deleteMany(); // Deletes ALL people + CASCADE
});
```

---

## Adding New Tests

When creating integration tests that modify the database:

```typescript
import { describe, it, beforeAll } from "vitest";
import { prisma } from "../server/prisma";

describe("My Integration Test", () => {
  beforeAll(async () => {
    // REQUIRED: Add safety guard
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl.includes("railway.app") || dbUrl.includes("prod")) {
      throw new Error("🚨 Tests CANNOT run against production!");
    }

    // Now safe to delete data
    await prisma.myModel.deleteMany();
  });

  // ... tests
});
```

---

## CI/CD Configuration

If using GitHub Actions or similar:

```yaml
# .github/workflows/test.yml
env:
  DATABASE_URL: postgresql://postgres:test@localhost:5432/test

services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
    ports:
      - 5432:5432
```

---

## Questions?

- **Q: Can I skip the safety guard?**
  - A: NO. It's there because of a real production incident.

- **Q: Why not use `NODE_ENV=test`?**
  - A: Not reliable. DATABASE_URL is the source of truth.

- **Q: Can I use Railway for tests?**
  - A: Only if it's a separate staging instance, never production.

---

**Remember:** One accidental `npm test` with production DATABASE_URL can wipe out months of business data. Always check before running tests.
