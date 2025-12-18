import { prisma } from "../prisma.js";
import { permissionMap } from "../lib/authz/permissionMap.js";
import { NAV_DATA } from "../../shared/navigation-data.js";

export async function listPermissions() {
  return await prisma.permission.findMany({
    orderBy: [{ subject: "asc" }, { action: "asc" }],
  });
}

export async function syncPermissions() {
  // Syncs permissionMap (Static) + NAV_DATA (Dynamic) with DB

  // 1. Static Permissions from Map
  for (const [key, def] of Object.entries(permissionMap) as [string, { action: string; subject: string }][]) {
    try {
      await prisma.permission.upsert({
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
      });
    } catch (e) {
      console.error(`Error syncing ${key}:`, e);
    }
  }

  // 2. Dynamic Permissions from Navigation
  // Strategy: For every page with a "requiredPermission.subject", ensure "read" and "manage" exist.
  const subjects = new Set<string>();

  NAV_DATA.forEach((section) => {
    section.items.forEach((item) => {
      if (item.requiredPermission && item.requiredPermission.subject) {
        subjects.add(item.requiredPermission.subject);
      }
    });
  });

  for (const subject of subjects) {
    try {
      // Exclude 'manage' based on user request to normalize to CRUD only
      const actions = ["read", "create", "update", "delete"];
      for (const action of actions) {
        await prisma.permission.upsert({
          where: { action_subject: { action, subject } },
          update: {},
          create: { action, subject, description: `Auto-generated ${action} for ${subject}` },
        });
      }
    } catch (e) {
      console.error(`Error syncing dynamic subject ${subject}:`, e);
    }
  }

  return []; // Return empty or status
}
