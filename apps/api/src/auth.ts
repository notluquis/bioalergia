/**
 * Authentication Middleware for Hono + ZenStack v3
 *
 * Extracts JWT from Authorization header or cookies and provides
 * user context for ZenStack access control policies.
 */

import type { Context } from "hono";
import { verifyToken } from "./lib/paseto";

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
export async function getSessionUser(
  ctx: Context
): Promise<AuthSession | null> {
  // 1. Check Authorization header
  let token = ctx.req.header("Authorization")?.replace("Bearer ", "");

  // 2. Fall back to cookie
  if (!token) {
    const cookieHeader = ctx.req.header("Cookie");
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => c.trim().split("="))
      );
      token = cookies[COOKIE_NAME];
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyToken(token);

    if (!decoded || typeof decoded.sub !== "string") {
      return null;
    }

    // Build AuthSession matching ZenStack User model
    // The roles array matches User.roles: UserRoleAssignment[]
    const roles = (decoded.roles as string[]) || [];

    return {
      id: Number(decoded.sub),
      email: String(decoded.email || ""),
      status: "ACTIVE",
      roles: roles.map((roleName) => ({ role: { name: roleName } })),
    };
  } catch {
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
 * @param action - The permission action (e.g., "read", "create", "update", "delete", "manage")
 * @param subject - The permission subject (e.g., "Backup", "Setting", "all")
 */
export async function hasPermission(
  userId: number,
  action: string,
  subject: string
): Promise<boolean> {
  // Use existing authz service
  const { getAbilityRulesForUser } = await import("./services/authz");

  const rules = await getAbilityRulesForUser(userId);

  // Check if any rule grants the required permission
  for (const rule of rules) {
    // Check for exact match
    if (
      rule.action === action &&
      rule.subject.toLowerCase() === subject.toLowerCase()
    ) {
      return true;
    }
    // Check for "manage all" which grants everything
    if (rule.action === "manage" && rule.subject === "all") {
      return true;
    }
  }

  return false;
}
