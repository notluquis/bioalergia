import crypto from "crypto";

import { API_PERMISSIONS, ROUTE_DATA, type RouteData } from "../../shared/route-data.js";
import { prisma } from "../prisma.js";

const PERMISSIONS_HASH_KEY = "permissions_sync_hash";

/**
 * Generate a hash of the current permission configuration.
 * Used to detect if permissions need to be re-synced.
 */
function generatePermissionsHash(): string {
  const subjects = new Set<string>();
  const collectSubjects = (routes: RouteData[]) => {
    routes.forEach((route) => {
      if (route.permission?.subject) subjects.add(route.permission.subject);
      if (route.children) collectSubjects(route.children);
    });
  };
  collectSubjects(ROUTE_DATA);

  // Create a deterministic string of all permissions
  const permissionList = [
    ...Array.from(subjects)
      .sort()
      .flatMap((s) => ["read", "create", "update", "delete"].map((a) => `${a}:${s}`)),
    ...API_PERMISSIONS.map((p) => `${p.action}:${p.subject}`).sort(),
  ].join("|");

  return crypto.createHash("md5").update(permissionList).digest("hex");
}

export async function listPermissions() {
  return await prisma.permission.findMany({
    orderBy: [{ subject: "asc" }, { action: "asc" }],
  });
}

/**
 * Syncs permissions from route-data.ts to the database.
 *
 * Uses hash-based change detection to skip sync if nothing changed.
 * This is important for serverless environments where cold starts are frequent.
 *
 * @param force - If true, skip hash check and always sync
 * @returns { synced: boolean, reason: string }
 */
export async function syncPermissions(force = false): Promise<{ synced: boolean; reason: string }> {
  const currentHash = generatePermissionsHash();

  // Check if sync is needed (unless forced)
  if (!force) {
    try {
      const stored = await prisma.setting.findUnique({ where: { key: PERMISSIONS_HASH_KEY } });
      if (stored?.value === currentHash) {
        return { synced: false, reason: "Permissions unchanged (hash match)" };
      }
    } catch {
      // Setting table might not exist, continue with sync
    }
  }

  const validPermissions = new Set<string>();

  // 1. Collect subjects from UI routes
  const subjects = new Set<string>();
  const collectSubjects = (routes: RouteData[]) => {
    routes.forEach((route) => {
      if (route.permission?.subject) subjects.add(route.permission.subject);
      if (route.children) collectSubjects(route.children);
    });
  };
  collectSubjects(ROUTE_DATA);

  // 2. Create CRUD permissions for each discovered subject
  for (const subject of subjects) {
    for (const action of ["read", "create", "update", "delete"]) {
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
      await prisma.permission.deleteMany({ where: { id: { in: toDeleteIds } } });
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

  // 6. Store the current hash to skip future syncs
  try {
    await prisma.setting.upsert({
      where: { key: PERMISSIONS_HASH_KEY },
      update: { value: currentHash },
      create: { key: PERMISSIONS_HASH_KEY, value: currentHash },
    });
  } catch (e) {
    console.error("Error storing permissions hash:", e);
  }

  return { synced: true, reason: force ? "Forced sync" : "Permissions changed (hash mismatch)" };
}
