import { prisma } from "../prisma.js";
import { ROUTE_DATA, API_PERMISSIONS, type RouteData } from "../../shared/route-data.js";

export async function listPermissions() {
  return await prisma.permission.findMany({
    orderBy: [{ subject: "asc" }, { action: "asc" }],
  });
}

/**
 * Syncs permissions from route-data.ts to the database.
 *
 * Sources:
 * 1. ROUTE_DATA - UI routes with permission field (generates CRUD for each subject)
 * 2. API_PERMISSIONS - API-only permissions (direct action/subject pairs)
 *
 * Also auto-assigns ALL permissions to the SystemAdministrator role.
 */
export async function syncPermissions() {
  const validPermissions = new Set<string>();

  // 1. Collect subjects from UI routes
  const subjects = new Set<string>();

  const collectSubjects = (routes: RouteData[]) => {
    routes.forEach((route) => {
      if (route.permission?.subject) {
        subjects.add(route.permission.subject);
      }
      if (route.children && Array.isArray(route.children)) {
        collectSubjects(route.children);
      }
    });
  };

  collectSubjects(ROUTE_DATA);

  // 2. Create CRUD permissions for each discovered subject
  for (const subject of subjects) {
    const actions = ["read", "create", "update", "delete"];
    for (const action of actions) {
      try {
        await prisma.permission.upsert({
          where: { action_subject: { action, subject } },
          update: {},
          create: { action, subject, description: `Auto-generated ${action} for ${subject}` },
        });
        validPermissions.add(`${action}:${subject}`);
      } catch (e) {
        console.error(`Error syncing ${action}:${subject}:`, e);
      }
    }
  }

  // 3. Create API-only permissions
  for (const perm of API_PERMISSIONS) {
    try {
      await prisma.permission.upsert({
        where: { action_subject: { action: perm.action, subject: perm.subject } },
        update: {},
        create: { action: perm.action, subject: perm.subject, description: `API-only permission` },
      });
      validPermissions.add(`${perm.action}:${perm.subject}`);
    } catch (e) {
      console.error(`Error syncing API permission ${perm.action}:${perm.subject}:`, e);
    }
  }

  // 4. Cleanup obsolete permissions
  try {
    const allDbPermissions = await prisma.permission.findMany();
    const toDeleteIds = allDbPermissions
      .filter((p) => !validPermissions.has(`${p.action}:${p.subject}`))
      .map((p) => p.id);

    if (toDeleteIds.length > 0) {
      console.log(`Cleaning up ${toDeleteIds.length} obsolete permissions...`);
      await prisma.permission.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }
  } catch (e) {
    console.error("Error cleaning up permissions:", e);
  }

  // 5. Auto-assign ALL permissions to SystemAdministrator role
  try {
    const adminRole = await prisma.role.findFirst({ where: { name: "SystemAdministrator" } });
    if (adminRole) {
      const allPermissions = await prisma.permission.findMany();
      for (const perm of allPermissions) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: adminRole.id, permissionId: perm.id },
        });
      }
      console.log(`Auto-assigned ${allPermissions.length} permissions to SystemAdministrator`);
    }
  } catch (e) {
    console.error("Error auto-assigning permissions to admin:", e);
  }

  return [];
}
