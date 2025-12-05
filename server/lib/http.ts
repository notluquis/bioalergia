import type express from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
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

export function isRoleAtLeast(role: UserRole, expected: UserRole[]): boolean {
  if (role === "GOD") return true;
  if (expected.includes(role)) return true;
  return false;
}

export function issueToken(session: AuthSession) {
  return jwt.sign(
    {
      sub: session.userId.toString(),
      email: session.email,
      role: session.role,
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
  role: UserRole;
  status: string;
  passkeyCredentialID?: string | null;
  mfaEnabled?: boolean;
  mfaEnforced?: boolean;
  person?: { names: string; fatherName: string | null } | null;
}) {
  // Build display name: first name + father's last name
  let displayName: string | null = null;
  if (user.person) {
    const firstName = user.person.names.split(" ")[0]; // Take only first name
    displayName = [firstName, user.person.fatherName].filter(Boolean).join(" ");
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: displayName,
    hasPasskey: !!user.passkeyCredentialID,
    mfaEnabled: user.mfaEnabled ?? false,
    mfaEnforced: user.mfaEnforced ?? true,
  };
}

export function authenticate(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const requestLogger = getRequestLogger(req);
  requestLogger.info({ event: "auth:authenticate", url: req.originalUrl });
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    requestLogger.warn({ event: "auth:no-cookie" });
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    requestLogger.info({ event: "auth:token-verified" });
    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("Token inválido");
    }

    req.auth = {
      userId: Number(decoded.sub),
      email: String(decoded.email),
      role: (decoded.role as UserRole) ?? "VIEWER",
    };
    requestLogger.info({ event: "auth:session-set", auth: req.auth });
    next();
  } catch (error) {
    requestLogger.error({ event: "auth:error", error }, "Token inválido o expirado");
    res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
    return res.status(401).json({ status: "error", message: "Sesión expirada" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ status: "error", message: "No autorizado" });
    }
    if (!isRoleAtLeast(req.auth.role, roles)) {
      return res.status(403).json({ status: "error", message: "Permisos insuficientes" });
    }
    next();
  };
}
