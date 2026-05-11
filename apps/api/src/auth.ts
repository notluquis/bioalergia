/**
 * Authentication Middleware for Hono + ZenStack v3
 *
 * Extracts JWT from Authorization header or cookies and provides
 * user context for ZenStack access control policies.
 */

import { subject as caslSubject, createMongoAbility } from "@casl/ability";
import { db } from "@finanzas/db";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "./lib/paseto.ts";
import { getAbilityRulesForUser } from "./services/authz.ts";

export type DebugScope = {
  action: string;
  subject: string;
};

// User session type matching ZenStack auth model
export interface AuthSession {
  debugAudience?: string;
  debugReason?: string;
  debugScopes?: DebugScope[];
  id: number;
  isDebugSession?: boolean;
  email: string;
  status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  roles: Array<{ role: { name: string } }>;
}

const COOKIE_NAME = "finanzas_session";
const BEARER_PREFIX = /^Bearer\s+/i;

function parseDebugScopes(value: unknown): DebugScope[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const scopes = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const action = "action" in entry ? entry.action : undefined;
      const subject = "subject" in entry ? entry.subject : undefined;
      if (typeof action !== "string" || typeof subject !== "string") {
        return null;
      }
      return { action, subject };
    })
    .filter((entry): entry is DebugScope => entry !== null);

  return scopes.length > 0 ? scopes : undefined;
}

function isDebugScopeAllowed(
  scopes: DebugScope[] | undefined,
  action: string,
  subject: string,
): boolean {
  if (!scopes || scopes.length === 0) {
    return true;
  }

  return scopes.some((scope) => scope.action === action && scope.subject === subject);
}

// Sliding session inactivity threshold. ASVS 5.0 / OWASP recommends
// 8h max for medical-data apps; if the user has not made any
// authenticated request in this window the session is invalidated
// even if the cookie itself is still within its 2-day TTL.
const INACTIVITY_THRESHOLD_MS = 8 * 60 * 60 * 1000;
// Throttle DB writes for lastActivityAt — only persist if the previous
// timestamp is older than this window. Avoids one UPDATE per request.
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 60 * 1000;

export async function resolveSessionUserFromToken(token: string): Promise<AuthSession | null> {
  try {
    const decoded = await verifyToken(token);

    if (!decoded || typeof decoded.sub !== "string") {
      return null;
    }

    const tokenType = typeof decoded.typ === "string" ? decoded.typ : "session";
    if (tokenType !== "session" && tokenType !== "debug-session") {
      return null;
    }

    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId)) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        sessionVersion: true,
        lastActivityAt: true,
        person: { select: { email: true } },
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
    const tokenSessionVersion =
      typeof decoded.sv === "number" && Number.isFinite(decoded.sv) ? decoded.sv : 1;
    if (tokenSessionVersion !== user.sessionVersion) {
      return null;
    }

    // Inactivity check (skip for debug sessions, which have explicit
    // short TTL via PASETO `exp`).
    if (tokenType === "session" && user.lastActivityAt) {
      const idle = Date.now() - user.lastActivityAt.getTime();
      if (idle > INACTIVITY_THRESHOLD_MS) {
        return null;
      }
    }

    // Touch lastActivityAt at most once per ACTIVITY_WRITE_THROTTLE_MS.
    // Fire-and-forget; failure does not block the session resolution.
    if (
      tokenType === "session" &&
      (!user.lastActivityAt ||
        Date.now() - user.lastActivityAt.getTime() > ACTIVITY_WRITE_THROTTLE_MS)
    ) {
      void db.user
        .update({ where: { id: user.id }, data: { lastActivityAt: new Date() } })
        .catch(() => undefined);
    }

    return {
      debugAudience: typeof decoded.aud === "string" ? decoded.aud : undefined,
      debugReason: typeof decoded.reason === "string" ? decoded.reason : undefined,
      debugScopes: parseDebugScopes(decoded.scp),
      email: String(decoded.email ?? user.person?.email ?? ""),
      id: user.id,
      isDebugSession: tokenType === "debug-session",
      roles: user.roles.map((roleAssignment) => ({ role: { name: roleAssignment.role.name } })),
      status: user.status,
    };
  } catch {
    return null;
  }
}

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
  let token = ctx.req.header("Authorization")?.replace(BEARER_PREFIX, "");

  // 2. Fall back to cookie
  if (!token) {
    token = getCookie(ctx, COOKIE_NAME);
  }

  if (!token) {
    return null;
  }

  try {
    const session = await resolveSessionUserFromToken(token);
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
  userOrId: AuthSession | number,
  action: string,
  subject: string,
  resource?: Record<string, unknown>,
): Promise<boolean> {
  const userId = typeof userOrId === "number" ? userOrId : userOrId.id;
  const debugScopes = typeof userOrId === "number" ? undefined : userOrId.debugScopes;

  if (!isDebugScopeAllowed(debugScopes, action, subject)) {
    return false;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return false;
  }

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
