import express from "express";
import bcrypt from "bcryptjs";
import { asyncHandler, authenticate, issueToken, sanitizeUser } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { sessionCookieName, sessionCookieOptions } from "../config.js";
import { findUserByEmail, findUserById } from "../services/users.js";
import { resolveUserRole } from "../services/roles.js";
import type { AuthenticatedRequest } from "../types.js";
import { loginSchema, mfaVerifySchema } from "../schemas.js";
import { generateMfaSecret, verifyMfaToken } from "../services/mfa.js";
import { updateUserMfa } from "../services/users.js";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyLoginOptions,
  verifyPasskeyLogin,
} from "../services/passkeys.js";

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

      const success = await verifyPasskeyRegistration(req.auth.userId, body, challenge);
      if (success) {
        res.json({ status: "ok" });
      } else {
        res.status(400).json({ status: "error", message: "Falló la verificación del Passkey" });
      }
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
        const token = issueToken({ userId: user.id, email: user.email, role: effectiveRole });
        res.cookie(sessionCookieName, token, sessionCookieOptions);

        logEvent("auth/login:passkey-success", { userId: user.id });
        res.json({
          status: "ok",
          user: { ...sanitizeUser(user), role: effectiveRole, mfaEnabled: user.mfaEnabled },
        });
      } catch (err) {
        logWarn("auth/login:passkey-failed", { error: String(err) });
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

      const { email, password } = parsed.data;
      const user = await findUserByEmail(email);
      if (!user) {
        logWarn("auth/login:unknown-user", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      // Special case: Allow login with empty password if user is in PENDING_SETUP status
      if (user.status === "PENDING_SETUP") {
        // If password is provided, try to validate it (optional, but good for security if they already set one)
        // But if they are PENDING_SETUP, we assume they might not have one or we allow the bypass.
        // For strictness: If they send empty password AND are PENDING_SETUP, we allow.
        if (!password) {
          // Allow proceed
        } else {
          // If they provided a password, check it. If it fails, but they are PENDING_SETUP,
          // we might still want to allow? No, if they try a password it should be correct.
          // BUT, the requirement is "inicio sesion con solo correo y sin clave".
          // So if password is empty string, we skip bcrypt check.
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            logWarn("auth/login:bad-password", requestContext(req, { email }));
            return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
          }
        }
      } else {
        // Normal flow for ACTIVE users
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
      const sessionToken = issueToken({ userId: user.id, email: user.email, role: effectiveRole });
      res.cookie(sessionCookieName, sessionToken, sessionCookieOptions);

      logEvent("auth/login:mfa-success", { userId });
      res.json({
        status: "ok",
        user: { ...sanitizeUser(user), role: effectiveRole },
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
      const effectiveRole = await resolveUserRole(user);
      const finalUser = { ...sanitizeUser(user), role: effectiveRole, mfaEnabled: user.mfaEnabled };
      // --- End Role Governance Logic ---

      res.json({ status: "ok", user: finalUser });
    })
  );
}
