#!/usr/bin/env tsx
/**
 * Drop audit.data_changes table
 *
 * This table is in the "audit" schema and contains ~2.63GB of old audit data.
 *
 * Usage:
 *   cd packages/db
 *   tsx scripts/drop-audit-data-changes.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Kysely, PostgresDialect, sql } from "kysely";
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

async function dropAuditDataChangesTable() {
  try {
    console.log("🔍 Checking audit.data_changes table...\n");

    // Check if table exists and get its size
    const tableInfo = await sql<{ table_size: string }>`
      SELECT 
        pg_size_pretty(pg_total_relation_size('audit.data_changes')) as table_size
      FROM pg_tables
      WHERE tablename = 'data_changes'
        AND schemaname = 'audit'
    `.execute(db);

    if (tableInfo.rows.length === 0) {
      console.log("✅ audit.data_changes table does not exist. Nothing to do!");
      return;
    }

    const size = tableInfo.rows[0].table_size;
    console.log(`📊 Found audit.data_changes table:`);
    console.log(`   Size: ${size}\n`);

    // Check for foreign key dependencies
    const dependencies = await sql<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (
          (tc.table_name = 'data_changes' AND tc.table_schema = 'audit')
          OR (ccu.table_name = 'data_changes' AND ccu.table_schema = 'audit')
        )
    `.execute(db);

    if (dependencies.rows.length > 0) {
      console.log("⚠️  Found foreign key dependencies:");
      dependencies.rows.forEach((dep) => {
        console.log(
          `   ${dep.table_name}.${dep.column_name} -> ${dep.foreign_table_name}.${dep.foreign_column_name}`,
        );
      });
      console.log();
    } else {
      console.log("✅ No foreign key dependencies found.\n");
    }

    // Drop the table
    console.log("🗑️  Dropping audit.data_changes table...");
    await sql`DROP TABLE IF EXISTS "audit"."data_changes" CASCADE`.execute(db);
    console.log("✅ Successfully dropped audit.data_changes table!\n");

    // Verify it's gone
    const verification = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE tablename = 'data_changes'
          AND schemaname = 'audit'
      ) as exists
    `.execute(db);

    if (!verification.rows[0].exists) {
      console.log("✅ Verified: audit.data_changes table no longer exists.");
      console.log(`💾 Freed up approximately ${size} of space!`);
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
dropAuditDataChangesTable()
  .then(() => {
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
