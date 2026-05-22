// @finanzas/db - ZenStack v3 Client
// Pure TypeScript ORM built on Kysely

import { ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { Pool, types } from "pg";

import { schema } from "./zenstack/schema.ts";
import type { SchemaType } from "./zenstack/schema.ts";

// Configure pg driver to parse numeric/decimal as JavaScript number natively
// This is the ZenStack/Kysely recommended approach for Decimal handling
// OIDs: 1700 = NUMERIC, 20 = BIGINT
types.setTypeParser(1700, (val) => Number.parseFloat(val)); // NUMERIC → number
types.setTypeParser(20, (val) => Number.parseInt(val, 10)); // BIGINT → number

// Force `timestamp without time zone` (OID 1114) to be interpreted as UTC
// instead of the Node runtime's local timezone. Default pg behaviour shifts
// the value by the runtime offset, which produces different Date instants for
// the same column depending on where the process runs (Railway = UTC, dev
// machines = local). Pinning to UTC makes reads deterministic across
// environments. Columns that should represent a true moment in time should
// still be migrated to TIMESTAMPTZ (OID 1184) — this is the safety net for
// legacy columns that remain as plain timestamps.
types.setTypeParser(1114, (val) => new Date(val + "Z"));

// Helper for safe environment access (Deno compatibility)
const getEnv = (key: string): string | undefined => {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
};

// Connection pool — tuned for Railway PostgreSQL
// - connectionTimeoutMillis: 20s to tolerate Railway cold starts (can reach 15s)
// - idleTimeoutMillis: 10min to keep the pool warm between requests
// - max: 10 conservative for Railway Hobby (max ~97 PG connections, multiple instances).
//   graphile-worker uses its own separate pool (apps/api/src/queue/runner.ts,
//   maxPoolSize: 2) so app and queue don't compete for slots.
// - min: 2 pre-warmed connections so the first requests don't incur connection overhead
// - keepAlive: prevents Railway's NAT from silently dropping idle TCP connections
const pool = new Pool({
  connectionString: getEnv("DATABASE_URL"),
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 600_000,
  max: 10,
  min: 2,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Force UTF-8 client encoding
  options: "-c client_encoding=UTF8",
  // Fallback to postgres user if environment access fails (Deno safety)
  user: "postgres",
});

// On every new physical connection, push the audit-log HMAC key into a
// session GUC so the BEFORE INSERT trigger on audit_logs can compute
// the chain HMAC. The trigger reads the key via current_setting() — it
// is never echoed back to the runtime role. AUDIT_HMAC_KEY must be 64
// hex chars; absence is tolerated (trigger uses a dev fallback) so the
// app never fails to boot, but production should always set it.
const auditHmacKey = getEnv("AUDIT_HMAC_KEY");
pool.on("connect", (client) => {
  if (auditHmacKey) {
    client
      .query("SELECT set_config('app.audit_hmac_key', $1, false)", [auditHmacKey])
      .catch(() => undefined);
  }
});

// Base ORM client (no access control).
//
// Tipo completo inferido (NO colapsado a `ClientContract<SchemaType>`). El
// colapso era un workaround para el TS2321 "Excessive stack depth" que dispara
// el `TransactionClientContract` profundo cuando `db.$transaction(async tx =>…)`
// se instancia INLINE en archivos oRPC pesados. Solución golden 2026: toda la
// lógica DB/transacción vive en el service layer (contexto de tipos liviano),
// los handlers oRPC quedan finos → el TS2321 no ocurre y los rows de findMany
// conservan TODOS los campos del modelo (sin colapso lossy). Ver
// services/exam-reports.ts y services/users.ts. NO reintroducir el colapso:
// si vuelve TS2321, mover el $transaction culpable a un servicio.
export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool }),
  diagnostics: {
    // Queries slower than 1s are recorded in db.$diagnostics.slowQueries
    slowQueryThresholdMs: 1000,
    slowQueryMaxRecords: 100,
  },
});

// ORM client with access control policies.
export const authDb = db.$use(new PolicyPlugin());

// Canonical client type re-export.
export type DbClient = typeof db;

// Direct Kysely access for complex queries
import { Kysely } from "kysely";

export const kysely = new Kysely<SchemaType>({
  dialect: new PostgresDialect({ pool }),
});

// Export ZenStack TanStack Query - Official v3 Pattern
// Re-export useClientQueries for direct usage in components
// MOVED TO @finanzas/db/react to avoid polluting Node.js runtime
// export { useClientQueries } from "@zenstackhq/tanstack-query/react";

// Export generated types and models
export * from "./zenstack/models.ts";
export type { SchemaType } from "./zenstack/schema.ts";

// Export schemas for runtime usage with useClientQueries
export { schema } from "./zenstack/schema.ts";
export { schema as schemaLite } from "./zenstack/schema-lite.ts";
export const EmployeeStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  TERMINATED: "TERMINATED",
} as const;

export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const EmployeeSalaryType = {
  FIXED: "FIXED",
  HOURLY: "HOURLY",
} as const;

// Decimal type handling (ZenStack/Kysely with pg driver typically accepts string/number for input)
export type Decimal = number | string;

export type EmployeeSalaryType = (typeof EmployeeSalaryType)[keyof typeof EmployeeSalaryType];

export type InputJsonValue = JsonValue;
export type JsonArray = JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// Simplified Json types for compatibility
export type JsonValue = boolean | JsonArray | JsonObject | null | number | string;
