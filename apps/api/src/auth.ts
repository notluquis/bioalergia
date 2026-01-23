/**
 * Authentication Middleware for Hono + ZenStack v3
 *
 * Extracts JWT from Authorization header or cookies and provides
 * user context for ZenStack access control policies.
 */

import { createMongoAbility, subject as caslSubject } from "@casl/ability";
import { db } from "@finanzas/db";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "./lib/paseto";
import { getAbilityRulesForUser } from "./services/authz";

// User session type matching ZenStack auth model
export interface AuthSession {
  id: number;
  email: string;
  status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  roles: Array<{ role: { name: string } }>;
}

const COOKIE_NAME = "finanzas_session";

/**
 * Extract and verify PASETO token from request
 * Supports both Authorization header and cookie
 */
export async function getSessionUser(ctx: Context): Promise<AuthSession | null> {
  const cached = ctx.get("sessionUser") as AuthSession | null | undefined;
  if (cached !== undefined) {
    return cached;
  }

  // 1. Check Authorization header
  let token = ctx.req.header("Authorization")?.replace(/^Bearer\s+/i, "");

  // 2. Fall back to cookie
  if (!token) {
    token = getCookie(ctx, COOKIE_NAME);
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyToken(token);

    if (!decoded || typeof decoded.sub !== "string") {
      return null;
    }

    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId)) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user || user.status === "SUSPENDED") {
      return null;
    }

    const session: AuthSession = {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: user.roles.map((roleAssignment) => ({ role: { name: roleAssignment.role.name } })),
    };

    ctx.set("sessionUser", session);
    return session;
  } catch {
    ctx.set("sessionUser", null);
    return null;
  }
}

/**
 * Create a ZenStack-compatible auth object for policies
 * This matches the User model structure with @@auth decorator
 */
export function createAuthContext(user: AuthSession | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    status: user.status,
    roles: user.roles,
  };
}

/**
 * Check if user has a specific permission
 * Uses existing authz service to get CASL rules from database
 * @param userId - The user's ID
 * @param action - The permission action (e.g., "read", "create", "update", "delete")
 * @param subject - The permission subject (e.g., "Backup", "Setting", "User")
 */
export async function hasPermission(
  userId: number,
  action: string,
  subject: string,
  resource?: Record<string, unknown>,
): Promise<boolean> {
  const rules = await getAbilityRulesForUser(userId);

  if (rules.length === 0) {
    return false;
  }

  const normalizedSubject = subject.toLowerCase();
  const matchingRules = rules.filter(
    (rule) => rule.action === action && rule.subject.toLowerCase() === normalizedSubject,
  );

  if (matchingRules.length === 0) {
    return false;
  }

  const hasUnconditionalRule = matchingRules.some(
    (rule) => !rule.conditions || Object.keys(rule.conditions).length === 0,
  );

  if (!resource) {
    return hasUnconditionalRule;
  }

  if (hasUnconditionalRule) {
    return true;
  }

  const canonicalSubject = matchingRules[0]?.subject ?? subject;
  const ability = createMongoAbility(rules);

  return ability.can(action, caslSubject(canonicalSubject, resource));
}
