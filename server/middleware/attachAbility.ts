// server/middleware/attachAbility.ts

import { Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { getAbilityRulesForUser } from "../lib/authz/getAbilityRulesForUser.js";
import { getCachedRules, setCachedRules } from "../lib/authz/rulesCache.js";
import { sessionCookieName, sessionCookieOptions } from "../config.js";
import { createAbility } from "../lib/authz/ability.js";
import { AuthenticatedRequest } from "../types.js";

export async function attachAbility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      // For public routes, attach a guest ability
      req.ability = createAbility([]);
      req.abilityRules = [];
      req.permissionVersion = 0;
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user) {
      // User deleted or stale token - clear session and require login
      res.clearCookie(sessionCookieName, sessionCookieOptions);
      return res.status(401).json({ status: "error", message: "Sesión inválida - Usuario no encontrado" });
    }

    console.log(`[attachAbility] Authenticated User: ID=${user.id}`);

    // Attach user to request for downstream handlers
    req.user = user;

    const userId = user.id;

    // Upsert UserPermissionVersion
    const userPermissionVersion = await prisma.userPermissionVersion.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const version = userPermissionVersion.version;
    let rules = getCachedRules(userId, version);

    if (!rules) {
      rules = await getAbilityRulesForUser(userId);
      setCachedRules(userId, version, rules);
    }

    req.ability = createAbility(rules);
    req.abilityRules = rules;
    req.permissionVersion = version;

    next();
  } catch (error) {
    console.error("[attachAbility] Error attaching ability:", error);
    next(error);
  }
}
