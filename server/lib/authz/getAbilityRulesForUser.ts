// server/lib/authz/getAbilityRulesForUser.ts

import { prisma } from "../../prisma.js";

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

  // console.log(
  //   `[getAbilityRulesForUser] User ${userId} role: ${userWithRolesAndPermissions.role}. Generating standard rules.`
  // );

  for (const roleAssignment of userWithRolesAndPermissions.roles) {
    for (const rolePermission of roleAssignment.role.permissions) {
      // Use action/subject directly from the database
      const rule = JSON.stringify({
        action: rolePermission.permission.action,
        subject: rolePermission.permission.subject,
      });
      rules.add(rule);
    }
  }

  /*
   * removed hardcoded check.
   * Permissions must come from the DB
   */

  const finalRules = Array.from(rules).map((rule) => JSON.parse(rule));
  // console.log(`[getAbilityRulesForUser] Generated ${finalRules.length} rules for user ${userId}`);

  return finalRules;
}
