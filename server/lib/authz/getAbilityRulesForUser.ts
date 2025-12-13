// server/lib/authz/getAbilityRulesForUser.ts

import { prisma } from "../../prisma.js";
import { PermissionKey, permissionMap } from "./permissionMap.js";

/**
 * Fetches all permissions for a given user from the database and transforms them
 * into a CASL Ability rule set.
 *
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of CASL rules.
 */
export async function getAbilityRulesForUser(userId: number) {
  const userWithRolesAndPermissions = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!userWithRolesAndPermissions) {
    return [];
  }

  const rules = new Set<string>();

  console.log(
    `[getAbilityRulesForUser] User ${userId} role: ${userWithRolesAndPermissions.role}. Generating standard rules.`
  );

  for (const roleAssignment of userWithRolesAndPermissions.roles) {
    for (const rolePermission of roleAssignment.role.permissions) {
      const key = `${rolePermission.permission.action}.${rolePermission.permission.subject}` as PermissionKey;
      const definition = permissionMap[key];

      if (definition) {
        // For now, we only support basic permissions. Conditions can be added later.
        const rule = JSON.stringify({
          action: definition.action,
          subject: definition.subject,
        });
        rules.add(rule);
      }
    }
  }

  return Array.from(rules).map((rule) => JSON.parse(rule));
}
