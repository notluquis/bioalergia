import { prisma } from "../prisma.js";

export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      person: {
        select: {
          names: true,
          fatherName: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

export async function findUserById(id: number) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      person: {
        select: {
          names: true,
          fatherName: true,
        },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

export async function updateUserMfa(userId: number, secret: string | null, enabled: boolean) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: secret,
      mfaEnabled: enabled,
    },
  });
}

export async function resolveUserRole(user: { roles?: Array<{ role?: { name: string }; name?: string }> }) {
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.map((r) => r.role?.name || r.name).filter((r): r is string => !!r);
  }
  return [];
}

export async function findUsersByRoleIds(roleIds: number[]) {
  return await prisma.user.findMany({
    where: {
      roles: {
        some: {
          roleId: {
            in: roleIds,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      person: {
        select: {
          names: true,
          fatherName: true,
        },
      },
    },
  });
}
// ... existing imports

export async function assignUserRole(userId: number, roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error(`Rol '${roleName}' no encontrado.`);
  }

  // Replace existing roles with the new one (Single Role Strategy for now)
  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({
      where: { userId },
    }),
    prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId: role.id,
      },
    }),
  ]);

  return role;
}
