import type express from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../db.js";
import { isRoleAtLeast } from "../db.js";
import { JWT_SECRET, sessionCookieName, sessionCookieOptions } from "../config.js";
import type { AuthenticatedRequest, AuthSession } from "../types.js";

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
      role: session.role,
    },
    JWT_SECRET,
    {
      expiresIn: "2d",
    }
  );
}

export function sanitizeUser(user: { id: number; email: string; role: UserRole; name: string | null }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  console.info("[steps][server/auth] Step 1: authenticate", {
    url: req.originalUrl,
    method: req.method,
  });
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    console.warn("[steps][server/auth] Step 2: sin cookie de sesión");
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    console.info("[steps][server/auth] Step 3: token verificado");
    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("Token inválido");
    }

    req.auth = {
      userId: Number(decoded.sub),
      email: String(decoded.email),
      role: (decoded.role as UserRole) ?? "VIEWER",
    };
    console.info("[steps][server/auth] Step 4: req.auth establecido", req.auth);
    next();
  } catch (error) {
    console.error("[steps][server/auth] Step error: token inválido", error);
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
