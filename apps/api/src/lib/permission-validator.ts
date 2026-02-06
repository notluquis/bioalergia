/**
 * Permission Validator
 *
 * Centralizes validation logic for dangerous/non-standard permissions.
 * Used by:
 * - services/roles.ts (filter permissions before returning to frontend)
 * - scripts/cleanup-dangerous-permissions.ts (identify perms to delete)
 *
 * Design Decision:
 * - "manage" action is considered dangerous because it's overly permissive
 * - Project standard requires explicit CRUD permissions (create, read, update, delete)
 * - See: cleanup-dangerous-permissions.ts for historical context
 */

export interface PermissionPattern {
  action: string;
  subject?: string; // undefined means "any subject"
}

/**
 * Patterns that identify dangerous/non-standard permissions
 */
export const DANGEROUS_PERMISSION_PATTERNS: readonly PermissionPattern[] = [
  { action: "manage" }, // 'manage' on any subject is overly permissive
  { action: "manage", subject: "all" }, // Specifically manage:all (redundant but explicit)
] as const;

/**
 * Check if a permission matches any dangerous pattern
 */
export function isDangerousPermission(action: string, subject: string): boolean {
  return DANGEROUS_PERMISSION_PATTERNS.some((pattern) => {
    const actionMatches = pattern.action === action;
    const subjectMatches = !pattern.subject || pattern.subject === subject;
    return actionMatches && subjectMatches;
  });
}

/**
 * Filter out dangerous permissions from a list
 * Generic to work with any object that has action/subject properties
 */
export function filterSafePermissions<T extends { action: string; subject: string }>(
  permissions: T[],
): T[] {
  return permissions.filter((p) => !isDangerousPermission(p.action, p.subject));
}

/**
 * Build a Prisma where clause to find dangerous permissions
 * Used by cleanup scripts to query the database
 */
export function buildDangerousPermissionsWhereClause() {
  return {
    OR: DANGEROUS_PERMISSION_PATTERNS.map((pattern) => {
      if (pattern.subject) {
        return {
          AND: [{ action: pattern.action }, { subject: pattern.subject }],
        };
      }
      return { action: pattern.action };
    }),
  };
}
