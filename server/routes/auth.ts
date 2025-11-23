import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler, authenticate, issueToken, sanitizeUser } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { sessionCookieName, sessionCookieOptions } from "../config.js";
import { findUserByEmail, findUserById } from "../services/users.js";
import { findEmployeeByEmail } from "../services/employees.js";
import { listRoleMappings } from "../services/roles.js";
import type { AuthenticatedRequest } from "../types.js";
import { loginSchema } from "../schemas.js";

export function registerAuthRoutes(app: express.Express) {
  app.post(
    "/api/auth/login",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent(
        "auth/login:attempt",
        requestContext(req, { body: req.body ? { ...req.body, password: "***" } : undefined })
      );
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("auth/login:invalid-payload", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Credenciales no válidas" });
      }

      const { email, password } = parsed.data;
      const user = await findUserByEmail(email);
      if (!user) {
        logWarn("auth/login:unknown-user", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        logWarn("auth/login:bad-password", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      // --- Role Governance Logic ---
      const employee = await findEmployeeByEmail(user.email);
      const mappings = await listRoleMappings();
      const mapping = employee ? mappings.find((m) => m.employee_role === employee.role) : undefined;
      const effectiveRole = mapping ? mapping.app_role : user.role;
      // --- End Role Governance Logic ---

      const token = issueToken({ userId: user.id, email: user.email, role: effectiveRole });
      res.cookie(sessionCookieName, token, sessionCookieOptions);

      logEvent("auth/login:success", requestContext(req, { userId: user.id, email: user.email }));
      res.json({
        status: "ok",
        user: { ...sanitizeUser(user), role: effectiveRole },
      });
    })
  );

  app.post(
    "/api/auth/logout",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent("auth/logout", requestContext(req));
      res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
      res.json({ status: "ok" });
    })
  );

  app.get(
    "/api/auth/me",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) {
        logWarn("auth/me:missing-session", requestContext(req));
        return res.status(401).json({ status: "error", message: "La sesión no es válida" });
      }

      const user = await findUserById(req.auth.userId);
      if (!user) {
        logWarn("auth/me:stale-session", requestContext(req));
        res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
        return res.status(401).json({ status: "error", message: "La sesión ha expirado" });
      }

      // --- Role Governance Logic ---
      const employee = await findEmployeeByEmail(user.email);
      const mappings = await listRoleMappings();
      const mapping = employee ? mappings.find((m) => m.employee_role === employee.role) : undefined;
      const effectiveRole = mapping ? mapping.app_role : user.role;

      const finalUser = { ...sanitizeUser(user), role: effectiveRole };
      // --- End Role Governance Logic ---

      res.json({ status: "ok", user: finalUser });
    })
  );
}
