#!/usr/bin/env tsx
/**
 * Script to drop the AuditLog table from the database
 *
 * This will free up approximately 2.63GB of space.
 *
 * Usage:
 *   cd apps/api
 *   tsx ../../packages/db/scripts/drop-audit-table.ts
 *
 * IMPORTANT: This is irreversible! Make sure you have a backup if needed.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment");
  process.exit(1);
}

// Create Kysely instance
const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

async function dropAuditLogTable() {
  try {
    console.log("🔍 Checking AuditLog table...\n");

    // Check if table exists and get its size
    const tableInfo = await db
      .selectFrom("pg_tables")
      .select([
        "tablename",
        db
          .fn("pg_size_pretty", [
            db.fn("pg_total_relation_size", [
              db.raw("schemaname||'.'||tablename"),
            ]),
          ])
          .as("size"),
      ])
      .where("tablename", "=", "AuditLog")
      .where("schemaname", "=", "public")
      .executeTakeFirst();

    if (!tableInfo) {
      console.log("✅ AuditLog table does not exist. Nothing to do!");
      return;
    }

    console.log(`📊 Found AuditLog table:`);
    console.log(`   Size: ${tableInfo.size}\n`);

    // Check for foreign key dependencies
    const dependencies = await db
      .selectFrom("information_schema.table_constraints as tc")
      .innerJoin("information_schema.key_column_usage as kcu", (join) =>
        join
          .onRef("tc.constraint_name", "=", "kcu.constraint_name")
          .onRef("tc.table_schema", "=", "kcu.table_schema"),
      )
      .innerJoin("information_schema.constraint_column_usage as ccu", (join) =>
        join
          .onRef("ccu.constraint_name", "=", "tc.constraint_name")
          .onRef("ccu.table_schema", "=", "tc.table_schema"),
      )
      .select([
        "tc.constraint_name",
        "tc.table_name",
        "kcu.column_name",
        "ccu.table_name as foreign_table_name",
        "ccu.column_name as foreign_column_name",
      ])
      .where("tc.constraint_type", "=", "FOREIGN KEY")
      .where((eb) =>
        eb.or([
          eb("tc.table_name", "=", "AuditLog"),
          eb("ccu.table_name", "=", "AuditLog"),
        ]),
      )
      .where("tc.table_schema", "=", "public")
      .execute();

    if (dependencies.length > 0) {
      console.log("⚠️  Found foreign key dependencies:");
      dependencies.forEach((dep) => {
        console.log(
          `   ${dep.table_name}.${dep.column_name} -> ${dep.foreign_table_name}.${dep.foreign_column_name}`,
        );
      });
      console.log();
    } else {
      console.log("✅ No foreign key dependencies found.\n");
    }

    // Drop the table
    console.log("🗑️  Dropping AuditLog table...");
    await db.schema.dropTable("AuditLog").cascade().execute();
    console.log("✅ Successfully dropped AuditLog table!\n");

    // Verify it's gone
    const verification = await db
      .selectFrom("pg_tables")
      .select("tablename")
      .where("tablename", "=", "AuditLog")
      .where("schemaname", "=", "public")
      .executeTakeFirst();

    if (!verification) {
      console.log("✅ Verified: AuditLog table no longer exists.");
      console.log(`💾 Freed up approximately ${tableInfo.size} of space!`);
    } else {
      console.log("⚠️  Warning: Table still exists after drop attempt.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run the script
dropAuditLogTable()
  .then(() => {
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
