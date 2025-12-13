import "dotenv/config";
import { prisma } from "../server/prisma.js";

async function main() {
  console.log("Seeding ALL core permissions...");

  const allPermissions = [
    // Transaction
    { action: "create", subject: "Transaction", description: "Create transactions" },
    { action: "read", subject: "Transaction", description: "Read transactions" },
    { action: "update", subject: "Transaction", description: "Update transactions" },
    { action: "delete", subject: "Transaction", description: "Delete transactions" },

    // User
    { action: "create", subject: "User", description: "Create users" },
    { action: "read", subject: "User", description: "Read users" },
    { action: "update", subject: "User", description: "Update users" },
    { action: "delete", subject: "User", description: "Delete users" },

    // Role
    { action: "create", subject: "Role", description: "Create roles" },
    { action: "read", subject: "Role", description: "Read roles" },
    { action: "update", subject: "Role", description: "Update roles" },
    { action: "delete", subject: "Role", description: "Delete roles" },

    // Permission
    { action: "read", subject: "Permission", description: "Read permissions" },
    { action: "manage", subject: "Permission", description: "Manage permissions" },

    // Setting
    { action: "manage", subject: "Setting", description: "Manage settings" },

    // Fallback global
    { action: "manage", subject: "all", description: "Manage everything" },
  ];

  for (const perm of allPermissions) {
    const existing = await prisma.permission.findFirst({
      where: { action: perm.action, subject: perm.subject },
    });

    if (!existing) {
      console.log(`Creating permission: ${perm.action} ${perm.subject}`);
      await prisma.permission.create({
        data: perm,
      });
    } else {
      // console.log(`Permission exists: ${perm.action} ${perm.subject}`);
    }
  }

  // Assign ALL permissions to GOD
  const godRole = await prisma.role.findUnique({ where: { name: "GOD" } });
  if (godRole) {
    console.log("Assigning ALL permissions to GOD role...");
    const allPermsInDb = await prisma.permission.findMany();
    for (const perm of allPermsInDb) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: godRole.id,
            permissionId: perm.id,
          },
        },
        create: {
          roleId: godRole.id,
          permissionId: perm.id,
        },
        update: {},
      });
    }

    // Bump version
    await prisma.userPermissionVersion.updateMany({
      where: { user: { roles: { some: { roleId: godRole.id } } } },
      data: { version: { increment: 1 } },
    });
    console.log("Bumped GOD permission version.");
  }

  // Assign subset to ADMIN
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (adminRole) {
    console.log("Assigning permissions to ADMIN role...");
    // For Admin, give everything except maybe destructive permissions if desired?
    // For now, let's give them everything too to ensure stability, or filter 'manage all' if we want.
    // Let's give them everything but "manage all" just to be granular, OR just give them everything.
    // Based on previous issues, safe bet is giving explicit permissions.

    const adminPerms = await prisma.permission.findMany({
      where: {
        subject: { in: ["Transaction", "User", "Role", "Permission", "Setting"] },
      },
    });

    for (const perm of adminPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        },
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
        update: {},
      });
    }
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
