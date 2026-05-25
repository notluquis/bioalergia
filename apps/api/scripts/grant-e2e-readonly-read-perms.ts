#!/usr/bin/env node
/**
 * Grant the `E2EReadOnly` role every `read` permission.
 *
 * Context: the E2E test user carries two roles — `Socio` (a real
 * least-privilege role) and `E2EReadOnly` (a synthetic marker the
 * `/api` middleware uses to reject mutating requests). `Socio` only has
 * a narrow read scope, so the E2E user can't actually *load* several
 * authed routes (settings, inventory, users, integrations…): the route
 * guard redirects to `/`, and scan-only e2e specs (axe, layout) then
 * pass vacuously against the home page.
 *
 * A read-only role used to exercise the whole app must be able to read
 * the whole app. This grants `E2EReadOnly` every `permissions` row with
 * `action = 'read'`. It stays a *read*-only role — the middleware still
 * blocks every mutation regardless of permissions — so this widens
 * visibility, never write access.
 *
 * Idempotent: `ON CONFLICT DO NOTHING`. Touches no credentials, no user
 * rows, no data — only inserts `role_permissions` link rows. Safe to
 * re-run. Run it after `seed-e2e-user.ts` has created the role.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node apps/api/scripts/grant-e2e-readonly-read-perms.ts
 */
import { Kysely, PostgresDialect, sql } from "kysely";
import pkg from "pg";

const { Pool } = pkg;
const ROLE_NAME = "E2EReadOnly";

if (!process.env.DATABASE_URL) {
  console.error("[grant-e2e-readonly-read-perms] DATABASE_URL not set");
  process.exit(2);
}

const db = new Kysely<Record<string, never>>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
});

const role = await db
  .selectFrom("roles")
  .select(["id"])
  .where("name", "=", ROLE_NAME)
  .executeTakeFirst();

if (!role) {
  console.error(
    `[grant-e2e-readonly-read-perms] role ${ROLE_NAME} not found — run seed-e2e-user.ts first`
  );
  await db.destroy();
  process.exit(3);
}

// INSERT ... SELECT every read permission, skipping links that already
// exist. Single statement, atomic, idempotent.
const result = await sql`
  INSERT INTO role_permissions (role_id, permission_id, created_at)
  SELECT ${role.id}, p.id, now()
  FROM permissions p
  WHERE p.action = 'read'
  ON CONFLICT (role_id, permission_id) DO NOTHING
`.execute(db);

const granted = await db
  .selectFrom("role_permissions")
  .select((eb) => eb.fn.countAll().as("count"))
  .where("role_id", "=", role.id)
  .executeTakeFirstOrThrow();

await db.destroy();

console.log(
  `[grant-e2e-readonly-read-perms] inserted ${result.numAffectedRows ?? 0} new link(s); ` +
    `${ROLE_NAME} now holds ${granted.count} read permission(s).`
);
