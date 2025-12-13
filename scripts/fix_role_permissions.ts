import "dotenv/config";
import { prisma } from "../server/prisma.js";

async function main() {
  console.log("Seeding Roles and Permissions permissions...");

  const permissions = [
    { action: "create", subject: "Role", description: "Create new roles" },
    { action: "read", subject: "Role", description: "View roles" },
    { action: "update", subject: "Role", description: "Edit roles" },
    { action: "delete", subject: "Role", description: "Delete roles" },
    { action: "read", subject: "Permission", description: "View permissions" },
    { action: "manage", subject: "Permission", description: "Sync/Manage permissions" },
  ];

  for (const perm of permissions) {
    const existing = await prisma.permission.findFirst({
      where: { action: perm.action, subject: perm.subject },
    });

    if (!existing) {
      console.log(`Creating permission: ${perm.action} ${perm.subject}`);
      await prisma.permission.create({
        data: perm,
      });
    } else {
      console.log(`Permission exists: ${perm.action} ${perm.subject}`);
    }
  }

  // Assign to GOD and ADMIN roles
  const rolesToUpdate = ["GOD", "ADMIN"];

  for (const roleName of rolesToUpdate) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (role) {
      console.log(`Assigning permissions to role: ${roleName}`);
      const allPerms = await prisma.permission.findMany({
        where: {
          OR: [{ subject: "Role" }, { subject: "Permission" }],
        },
      });

      for (const perm of allPerms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
          update: {},
        });
      }
    }
  }

  // Bust cache for GOD users
  const godRole = await prisma.role.findUnique({ where: { name: "GOD" } });
  if (godRole) {
    await prisma.userPermissionVersion.updateMany({
      where: { user: { roles: { some: { roleId: godRole.id } } } },
      data: { version: { increment: 1 } },
    });
    console.log("Bumped permission version for GOD users.");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
