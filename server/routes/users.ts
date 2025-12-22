import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { findUserById, assignUserRole } from "../services/users.js";
import { prisma, Prisma } from "../prisma.js";
import { logEvent } from "../lib/logger.js";
import { logAudit } from "../services/audit.js";
import type { AuthenticatedRequest } from "../types.js";
import { normalizeRut } from "../lib/rut.js";

// Schema for inviting a user
const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  position: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val : "Por definir")),
  mfaEnforced: z.boolean().default(true),
  personId: z.number().optional(),
});

export function registerUserRoutes(app: express.Express) {
  // Toggle MFA for a specific user (Admin only)
  app.post(
    "/api/users/:id/mfa/toggle",
    authenticate,
    authorize("manage", "User"),
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
    authorize("read", "User"),
    asyncHandler(async (req, res) => {
      const includeTest = req.query.includeTest === "true";

      const users = await prisma.user.findMany({
        where: includeTest
          ? undefined
          : {
              // Exclude test users and test persons by default
              NOT: {
                OR: [
                  { email: { contains: "test" } },
                  { email: { contains: "debug" } },
                  {
                    person: {
                      OR: [
                        { names: { contains: "Test" } },
                        { names: { contains: "test" } },
                        { names: { contains: "Debug" } },
                        { names: { contains: "debug" } },
                        { rut: { startsWith: "11111111" } },
                      ],
                    },
                  },
                ],
              },
            },
        select: {
          id: true,
          email: true,
          roles: {
            select: {
              role: {
                select: { name: true },
              },
            },
          },
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
        role: u.roles[0]?.role.name || "VIEWER", // Flatten role for frontend compatibility
        person: u.person
          ? {
              ...u.person,
              rut: normalizeRut(u.person.rut),
            }
          : null,
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
    authorize("manage", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      const user = await findUserById(targetUserId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
      }

      // Generate random temporary password
      const bcrypt = await import("bcryptjs");
      const tempPassword = "temp" + Math.floor(1000 + Math.random() * 9000);
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
          passkeyTransports: Prisma.DbNull,
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
    authorize("manage", "User"),
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
  // Update User Role
  app.put(
    "/api/users/:id/role",
    authenticate,
    authorize("update", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);
      const { role } = req.body;

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ status: "error", message: "Rol requerido" });
      }

      try {
        await assignUserRole(targetUserId, role);

        logEvent("user:role_update", {
          adminId: req.auth?.userId,
          targetUserId,
          newRole: role,
        });

        res.json({ status: "ok", message: "Rol actualizado correctamente" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error desconocido al actualizar rol";
        res.status(400).json({ status: "error", message });
      }
    })
  );

  // Delete User
  app.delete(
    "/api/users/:id",
    authenticate,
    authorize("delete", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      // Prevent deleting self
      if (req.auth?.userId === targetUserId) {
        return res.status(400).json({ status: "error", message: "No puedes eliminar tu propia cuenta" });
      }

      try {
        await prisma.user.delete({
          where: { id: targetUserId },
        });

        logEvent("user:delete", {
          adminId: req.auth?.userId,
          targetUserId,
        });

        res.json({ status: "ok", message: "Usuario eliminado correctamente" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error al eliminar usuario";
        res.status(500).json({ status: "error", message });
      }
    })
  );

  // ========================================
  // User Management Endpoints (Consolidated)
  // ========================================

  // POST /api/users/invite - Create a user for an existing person OR create new person+user
  app.post(
    "/api/users/invite",
    authenticate,
    authorize("create", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { email, role, position, mfaEnforced, personId } = inviteUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ status: "error", message: "User with this email already exists" });
      }

      // If personId provided, verify it exists
      if (personId) {
        const personExists = await prisma.person.findUnique({ where: { id: personId } });
        if (!personExists) {
          return res.status(400).json({ status: "error", message: "Person not found" });
        }

        const existingUserForPerson = await prisma.user.findFirst({ where: { personId } });
        if (existingUserForPerson) {
          return res.status(400).json({ status: "error", message: "This person already has a user account" });
        }
      }

      // Generate temporary password
      const tempPassword = await bcrypt.hash("Temp1234!", 10);

      // Transaction to create Person, User, and Employee
      const result = await prisma.$transaction(async (tx) => {
        let targetPersonId: number;

        if (personId) {
          targetPersonId = personId;
        } else {
          let person = await tx.person.findFirst({ where: { email } });
          if (!person) {
            person = await tx.person.create({
              data: {
                names: "Nuevo Usuario",
                email,
                rut: `TEMP-${Date.now()}`,
              },
            });
          }
          targetPersonId = person.id;
        }

        const user = await tx.user.create({
          data: {
            personId: targetPersonId,
            email: email.toLowerCase(),
            passwordHash: tempPassword,
            status: "PENDING_SETUP",
            mfaEnforced,
          },
        });

        // Assign Role
        const roleRecord = await tx.role.findUnique({ where: { name: role } });
        if (roleRecord) {
          await tx.userRoleAssignment.create({
            data: { userId: user.id, roleId: roleRecord.id },
          });
        } else {
          const viewerRole = await tx.role.findUnique({ where: { name: "VIEWER" } });
          if (viewerRole) {
            await tx.userRoleAssignment.create({
              data: { userId: user.id, roleId: viewerRole.id },
            });
          }
        }

        await tx.employee.upsert({
          where: { personId: targetPersonId },
          create: {
            personId: targetPersonId,
            position,
            startDate: new Date(),
            status: "ACTIVE",
          },
          update: { position },
        });

        return user;
      });

      await logAudit({
        userId: req.auth!.userId,
        action: "USER_INVITE",
        entity: "User",
        entityId: result.id,
        details: { email, role, position, mfaEnforced, personId },
        ipAddress: req.ip,
      });

      res.json({ status: "ok", message: "User created successfully", userId: result.id });
    })
  );

  // GET /api/users/profile - Get current user's profile
  app.get(
    "/api/users/profile",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = req.auth!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          person: {
            include: { employee: true },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ status: "error", message: "User not found" });
      }

      res.json({
        status: "ok",
        data: {
          names: user.person.names,
          fatherName: user.person.fatherName,
          motherName: user.person.motherName,
          rut: normalizeRut(user.person.rut),
          email: user.email,
          phone: user.person.phone,
          address: user.person.address,
          bankName: user.person.employee?.bankName,
          bankAccountType: user.person.employee?.bankAccountType,
          bankAccountNumber: user.person.employee?.bankAccountNumber,
        },
      });
    })
  );

  // POST /api/users/setup - Complete onboarding
  app.post(
    "/api/users/setup",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const schema = z.object({
        names: z.string().min(1),
        fatherName: z.string().optional(),
        motherName: z.string().optional(),
        rut: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        bankName: z.string().optional(),
        bankAccountType: z.string().optional(),
        bankAccountNumber: z.string().optional(),
        password: z.string().min(8),
      });

      const data = schema.parse(req.body);
      const userId = req.auth!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { person: true },
      });

      if (!user) {
        return res.status(404).json({ status: "error", message: "User not found" });
      }

      const hash = await bcrypt.hash(data.password, 10);

      await prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: user.personId },
          data: {
            names: data.names,
            fatherName: data.fatherName,
            motherName: data.motherName,
            rut: data.rut,
            phone: data.phone,
            address: data.address,
          },
        });

        await tx.employee.upsert({
          where: { personId: user.personId },
          create: {
            personId: user.personId,
            position: "Por definir",
            startDate: new Date(),
            bankName: data.bankName,
            bankAccountType: data.bankAccountType,
            bankAccountNumber: data.bankAccountNumber,
          },
          update: {
            bankName: data.bankName,
            bankAccountType: data.bankAccountType,
            bankAccountNumber: data.bankAccountNumber,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { passwordHash: hash, status: "ACTIVE" },
        });
      });

      await logAudit({
        userId,
        action: "USER_SETUP",
        entity: "User",
        entityId: userId,
        details: { status: "ACTIVE" },
        ipAddress: req.ip,
      });

      res.json({ status: "ok", message: "Setup complete" });
    })
  );

  // DELETE /api/users/:id/mfa - Admin disable MFA (Recovery)
  app.delete(
    "/api/users/:id/mfa",
    authenticate,
    authorize("manage", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      await prisma.user.update({
        where: { id: targetUserId },
        data: { mfaEnabled: false, mfaSecret: null },
      });

      await logAudit({
        userId: req.auth!.userId,
        action: "USER_MFA_RESET",
        entity: "User",
        entityId: targetUserId,
        ipAddress: req.ip,
      });

      res.json({ status: "ok", message: "MFA disabled for user" });
    })
  );

  // DELETE /api/users/:id/passkey - Admin remove passkey
  app.delete(
    "/api/users/:id/passkey",
    authenticate,
    authorize("manage", "User"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const targetUserId = Number(req.params.id);

      if (isNaN(targetUserId)) {
        return res.status(400).json({ status: "error", message: "ID de usuario inválido" });
      }

      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          passkeyCredentialID: null,
          passkeyPublicKey: null,
          passkeyCounter: 0,
          passkeyTransports: Prisma.DbNull,
        },
      });

      await logAudit({
        userId: req.auth!.userId,
        action: "USER_PASSKEY_DELETE",
        entity: "User",
        entityId: targetUserId,
        details: { adminDelete: true },
        ipAddress: req.ip,
      });

      res.json({ status: "ok", message: "Passkey removed" });
    })
  );
}
