// @finanzas/db - ZenStack v3 Client
// Pure TypeScript ORM built on Kysely

import { ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { Pool, types } from "pg";

import { schema } from "./zenstack/schema.js";

// Configure pg driver to parse numeric/decimal as JavaScript number natively
// This is the ZenStack/Kysely recommended approach for Decimal handling
// OIDs: 1700 = NUMERIC, 20 = BIGINT
types.setTypeParser(1700, (val) => Number.parseFloat(val)); // NUMERIC → number
types.setTypeParser(20, (val) => Number.parseInt(val, 10)); // BIGINT → number

// Helper for safe environment access (Deno compatibility)
const getEnv = (key: string): string | undefined => {
  try {
    // eslint-disable-next-line security/detect-object-injection
    return process.env[key];
  } catch {
    return undefined;
  }
};

// Connection pool with UTF-8 encoding
const pool = new Pool({
  connectionString: getEnv("DATABASE_URL"),
  // Ensure UTF-8 encoding for all database operations
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  max: 20,
  // Force UTF-8 client encoding
  options: "-c client_encoding=UTF8",
  // Fallback to postgres user if environment access fails (Deno safety)
  user: "postgres",
});

// Base ORM client (no access control)
export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool }),
});

// ORM client with access control policies
// Type assertion needed due to nested @zenstackhq/schema versions
export const authDb = db.$use(new PolicyPlugin());

// Direct Kysely access for complex queries
import { Kysely } from "kysely";

import type { SchemaType } from "./zenstack/schema.js";

export const kysely = new Kysely<SchemaType>({
  dialect: new PostgresDialect({ pool }),
});

// Export ZenStack TanStack Query - Official v3 Pattern
// Re-export useClientQueries for direct usage in components
export { useClientQueries } from "@zenstackhq/tanstack-query/react";

// Export generated types and models
export * from "./zenstack/models.js";
export type { SchemaType } from "./zenstack/schema.js";

// Export schemas for runtime usage with useClientQueries
export { schema } from "./zenstack/schema.js";
export { schema as schemaLite } from "./zenstack/schema-lite.js";
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

// eslint-disable-next-line sonarjs/redundant-type-aliases
export type InputJsonValue = JsonValue;
export type JsonArray = JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// Simplified Json types for compatibility
export type JsonValue = boolean | JsonArray | JsonObject | null | number | string;
