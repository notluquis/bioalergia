import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { findUserById } from "../services/users.js";
import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { logEvent } from "../lib/logger.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerUserRoutes(app: express.Express) {
  // Toggle MFA for a specific user (Admin only)
  app.post(
    "/api/users/:id/mfa/toggle",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);
      const { enabled } = req.body;

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      const user = await findUserById(targetUserId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
      }

      // If disabling, we just set enabled=false. We don't necessarily wipe the secret/passkey unless requested,
      // but for safety/simplicity, if an admin disables it, we might want to keep the secret so re-enabling works,
      // OR wipe it. The prompt said "habilitar o deshabilitar".
      // Let's just toggle the boolean flag `mfaEnabled`.
      // However, `updateUserMfa` takes (id, secret, enabled).
      // If we are enabling, we can't really "enable" if there is no secret setup.
      // But wait, the admin wants to "enable/disable".
      // If the user has never set up MFA, we can't "enable" it for them remotely (they need to scan QR).
      // So Admin can only DISABLE it (reset) or maybe "Require" it?
      // The user said "yo pueda habilitar o deshabilitar el mfa, porque el dr y su señora son ancianos".
      // Likely this means "Disable it if they get stuck" or "Turn it off so they don't need it".
      // If I "Enable" it without them setting it up, they will be locked out.
      // So "Enable" probably just means "Allow them to use it" or "Restore previous state"?
      // Let's assume Admin mainly needs to DISABLE it (rescue).
      // If Admin tries to ENABLE, check if secret exists.

      if (enabled && !user.mfaSecret && !user.passkeyCredentialID) {
        return res.status(400).json({
          status: "error",
          message: "No se puede activar MFA porque el usuario no tiene métodos configurados (App o Passkey).",
        });
      }

      // We preserve the secret/passkey, just toggle the enforcement flag.
      // But `updateUserMfa` updates both. Let's use prisma directly or update `updateUserMfa`.
      // Actually `updateUserMfa` sets secret. If we pass `user.mfaSecret`, it preserves it.

      await prisma.user.update({
        where: { id: targetUserId },
        data: { mfaEnabled: Boolean(enabled) },
      });

      logEvent("user/mfa:admin_toggle", {
        adminId: req.auth?.userId,
        targetUserId,
        enabled,
      });

      res.json({ status: "ok", mfaEnabled: enabled });
    })
  );

  // List users for management (simplified for AccessSettingsPage)
  app.get(
    "/api/users",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req, res) => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          mfaEnabled: true,
          passkeyCredentialID: true,
          createdAt: true,
          status: true,
          person: {
            select: {
              names: true,
              fatherName: true,
              rut: true,
            },
          },
        },
        orderBy: { email: "asc" },
      });

      // Map to safe response
      const safeUsers = users.map((u) => ({
        ...u,
        hasPasskey: !!u.passkeyCredentialID,
        passkeyCredentialID: undefined, // Don't leak ID if not needed
      }));

      res.json({ status: "ok", users: safeUsers });
    })
  );
  // Reset Password (Admin only)
  app.post(
    "/api/users/:id/reset-password",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      const user = await findUserById(targetUserId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
      }

      // Prevent resetting GOD users if not GOD
      if (user.role === "GOD" && req.auth?.role !== "GOD") {
        return res.status(403).json({ status: "error", message: "No tienes permisos para modificar a este usuario" });
      }

      // Generate temp password (fixed for now as requested in previous flows, or random)
      // Let's use a standard temp password "temp1234" hash for simplicity in this "emergency fix" context,
      // or better, use the same logic as the "ensure-admin" script but hardcoded hash for "temp1234".
      // Hash for "temp1234" is $2b$10$l4zVKe6jibPP4dhwcTNi2OxqvABhDJtf87aX/edUIKXVoiHptwfN6 (from previous sql)
      // OR we can import bcrypt. Let's import bcrypt to be safe and dynamic.
      const bcrypt = await import("bcryptjs");
      const tempPassword = "temp" + Math.floor(1000 + Math.random() * 9000); // temp1234 random
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          status: "PENDING_SETUP", // Force them to go through onboarding/change password
          mfaEnabled: false, // Reset MFA too so they can set it up again
          mfaSecret: null,
          passkeyCredentialID: null,
          passkeyPublicKey: null,
          passkeyCounter: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          passkeyTransports: Prisma.DbNull as any,
        },
      });

      logEvent("user:reset_password", {
        adminId: req.auth?.userId,
        targetUserId,
      });

      res.json({ status: "ok", message: "Contraseña reseteada", tempPassword });
    })
  );

  // Update User Status (Suspend/Activate)
  app.put(
    "/api/users/:id/status",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);
      const { status } = req.body;

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      if (!["ACTIVE", "SUSPENDED"].includes(status)) {
        return res.status(400).json({ status: "error", message: "Estado inválido" });
      }

      const user = await findUserById(targetUserId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
      }

      // Prevent suspending self
      if (user.id === req.auth?.userId) {
        return res.status(400).json({ status: "error", message: "No puedes suspender tu propia cuenta" });
      }

      // Prevent suspending GOD users if not GOD
      if (user.role === "GOD" && req.auth?.role !== "GOD") {
        return res.status(403).json({ status: "error", message: "No tienes permisos para modificar a este usuario" });
      }

      await prisma.user.update({
        where: { id: targetUserId },
        data: { status },
      });

      logEvent("user:status_update", {
        adminId: req.auth?.userId,
        targetUserId,
        status,
      });

      res.json({ status: "ok", message: `Usuario ${status === "ACTIVE" ? "reactivado" : "suspendido"}` });
    })
  );
}
