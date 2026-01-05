// @finanzas/db - ZenStack v3 Client
// Pure TypeScript ORM built on Kysely

import { ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { Pool } from "pg";
import { schema } from "./zenstack/schema.js";

// Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Base ORM client (no access control)
export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool }),
});

// ORM client with access control policies
export const authDb = db.$use(new PolicyPlugin());

// Direct Kysely access for complex queries
import { Kysely } from "kysely";
export const kysely = new Kysely<any>({
  dialect: new PostgresDialect({ pool }),
});

// Re-export schema for use in apps/api
// Re-export schema for use in apps/api
export { schema };
export type { SchemaType } from "./zenstack/schema.js";
export * from "./zenstack/models.js";

// Export standard types
export const EmployeeStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  TERMINATED: "TERMINATED",
} as const;

export type EmployeeStatus =
  (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const EmployeeSalaryType = {
  HOURLY: "HOURLY",
  FIXED: "FIXED",
} as const;

export type EmployeeSalaryType =
  (typeof EmployeeSalaryType)[keyof typeof EmployeeSalaryType];

// Simplified Json types for compatibility
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type InputJsonValue = JsonValue;

// Decimal type handling (ZenStack/Kysely with pg driver typically accepts string/number for input)
export type Decimal = string | number;
