import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Load environment variables from packages/db/.env BEFORE any db imports
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

async function main() {
  // Dynamic import AFTER env is loaded
  const { db } = await import("@finanzas/db");
  const { buildDangerousPermissionsWhereClause } = await import("../lib/permission-validator");

  console.log("🧹 Starting Security Cleanup: Purging Dangerous Permissions...");

  // 1. Target dangerous permissions using centralized validator
  const dangerousPerms = await db.permission.findMany({
    where: buildDangerousPermissionsWhereClause(),
  });

  if (dangerousPerms.length > 0) {
    console.log(`⚠️  Found ${dangerousPerms.length} dangerous/non-standard permissions.`);
    for (const perm of dangerousPerms) {
      console.log(`   🔥 Deleting: ID ${perm.id} (${perm.action}:${perm.subject})`);
      await db.permission.delete({
        where: { id: perm.id },
      });
    }
    console.log("✅ All targeted permissions removed.");
  } else {
    console.log("✨ No dangerous permissions found in database.");
  }

  // 2. Audit Roles with suspicious names
  const suspiciousRoles = await db.role.findMany({
    where: {
      OR: [
        { name: { contains: "manage", mode: "insensitive" } },
        { name: { equals: "GOD", mode: "insensitive" } },
      ],
    },
  });

  if (suspiciousRoles.length > 0) {
    console.log(`\n📢 Audit Required: Found ${suspiciousRoles.length} suspicious roles:`);
    for (const role of suspiciousRoles) {
      console.log(`   🚩 Role ID ${role.id}: "${role.name}"`);
    }
    console.log("💡 Note: These roles were NOT deleted. Please review them in the UI.");
  }

  console.log("\n🚀 Cleanup complete.");
}

main().catch((e) => {
  console.error("❌ Error during cleanup:", e);
  process.exit(1);
});
