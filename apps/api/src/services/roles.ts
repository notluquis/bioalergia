import { db } from "@finanzas/db";

export async function listRoles() {
  return await db.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createRole(data: any) {
  const existing = await db.role.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    throw new Error("El rol ya existe (nombre duplicado o muy similar)");
  }
  return await db.role.create({
    data,
  });
}

export async function updateRole(id: number, data: any) {
  if (data.name) {
    const existing = await db.role.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error("El rol ya existe (nombre duplicado o muy similar)");
    }
  }
  return await db.role.update({
    where: { id },
    data,
  });
}

export async function deleteRole(id: number) {
  return await db.role.delete({
    where: { id },
  });
}

export async function assignPermissionsToRole(
  roleId: number,
  permissionIds: number[]
) {
  return await db.$transaction(async (tx) => {
    // Clear existing permissions
    await tx.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new ones
    if (permissionIds.length > 0) {
      const data = permissionIds.map((permId) => ({
        roleId,
        permissionId: permId,
      }));
      await tx.rolePermission.createMany({
        data,
        skipDuplicates: true,
      });
    }

    return true;
  });
}

export async function listPermissions() {
  return await db.permission.findMany({
    orderBy: { subject: "asc" },
  });
}
