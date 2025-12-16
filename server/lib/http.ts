import type express from "express";
import jwt from "jsonwebtoken";

import { JWT_SECRET, sessionCookieName, sessionCookieOptions } from "../config.js";
import type { AuthenticatedRequest, AuthSession } from "../types.js";
import { getRequestLogger } from "./logger.js";

export type AsyncHandler = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => Promise<unknown>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    handler(req as AuthenticatedRequest, res, next).catch(next);
  };
}

export function issueToken(session: AuthSession) {
  return jwt.sign(
    {
      sub: session.userId.toString(),
      email: session.email,
      roles: session.roles,
    },
    JWT_SECRET,
    {
      expiresIn: "2d",
    }
  );
}

export function sanitizeUser(user: {
  id: number;
  email: string;
  roles: string[];
  status: string;
  passkeyCredentialID?: string | null;
  mfaEnabled?: boolean;
  mfaEnforced?: boolean;
  person?: { names: string; fatherName: string | null } | null;
}) {
  // Build display name: first name + father's last name
  // Build display name: first name + father's last name
  // Smart logic: detect if names already includes surnames to avoid duplication
  let displayName: string | null = null;
  if (user.person) {
    const names = user.person.names.trim();
    const father = user.person.fatherName?.trim();

    if (father && names.toLowerCase().includes(father.toLowerCase())) {
      // Names already includes the father name, so use names as is (but better capitalized if needed)
      // Or if we want strictly First + Last:
      // Attempt to extract First Name even if names has full name
      // Heuristic: If names has 3+ parts it's likely Full Name.
      // For now: Clean up and Title Case.
      displayName = toTitleCase(names);
    } else {
      // Concatenate if distinct
      const firstName = names.split(" ")[0];
      displayName = toTitleCase([firstName, father].filter(Boolean).join(" "));
    }
  }

  function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    status: user.status,
    name: displayName,
    hasPasskey: !!user.passkeyCredentialID,
    mfaEnabled: user.mfaEnabled ?? false,
    mfaEnforced: user.mfaEnforced ?? true,
  };
}

export function authenticate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const requestLogger = getRequestLogger(req);
  requestLogger.debug({ event: "auth:authenticate", url: req.originalUrl });
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    requestLogger.warn({ event: "auth:no-cookie" });
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    requestLogger.debug({ event: "auth:token-verified" });
    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("Token inválido");
    }

    req.auth = {
      userId: Number(decoded.sub),
      email: String(decoded.email),
      roles: (decoded.roles as string[]) || [],
    };
    requestLogger.debug({ event: "auth:session-set", auth: req.auth });
    next();
  } catch (error) {
    requestLogger.error({ event: "auth:error", error }, "Token inválido o expirado");
    res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
    return res.status(401).json({ status: "error", message: "Sesión expirada" });
  }
}

export function softAuthenticate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (decoded && typeof decoded.sub === "string") {
      req.auth = {
        userId: Number(decoded.sub),
        email: String(decoded.email),
        roles: (decoded.roles as string[]) || [],
      };
    }
  } catch {
    // Ignore error, just don't set req.auth
  }
  next();
}
