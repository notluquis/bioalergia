import { db } from "@finanzas/db";

async function main() {
  console.log("🧹 Starting Security Cleanup: Purging Dangerous Permissions...");

  // 1. Target the specific dangerous permission
  const dangerousPerms = await db.permission.findMany({
    where: {
      OR: [
        { AND: [{ action: "manage" }, { subject: "all" }] },
        { action: "manage" } // Project standard uses create, read, update, delete
      ]
    }
  });

  if (dangerousPerms.length > 0) {
    console.log(`⚠️  Found ${dangerousPerms.length} dangerous/non-standard permissions.`);
    for (const perm of dangerousPerms) {
      console.log(`   🔥 Deleting: ID ${perm.id} (${perm.action}:${perm.subject})`);
      await db.permission.delete({
        where: { id: perm.id }
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
        { name: { equals: "GOD", mode: "insensitive" } }
      ]
    }
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

main()
  .catch((e) => {
    console.error("❌ Error during cleanup:", e);
    process.exit(1);
  });
