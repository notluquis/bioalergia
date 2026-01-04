/**
 * User Service for Hono API
 * User lookup and role management
 */

import { db } from "@finanzas/db";

export async function findUserByEmail(email: string) {
  return await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      person: true,
      roles: { include: { role: true } },
    },
  });
}

export async function findUserById(id: number) {
  return await db.user.findUnique({
    where: { id },
    include: {
      person: true,
      roles: { include: { role: true } },
    },
  });
}

export async function updateUserMfa(
  userId: number,
  secret: string | null,
  enabled: boolean,
) {
  return await db.user.update({
    where: { id: userId },
    data: { mfaSecret: secret, mfaEnabled: enabled },
  });
}

export function resolveUserRole(user: {
  roles?: Array<{ role?: { name: string } }>;
}): string[] {
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.map((r) => r.role?.name).filter((r): r is string => !!r);
  }
  return [];
}

export async function assignUserRole(userId: number, roleName: string) {
  const role = await db.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error(`Rol '${roleName}' no encontrado.`);
  }

  // Remove existing roles
  await db.userRoleAssignment.deleteMany({ where: { userId } });

  // Assign new role
  await db.userRoleAssignment.create({
    data: { userId, roleId: role.id },
  });

  return role;
}

export async function findUsersByRoleIds(roleIds: number[]) {
  return await db.user.findMany({
    where: {
      roles: {
        some: {
          roleId: { in: roleIds },
        },
      },
    },
    include: { person: true },
  });
}
