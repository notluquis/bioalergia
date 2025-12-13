import { prisma } from "../prisma.js";
import { permissionMap } from "../lib/authz/permissionMap.js";

export async function listPermissions() {
  return await prisma.permission.findMany({
    orderBy: [{ subject: "asc" }, { action: "asc" }],
  });
}

export async function syncPermissions() {
  // Syncs permissionMap with DB
  const operations = [];

  for (const [key, def] of Object.entries(permissionMap) as [string, { action: string; subject: string }][]) {
    operations.push(
      prisma.permission.upsert({
        where: {
          action_subject: {
            action: def.action,
            subject: def.subject,
          },
        },
        update: {},
        create: {
          action: def.action,
          subject: def.subject,
          description: `Generated from ${key}`,
        },
      })
    );
  }

  return await prisma.$transaction(operations);
}
