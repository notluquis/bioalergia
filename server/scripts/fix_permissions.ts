import "dotenv/config";
import { prisma } from "../prisma.js";
import { syncPermissions } from "../services/permissions.js";
import { permissionMap } from "../lib/authz/permissionMap.js";
import { logger } from "../lib/logger.js";

async function fixPermissions() {
  console.log("Starting permission fix...");

  // 1. Sync Definitions
  await syncPermissions();
  console.log("Permissions synced.");

  // 2. Define target roles and desired permissions
  const rolesToFix = [
    {
      name: "EnfermeroUniversitario",
      allowed: ["production_balance.read", "production_balance.manage"],
      forbidden: ["daily_balance.read", "daily_balance.manage", "transaction.read"],
    },
    {
      name: "Tens",
      allowed: ["production_balance.read", "production_balance.manage"],
      forbidden: ["daily_balance.read", "daily_balance.manage", "transaction.read"],
    },
  ];

  for (const roleDef of rolesToFix) {
    const role = await prisma.role.findUnique({ where: { name: roleDef.name } });
    if (!role) {
      console.warn(`Role ${roleDef.name} not found. Skipping.`);
      continue;
    }

    console.log(`Fixing role: ${role.name} (ID: ${role.id})`);

    // Get permission IDs for allowed keys
    const allowedPerms = [];
    for (const key of roleDef.allowed) {
      // @ts-ignore
      const mapDef = permissionMap[key];
      if (mapDef) {
        const p = await prisma.permission.findUnique({
          where: {
            action_subject: {
              action: mapDef.action,
              subject: mapDef.subject,
            },
          },
        });
        if (p) allowedPerms.push(p);
      }
    }

    // Get permission IDs for forbidden keys
    const forbiddenPerms = [];
    for (const key of roleDef.forbidden) {
      // @ts-ignore
      const mapDef = permissionMap[key];
      if (mapDef) {
        const p = await prisma.permission.findUnique({
          where: {
            action_subject: {
              action: mapDef.action,
              subject: mapDef.subject,
            },
          },
        });
        if (p) forbiddenPerms.push(p);
      }
    }

    // Add Allowed
    for (const p of allowedPerms) {
      try {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
        console.log(`  + Added ${p.action} ${p.subject}`);
      } catch (e) {
        // Ignore if exists
      }
    }

    // Remove Forbidden
    if (forbiddenPerms.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: { in: forbiddenPerms.map((p) => p.id) },
        },
      });
      console.log(`  - Removed ${forbiddenPerms.length} forbidden permissions`);
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
