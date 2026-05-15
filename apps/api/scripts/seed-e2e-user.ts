#!/usr/bin/env node
/**
 * Seed (or rotate) the E2E test user.
 *
 * Golden 2026 standard for an E2E account in a clinical SaaS:
 *  - Dedicated identity (no human is "the e2e user")
 *  - Strong random password (32 bytes base64url ≈ 43 chars)
 *  - MFA disabled (CI cannot solve TOTP without sharing the seed)
 *  - Status ACTIVE so the login flow doesn't bounce to onboarding
 *  - Least-privilege role (Socio = lowest scope today)
 *  - Idempotent: rerun rotates the password, never duplicates the row
 *
 * Output: prints `EMAIL=... PASS=...` on the last line so a CI step can
 * pipe it into `gh secret set`. Nothing else writes to stdout.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node apps/api/scripts/seed-e2e-user.ts
 */
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Kysely, PostgresDialect, sql } from "kysely";
import pkg from "pg";

const { Pool } = pkg;
const EMAIL = process.env.E2E_EMAIL ?? "e2e@bioalergia.cl";
const ROLE_NAME = process.env.E2E_ROLE ?? "Socio";

if (!process.env.DATABASE_URL) {
  console.error("[seed-e2e-user] DATABASE_URL not set");
  process.exit(2);
}

const db = new Kysely<Record<string, never>>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
});

const password = randomBytes(32).toString("base64url");
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

const role = await db
  .selectFrom("roles")
  .select(["id", "name"])
  .where("name", "=", ROLE_NAME)
  .executeTakeFirst();
if (!role) {
  console.error(`[seed-e2e-user] role ${ROLE_NAME} not found`);
  process.exit(3);
}

// Defense-in-depth layer 2 (app-layer). The Hono middleware in
// apps/api/src/app.ts rejects mutating HTTP methods when the
// session user holds this role. We create it idempotently here so
// the seed runs work even on a fresh DB.
const READ_ONLY_ROLE_NAME = "E2EReadOnly";
let readOnlyRole = await db
  .selectFrom("roles")
  .select(["id"])
  .where("name", "=", READ_ONLY_ROLE_NAME)
  .executeTakeFirst();
if (!readOnlyRole) {
  readOnlyRole = await db
    .insertInto("roles")
    .values({
      name: READ_ONLY_ROLE_NAME,
      description:
        "Synthetic role used by Playwright E2E to mark a session as read-only. " +
        "The /api middleware rejects mutating methods for users holding this role.",
      is_system: true,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}

// Grant E2EReadOnly every `read` permission. `Socio` (the user's other
// role) is least-privilege and can't load several authed routes, so the
// E2E user would otherwise bounce to `/` and scan-only specs would pass
// vacuously. The middleware still blocks all mutations for this role —
// this only widens read visibility. Idempotent. Mirrored standalone in
// scripts/grant-e2e-readonly-read-perms.ts for re-running without a
// password rotation.
await sql`
  INSERT INTO role_permissions (role_id, permission_id, created_at)
  SELECT ${readOnlyRole.id}, p.id, now()
  FROM permissions p
  WHERE p.action = 'read'
  ON CONFLICT (role_id, permission_id) DO NOTHING
`.execute(db);

const existing = await db
  .selectFrom("users")
  .innerJoin("people", "people.id", "users.person_id")
  .select([
    "users.id as user_id",
    "users.person_id",
    "users.session_version",
    "people.email",
  ])
  .where("users.login_email", "=", EMAIL)
  .executeTakeFirst();

let userId: number;
let personId: number;

if (existing) {
  userId = existing.user_id;
  personId = existing.person_id;
  await db
    .updateTable("users")
    .set({
      password_hash: passwordHash,
      status: "ACTIVE",
      mfa_enabled: false,
      mfa_secret: null,
      failed_login_attempts: 0,
      locked_until: null,
      // Bump session version so any leaked cookie from a prior rotation
      // is invalidated immediately.
      session_version: (existing.session_version ?? 1) + 1,
    })
    .where("id", "=", userId)
    .execute();
} else {
  const person = await db
    .insertInto("people")
    .values({
      names: "E2E",
      father_name: "Playwright",
      mother_name: "CI",
      email: EMAIL,
      person_type: "NATURAL",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  personId = person.id;
  const user = await db
    .insertInto("users")
    .values({
      person_id: personId,
      login_email: EMAIL,
      password_hash: passwordHash,
      status: "ACTIVE",
      mfa_enabled: false,
      session_version: 1,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  userId = user.id;
}

// Ensure least-privilege role assignment exists (idempotent).
// user_role_assignments uses a composite PK (user_id, role_id), no surrogate
// id column — select by both keys.
async function ensureAssignment(roleId: number) {
  const existingAssignment = await db
    .selectFrom("user_role_assignments")
    .select(["user_id", "role_id"])
    .where("user_id", "=", userId)
    .where("role_id", "=", roleId)
    .executeTakeFirst();
  if (!existingAssignment) {
    await db
      .insertInto("user_role_assignments")
      .values({ user_id: userId, role_id: roleId })
      .execute();
  }
}
await ensureAssignment(role.id);
await ensureAssignment(readOnlyRole.id);

await db.destroy();

// Last line: machine-readable. Anything before this is human noise.
console.log(`EMAIL=${EMAIL}`);
console.log(`PASS=${password}`);
