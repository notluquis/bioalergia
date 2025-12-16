import "dotenv/config";
import { prisma } from "../server/prisma.js";
import { INITIAL_ROLES } from "../server/config/initial-roles.js";
import { permissionMap } from "../server/lib/authz/permissionMap.js";

async function main() {
  console.log("Starting Role Migration V3...");

  // 1. Ensure all permissions exist
  console.log("Syncing permissions...");
  for (const [key, def] of Object.entries(permissionMap)) {
    const permName = `${def.action}:${def.subject}`;
    await prisma.permission.upsert({
      where: { action_subject: { action: def.action, subject: def.subject } },
      update: { description: key },
      create: {
        action: def.action,
        subject: def.subject,
        description: key,
      },
    });
  }

  // 2. Create New Roles and Assign Permissions
  console.log("Creating/Updating Roles...");
  const roleMap: Record<string, number> = {};

  for (const roleDef of INITIAL_ROLES) {
    // Create Role
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description },
    });
    roleMap[roleDef.name] = role.id;
    console.log(`Role ${roleDef.name} ready (ID: ${role.id}).`);

    // Sync Permissions
    // First, clear existing permissions for this role to ensure strict state
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    // Assign new permissions
    for (const permKey of roleDef.permissions) {
      const def = permissionMap[permKey];
      if (!def) {
        console.warn(`Warning: Permission key ${permKey} not found in map.`);
        continue;
      }
      const perm = await prisma.permission.findUnique({
        where: { action_subject: { action: def.action, subject: def.subject } },
      });
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // 3. Migrate Users (Coordinador Strategy)
  // Logic: SystemAdministrator -> CoordinadorFinanciero
  // OperationsManager -> CoordinadorFinanciero
  // Others -> Log for manual review (or strictly map to Enfermero?)
  // User asked for specific roles. We should map Admins to the new Super User role.

  const oldSuperRole = await prisma.role.findFirst({
    where: { name: { in: ["SystemAdministrator", "God", "Admin"] } },
  });

  const oldOpsRole = await prisma.role.findFirst({
    where: { name: { in: ["OperationsManager", "ADMIN"] } },
  });

  const coordinadorId = roleMap["CoordinadorFinanciero"];

  if (oldSuperRole) {
    console.log(`Migrating users from ${oldSuperRole.name} to CoordinadorFinanciero...`);
    const superUsers = await prisma.userRoleAssignment.findMany({ where: { roleId: oldSuperRole.id } });
    for (const u of superUsers) {
      // Check if already assigned
      const exists = await prisma.userRoleAssignment.findFirst({ where: { userId: u.userId, roleId: coordinadorId } });
      if (!exists) {
        await prisma.userRoleAssignment.create({ data: { userId: u.userId, roleId: coordinadorId } });
        console.log(`  -> User ${u.userId} migrated.`);
      }
    }
  }

  if (oldOpsRole && oldOpsRole.id !== oldSuperRole?.id) {
    console.log(`Migrating users from ${oldOpsRole.name} to CoordinadorFinanciero...`);
    const opsUsers = await prisma.userRoleAssignment.findMany({ where: { roleId: oldOpsRole.id } });
    for (const u of opsUsers) {
      const exists = await prisma.userRoleAssignment.findFirst({ where: { userId: u.userId, roleId: coordinadorId } });
      if (!exists) {
        await prisma.userRoleAssignment.create({ data: { userId: u.userId, roleId: coordinadorId } });
        console.log(`  -> User ${u.userId} migrated.`);
      }
    }
  }

  // 4. Cleanup Old Roles (Only if they are not the new ones)
  const newRoleNames = INITIAL_ROLES.map((r) => r.name);
  const legacyRoles = await prisma.role.findMany({
    where: { name: { notIn: newRoleNames } },
  });

  console.log("Cleaning up legacy roles...");
  for (const r of legacyRoles) {
    const userCount = await prisma.userRoleAssignment.count({ where: { roleId: r.id } });
    if (userCount === 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
      await prisma.role.delete({ where: { id: r.id } });
      console.log(`  -> Deleted empty role: ${r.name}`);
    } else {
      console.warn(`  ! SKIPPED: Role ${r.name} has ${userCount} users. Please re-assign manually or via script.`);
    }
  }

  console.log("✅ Role Migration V3 Complete.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
