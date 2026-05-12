# ZenStack `authDb` migration (db → authDb)

## What

`packages/db/src/client.ts` exports two ORM clients:

- **`db`** — raw query API. No `@@allow` / `@@deny` enforcement. Every
  query returns whatever the SQL says.
- **`authDb`** — policy-aware. `authDb.$setAuth(subject)` returns a
  per-user wrapped client that rewrites every query to honor the
  `@@allow` / `@@deny` rules declared in `packages/db/zenstack/schema.zmodel`.

Most routers currently use `db` directly. The goal is to migrate every
authenticated router to `authDb.$setAuth(...)` (via the helper
`apps/api/src/lib/auth-db.ts → getAuthDbForContext(c)`) so a future
bug that forgets a `WHERE userId = …` clause cannot leak rows.

## Why per-router opt-in, not big bang

`enhance(db, { user })` rewrites every query to add policy `WHERE`
clauses. Switching everything at once would surface every silently-
broken `findMany()` that used to over-return rows simultaneously. A
per-router migration lets us:

1. Audit the model's `@@allow` rules in isolation.
2. Add snapshot tests with two seeded users (a/b) verifying user b
   cannot see user a's rows.
3. Catch regressions before the next router migrates.

## Migration order (low → high blast radius)

| Order | Model                   | Why early/late                                          |
| ----- | ----------------------- | ------------------------------------------------------- |
| 1     | `Notification`          | Per-user by definition; tiny blast radius.              |
| 2     | `PushSubscription`      | Per-user. Already covered by application code.          |
| 3     | `PersonalFinance*`      | Already migrated (see `orpc/personal-finance.ts`).      |
| 4     | `ReleaseTransaction`    | Already migrated (see `orpc/release-transactions.ts`).  |
| 5     | `SettlementTransaction` | Already migrated.                                       |
| 6     | `Appointment`           | Cross-clinician visibility — needs role-based policies. |
| 7     | `Patient`               | Needs the doctor↔patient assignment table populated.    |
| 8     | `MedicalRecord`         | Most sensitive — migrate last after RLS active too.     |

Tables under PG RLS (see `docs/security/rls.md`) are second-line —
even with `db` (raw), Postgres refuses to return rows the GUC says the
current user shouldn't see. authDb is the application-layer counterpart.

## Per-router migration steps

1. **Read the model's policies in `schema.zmodel`.** If absent or
   `@@allow('all', auth() != null)` (= every authenticated user can do
   anything), tighten them first. The migration is a no-op without
   real rules.

2. **Replace the import.** In the oRPC router file:

   ```diff
   - import { db } from "@finanzas/db";
   + import { getAuthDbForContext } from "../lib/auth-db.ts";
   ```

3. **Bind per request inside each handler:**

   ```diff
   - .handler(async ({ context, input }) => {
   -   const rows = await db.patient.findMany({ where: { … } });
   + .handler(async ({ context, input }) => {
   +   const xdb = await getAuthDbForContext(context.hono);
   +   const rows = await xdb.patient.findMany({ where: { … } });
   ```

4. **Add a snapshot test** under
   `apps/api/src/orpc/__tests__/<router>.policy.test.ts`:

   ```ts
   import { describe, it, expect } from "vitest";
   // … seed two users a, b, plus one row owned by a …
   it("user b cannot see user a's row", async () => {
     const xdb = getAuthDbForSession(userBSession);
     const rows = await xdb.patient.findMany({ where: { id: rowOwnedByA.id } });
     expect(rows).toHaveLength(0);
   });
   ```

5. **Run the test, deploy, smoke-test the intranet** for that router's
   screens. Move to the next.

## Performance

`authDb.$setAuth(subject)` is cheap (JS Proxy + AST rewrite). The
runtime cost is the extra `WHERE <policy expression>` appended to each
SQL statement; with proper indexes on the policy columns the overhead
is sub-millisecond per query (ZenStack benchmarks ~5%).

There is **no caching** of the auth subject across requests — caching
auth subjects would be a security bug. Per-request memoization (one
`getAuthDbForContext` per handler) is the right granularity.

## When to keep using `db` (raw)

| Use case                            | Why raw `db` is correct                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background jobs (cron, schedulers)  | No user identity — needs to see everything (or use a service-account subject pattern, not yet in place).                                                                     |
| Webhook handlers (Meta, Google, MP) | Same — no authenticated user, signatures cover authz.                                                                                                                        |
| Migrations / seed scripts           | Bypass policies on purpose.                                                                                                                                                  |
| Audit log writer                    | Server-side emission; the policies on `audit_logs` accept any authenticated user, but the writer must work for unauthenticated events too (failed login from unknown email). |

When in doubt: if the code path can run without `c.get('sessionUser')`,
keep using raw `db`.

## ZenStack `--strict` (future)

`zen generate --strict` errors at build time when a model has no
policies declared. Adopt this once the migration is complete to
prevent silently-policyless models from sneaking back in. For now,
running it would block the build because most models still rely on
the application layer.

## References

- [ZenStack v3 docs](https://zenstack.dev/docs)
- [ZenStack v3 announcement](https://dev.to/zenstack/zenstack-v3-the-perfect-prisma-orm-alternative-4fa3)
