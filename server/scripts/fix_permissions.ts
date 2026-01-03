import "dotenv/config";

import { prisma } from "../prisma.js";
import { syncPermissions } from "../services/permissions.js";

async function fixPermissions() {
  console.log("Starting permission fix...");

  // 1. Sync Definitions (Generates CRUD only now)
  await syncPermissions();
  console.log("Permissions synced.");

  // 2. Remove ALL 'manage' permissions (Normalization cleanup - we use granular CRUD only)
  console.log("Cleaning up 'manage' permissions...");

  // Delete ALL manage permissions including 'manage all'
  const result = await prisma.permission.deleteMany({
    where: {
      action: "manage",
    },
  });

  console.log(`Removed ${result.count} 'manage' permissions.`);

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
