// server/lib/authz/getAbilityRulesForUser.ts

import { prisma } from "../../prisma.js";

// Generic rule type that accepts any action/subject from DB
interface CASLRule {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
}

/**
 * Substitutes special placeholders in conditions with actual user values.
 * Supported placeholders:
 * - ${userId} -> the current user's ID
 * - ${personId} -> the current user's person ID
 */
function substituteConditionVariables(
  conditions: Record<string, unknown>,
  context: { userId: number; personId?: number }
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(conditions)) {
    if (typeof value === "string") {
      if (value === "${userId}") {
        result[key] = context.userId;
      } else if (value === "${personId}") {
        result[key] = context.personId;
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = substituteConditionVariables(value as Record<string, unknown>, context);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Fetches all permissions for a given user from the database and transforms them
 * into a CASL Ability rule set.
 *
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of CASL rules.
 */
export async function getAbilityRulesForUser(userId: number): Promise<CASLRule[]> {
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

  const context = {
    userId: userWithRolesAndPermissions.id,
    personId: userWithRolesAndPermissions.personId,
  };

  const rulesMap = new Map<string, CASLRule>();

  for (const roleAssignment of userWithRolesAndPermissions.roles) {
    for (const rolePermission of roleAssignment.role.permissions) {
      const { action, subject } = rolePermission.permission;

      // Build the rule
      const rule: CASLRule = {
        action,
        subject,
      };

      // Apply conditions if present (with variable substitution)
      if (rolePermission.conditions && typeof rolePermission.conditions === "object") {
        rule.conditions = substituteConditionVariables(rolePermission.conditions as Record<string, unknown>, context);
      }

      // Use a key that includes conditions to allow multiple rules per action/subject
      const key = JSON.stringify(rule);
      if (!rulesMap.has(key)) {
        rulesMap.set(key, rule);
      }
    }
  }

  const finalRules = Array.from(rulesMap.values());
  // console.log(`[getAbilityRulesForUser] Generated ${finalRules.length} rules for user ${userId}`);

  return finalRules;
}
