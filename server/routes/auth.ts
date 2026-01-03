import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler, authenticate, softAuthenticate, issueToken, sanitizeUser } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { sessionCookieName, sessionCookieOptions } from "../config.js";
import { findUserByEmail, findUserById, resolveUserRole } from "../services/users.js";
import type { AuthenticatedRequest } from "../types.js";
import { loginSchema, mfaVerifySchema } from "../schemas/index.js";
import { generateMfaSecret, verifyMfaToken } from "../services/mfa.js";
import { updateUserMfa } from "../services/users.js";
import { prisma, Prisma } from "../prisma.js";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyLoginOptions,
  verifyPasskeyLogin,
} from "../services/passkeys.js";
import { attachAbility } from "../middleware/attachAbility.js";

export function registerAuthRoutes(app: express.Express) {
  // --- Passkey Registration ---
  app.get(
    "/api/auth/passkey/register/options",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });
      const options = await generatePasskeyRegistrationOptions({ id: req.auth.userId, email: req.auth.email });
      // Store challenge in session/cookie if needed, or rely on client signing it back.
      // For this implementation, we send it to client.
      res.json(options);
    })
  );

  app.post(
    "/api/auth/passkey/register/verify",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });
      const { body, challenge } = req.body; // Client must send back the challenge they received

      try {
        const success = await verifyPasskeyRegistration(req.auth.userId, body, challenge);
        if (success) {
          res.json({ status: "ok" });
        } else {
          res.status(400).json({ status: "error", message: "Falló la verificación del Passkey" });
        }
      } catch (error) {
        console.error("[Passkey Register Endpoint] ERROR:", error);
        res.status(400).json({ status: "error", message: String(error) });
      }
    })
  );

  app.delete(
    "/api/auth/passkey/remove",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });

      await prisma.user.update({
        where: { id: req.auth.userId },
        data: {
          passkeyCredentialID: null,
          passkeyPublicKey: null,
          passkeyCounter: 0,
          passkeyTransports: Prisma.DbNull,
        },
      });

      logEvent("auth/passkey:removed", { userId: req.auth.userId });
      res.json({ status: "ok", message: "Passkey eliminado" });
    })
  );

  // --- Passkey Login ---
  app.get(
    "/api/auth/passkey/login/options",
    asyncHandler(async (req, res) => {
      const options = await generatePasskeyLoginOptions();
      res.json(options);
    })
  );

  app.post(
    "/api/auth/passkey/login/verify",
    asyncHandler(async (req, res) => {
      const { body, challenge } = req.body;

      try {
        const user = await verifyPasskeyLogin(body, challenge);

        // --- Role Governance Logic ---
        const effectiveRole = await resolveUserRole(user);
        // --- End Role Governance Logic ---

        // Passkey login bypasses MFA because it is MFA (Something you have + Something you are)
        const token = issueToken({ userId: user.id, email: user.email, roles: effectiveRole });
        res.cookie(sessionCookieName, token, sessionCookieOptions);

        logEvent("auth/login:passkey-success", { userId: user.id });
        res.json({
          status: "ok",
          user: {
            ...sanitizeUser({ ...user, roles: effectiveRole }),
            role: effectiveRole,
            mfaEnabled: user.mfaEnabled,
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[Passkey Login] Error details:", errMsg);
        logWarn("auth/login:passkey-failed", { error: errMsg, credentialId: body?.id });
        res.status(400).json({ status: "error", message: "No se pudo validar el acceso biométrico" });
      }
    })
  );

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

      const { email: rawEmail, password } = parsed.data;
      const email = rawEmail.toLowerCase();
      const user = await findUserByEmail(email);
      if (!user) {
        logWarn("auth/login:unknown-user", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      // Special case: Allow login with empty password if user is in PENDING_SETUP status
      if (user.status === "PENDING_SETUP") {
        // PENDING_SETUP users can login without password to set up passkey
        if (!password) {
          // Allow proceed without password check
        } else if (user.passwordHash) {
          // If they provided a password and have a hash, validate it
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            logWarn("auth/login:bad-password", requestContext(req, { email }));
            return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
          }
        } else {
          // User has no password hash but tried to provide password - reject
          logWarn("auth/login:no-password-set", requestContext(req, { email }));
          return res
            .status(401)
            .json({ status: "error", message: "Este usuario no tiene contraseña configurada. Use passkey." });
        }
      } else {
        // Normal flow for ACTIVE users - password is required
        if (!user.passwordHash) {
          logWarn("auth/login:no-password-hash", requestContext(req, { email }));
          return res
            .status(401)
            .json({ status: "error", message: "Error de configuración de usuario. Contacta al administrador." });
        }
        // Validate password is provided
        if (!password) {
          logWarn("auth/login:empty-password", requestContext(req, { email }));
          return res.status(401).json({ status: "error", message: "La contraseña es requerida" });
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          logWarn("auth/login:bad-password", requestContext(req, { email }));
          return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
        }
      }

      // --- Role Governance Logic ---
      const effectiveRole = await resolveUserRole(user);
      // --- End Role Governance Logic ---

      if (user.mfaEnabled) {
        logEvent("auth/login:mfa-required", requestContext(req, { userId: user.id }));
        return res.json({ status: "mfa_required", userId: user.id });
      }

      const token = issueToken({ userId: user.id, email: user.email, roles: effectiveRole });
      res.cookie(sessionCookieName, token, sessionCookieOptions);

      logEvent("auth/login:success", requestContext(req, { userId: user.id, email: user.email }));
      res.json({
        status: "ok",
        user: { ...sanitizeUser({ ...user, roles: effectiveRole }), role: effectiveRole },
      });
    })
  );

  app.post(
    "/api/auth/login/mfa",
    asyncHandler(async (req, res) => {
      const parsed = mfaVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Código inválido" });
      }

      const { userId, token } = parsed.data;
      if (!userId) {
        return res.status(400).json({ status: "error", message: "Falta userId" });
      }

      const user = await findUserById(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return res.status(400).json({ status: "error", message: "MFA no configurado o usuario inválido" });
      }

      const isValid = verifyMfaToken(token, user.mfaSecret);
      if (!isValid) {
        logWarn("auth/login:mfa-invalid", { userId });
        return res.status(401).json({ status: "error", message: "Código incorrecto" });
      }

      const effectiveRole = await resolveUserRole(user);
      const sessionToken = issueToken({ userId: user.id, email: user.email, roles: effectiveRole });
      res.cookie(sessionCookieName, sessionToken, sessionCookieOptions);

      logEvent("auth/login:mfa-success", { userId });
      res.json({
        status: "ok",
        user: { ...sanitizeUser({ ...user, roles: effectiveRole }), role: effectiveRole },
      });
    })
  );

  app.post(
    "/api/auth/mfa/setup",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });
      const { secret, qrCodeUrl } = await generateMfaSecret(req.auth.email);

      // Store secret temporarily (disabled) until verified
      await updateUserMfa(req.auth.userId, secret, false);

      res.json({ status: "ok", secret, qrCodeUrl });
    })
  );

  app.post(
    "/api/auth/mfa/enable",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });
      const parsed = mfaVerifySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ status: "error" });

      const user = await findUserById(req.auth.userId);
      if (!user || !user.mfaSecret) {
        return res.status(400).json({ status: "error", message: "Setup no iniciado" });
      }

      const isValid = verifyMfaToken(parsed.data.token, user.mfaSecret);
      if (!isValid) {
        return res.status(400).json({ status: "error", message: "Código incorrecto" });
      }

      await updateUserMfa(req.auth.userId, user.mfaSecret, true);
      logEvent("auth/mfa:enabled", { userId: req.auth.userId });
      res.json({ status: "ok" });
    })
  );

  app.post(
    "/api/auth/mfa/disable",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) return res.status(401).json({ status: "error" });
      await updateUserMfa(req.auth.userId, null, false);
      logEvent("auth/mfa:disabled", { userId: req.auth.userId });
      res.json({ status: "ok" });
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
    "/api/auth/me/session",
    softAuthenticate,
    attachAbility,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth || !req.user) {
        // Return 200 with null user to avoid browser console 401 errors
        return res.json({ status: "ok", user: null });
      }

      const user = req.user;

      // --- Role Governance Logic ---
      // The user from middleware doesn't include roles, so we use users from findUserById which does
      const userWithRoles = await findUserById(user.id);
      const effectiveRole = userWithRoles ? await resolveUserRole(userWithRoles) : "VIEWER";
      const rolesArray = Array.isArray(effectiveRole) ? effectiveRole : [effectiveRole];
      const finalUser = {
        ...sanitizeUser({ ...user, roles: rolesArray }),
        role: effectiveRole,
        mfaEnabled: user.mfaEnabled,
        mfaEnforced: user.mfaEnforced,
      };
      // --- End Role Governance Logic ---

      res.json({
        status: "ok",
        user: finalUser,
        abilityRules: req.abilityRules,
        permissionVersion: req.permissionVersion,
      });
    })
  );

  // Emergency Repair Endpoint for Permissions
  app.get(
    "/api/auth/repair-permissions",
    authenticate,
    attachAbility, // Required to check permissions
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      // Only users with 'role.update' permission can repair permissions.
      const hasPermission = req.ability?.can("update", "Role");

      if (!hasPermission) {
        logWarn("auth/repair:unauthorized-attempt", { userId: req.auth?.userId });
        return res.status(403).json({
          status: "error",
          message: "Unauthorized: You need 'role.update' permission.",
        });
      }

      console.log("Repairing permissions via HTTP endpoint...");

      // Use the centralized syncPermissions function which:
      // 1. Creates permissions from ROUTE_DATA subjects
      // 2. Creates permissions from API_PERMISSIONS
      // 3. Cleans up obsolete permissions
      // 4. Auto-assigns ALL permissions to SystemAdministrator
      const { syncPermissions } = await import("../services/permissions.js");
      await syncPermissions();

      // Increment version for all users to force refresh
      await prisma.userPermissionVersion.updateMany({
        data: { version: { increment: 1 } },
      });

      res.json({
        status: "ok",
        message: "Permissions repaired and synced from route-data.ts",
      });
    })
  );
}
