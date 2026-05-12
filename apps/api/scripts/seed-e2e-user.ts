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
import { Kysely, PostgresDialect } from "kysely";
import pkg from "pg";

const { Pool } = pkg;
const EMAIL = process.env.E2E_EMAIL ?? "e2e@bioalergia.cl";
const ROLE_NAME = process.env.E2E_ROLE ?? "Socio";

if (!process.env.DATABASE_URL) {
  console.error("[seed-e2e-user] DATABASE_URL not set");
  process.exit(2);
}

const db = new Kysely<any>({
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
const existingAssignment = await db
  .selectFrom("user_role_assignments")
  .select(["user_id", "role_id"])
  .where("user_id", "=", userId)
  .where("role_id", "=", role.id)
  .executeTakeFirst();
if (!existingAssignment) {
  await db
    .insertInto("user_role_assignments")
    .values({
      user_id: userId,
      role_id: role.id,
    })
    .execute();
}

await db.destroy();

// Last line: machine-readable. Anything before this is human noise.
console.log(`EMAIL=${EMAIL}`);
console.log(`PASS=${password}`);
