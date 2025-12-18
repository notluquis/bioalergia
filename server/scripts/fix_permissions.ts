import "dotenv/config";
import { prisma } from "../prisma.js";
import { syncPermissions } from "../services/permissions.js";

async function fixPermissions() {
  console.log("Starting permission fix...");

  // 1. Sync Definitions (Generates CRUD only now)
  await syncPermissions();
  console.log("Permissions synced.");

  // 2. Remove 'manage' permissions for resources (Normalization cleanup)
  console.log("Cleaning up redundant 'manage' permissions...");

  // Delete ALL manage permissions where subject != 'all'
  // This ensures we fully normalize to CRUD even for static subjects like 'User' or 'Role'
  const result = await prisma.permission.deleteMany({
    where: {
      action: "manage", // Only delete 'manage' action
      subject: { not: "all" }, // Preserve 'manage all' (Super Admin)
    },
  });

  console.log(`Removed ${result.count} redundant 'manage' permissions.`);

  console.log("Permission fix complete.");
}

fixPermissions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
