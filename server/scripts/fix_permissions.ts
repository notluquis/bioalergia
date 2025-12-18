import "dotenv/config";
import { prisma } from "../prisma.js";
import { syncPermissions } from "../services/permissions.js";
import { NAV_DATA, NavItemData } from "../../shared/navigation-data.js";

async function fixPermissions() {
  console.log("Starting permission fix...");

  // 1. Sync Definitions (Generates CRUD only now)
  await syncPermissions();
  console.log("Permissions synced.");

  // 2. Remove 'manage' permissions for resources (Normalization cleanup)
  console.log("Cleaning up redundant 'manage' permissions...");
  const subjects = new Set<string>();

  const collectSubjects = (items: NavItemData[]) => {
    items.forEach((item) => {
      if (item.requiredPermission?.subject) {
        subjects.add(item.requiredPermission.subject);
      }
      if (item.subItems) {
        collectSubjects(item.subItems);
      }
    });
  };

  NAV_DATA.forEach((section) => {
    collectSubjects(section.items);
  });

  for (const subject of subjects) {
    // Preserve 'manage all' as it is the super-admin privilege
    if (subject === "all") continue;

    // Check if permission exists before trying delete (optional, deleteMany is safe)
    const result = await prisma.permission.deleteMany({
      where: {
        action: "manage",
        subject: subject,
      },
    });

    if (result.count > 0) {
      console.log(`  - Removed 'manage' ${subject} (${result.count} records)`);
    }
  }

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
