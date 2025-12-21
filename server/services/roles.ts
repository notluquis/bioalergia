import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

export async function listRoles() {
  return await prisma.role.findMany({
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

export async function createRole(data: Prisma.RoleCreateInput) {
  const existing = await prisma.role.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    throw new Error("El rol ya existe (nombre duplicado o muy similar)");
  }
  return await prisma.role.create({
    data,
  });
}

export async function updateRole(id: number, data: Prisma.RoleUpdateInput) {
  if (data.name && typeof data.name === "string") {
    const existing = await prisma.role.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error("El rol ya existe (nombre duplicado o muy similar)");
    }
  }
  return await prisma.role.update({
    where: { id },
    data,
  });
}

export async function deleteRole(id: number) {
  return await prisma.role.delete({
    where: { id },
  });
}

export async function assignPermissionsToRole(roleId: number, permissionIds: number[]) {
  // First clear existing permissions for the role
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  // Then add new ones
  const data = permissionIds.map((permId) => ({
    roleId,
    permissionId: permId,
  }));

  return await prisma.rolePermission.createMany({
    data,
  });
}
