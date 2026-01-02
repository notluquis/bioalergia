/**
 * Verify audit system installation
 */
import { prisma } from "../server/prisma.js";

async function verify() {
  console.log("Checking audit system...\n");

  // Check triggers
  const triggers = await prisma.$queryRaw<{ tgname: string; table_name: string }[]>`
    SELECT tgname, tgrelid::regclass as table_name 
    FROM pg_trigger 
    WHERE tgname = 'audit_trigger' 
    LIMIT 10
  `;
  console.log(`Found ${triggers.length} audit triggers:`);
  triggers.forEach((t) => console.log(`  - ${t.table_name}`));

  // Check audit schema
  const tables = await prisma.$queryRaw<{ schemaname: string; tablename: string }[]>`
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'audit'
  `;
  console.log(`\nAudit schema tables:`);
  tables.forEach((t) => console.log(`  - ${t.schemaname}.${t.tablename}`));

  // Check pending changes
  const pending = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM audit.data_changes WHERE exported_at IS NULL
  `;
  console.log(`\nPending changes to export: ${pending[0].count}`);

  await prisma.$disconnect();
}

verify().catch(console.error);
