// server/middleware/attachAbility.ts

import { Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { getAbilityRulesForUser } from "../lib/authz/getAbilityRulesForUser.js";
import { getCachedRules, setCachedRules } from "../lib/authz/rulesCache.js";
import { createAbility } from "../lib/authz/ability.js";
import { AuthenticatedRequest } from "../types.js";

export async function attachAbility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    // For public routes, attach a guest ability
    req.ability = createAbility([]);
    req.abilityRules = [];
    req.permissionVersion = 0;
    return next();
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) {
    // This should not happen if the token is valid
    return next(new Error("User not found"));
  }

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
}
