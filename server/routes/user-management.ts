import { Router } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticate as requireAuth, requireRole } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import type { AuthenticatedRequest } from "../types.js";
import { logAudit } from "../services/audit.js";

const router = Router();

// Schema for inviting a user (Simplified Creation)
const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["GOD", "ADMIN", "ANALYST", "VIEWER"]),
  position: z.string().min(1).default("Por definir"),
  mfaEnforced: z.boolean().default(true),
  personId: z.number().optional(), // Optional: link to existing person
});

// POST /api/users/invite - Create a user for an existing person OR create new person+user
router.post("/invite", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const { email, role, position, mfaEnforced, personId } = inviteUserSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "User with this email already exists" });

    // If personId provided, verify it exists
    if (personId) {
      const personExists = await prisma.person.findUnique({ where: { id: personId } });
      if (!personExists) return res.status(400).json({ error: "Person not found" });

      // Check if person already has a user
      const existingUserForPerson = await prisma.user.findFirst({ where: { personId } });
      if (existingUserForPerson) {
        return res.status(400).json({ error: "This person already has a user account" });
      }
    }

    // Generate temporary password
    const tempPassword = await bcrypt.hash("Temp1234!", 10);

    // Transaction to create Person, User, and Employee
    const result = await prisma.$transaction(async (tx) => {
      let targetPersonId: number;

      if (personId) {
        // Use existing person
        targetPersonId = personId;
      } else {
        // Create new person - check if person exists by email to avoid duplicates
        let person = await tx.person.findFirst({ where: { email } });

        if (!person) {
          // Create new person with placeholder name
          person = await tx.person.create({
            data: {
              names: "Nuevo Usuario", // Placeholder, will be updated in onboarding
              email,
              rut: `TEMP-${Date.now()}`, // Temporary RUT, will be updated
            },
          });
        }
        targetPersonId = person.id;
      }

      // Create User
      const user = await tx.user.create({
        data: {
          personId: targetPersonId,
          email,
          role,
          passwordHash: tempPassword,
          status: "PENDING_SETUP",
          mfaEnforced,
        },
      });

      // Create or update Employee
      await tx.employee.upsert({
        where: { personId: targetPersonId },
        create: {
          personId: targetPersonId,
          position,
          startDate: new Date(),
          status: "ACTIVE",
        },
        update: {
          position, // Update position if re-inviting or linking
        },
      });

      return user;
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "USER_INVITE",
      entity: "User",
      entityId: result.id,
      details: { email, role, position, mfaEnforced, personId },
      ipAddress: req.ip,
    });

    res.json({ message: "User created successfully", userId: result.id });
  } catch (error) {
    logger.error({ tag: "UserManagement", error }, "Invite error");
    res.status(500).json({ error: "Failed to invite user" });
  }
});

// POST /api/users/:id/reset-password - Admin force reset
router.post("/:id/reset-password", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const { newPassword } = z.object({ newPassword: z.string().min(6) }).parse(req.body);
    const hash = await bcrypt.hash(newPassword, 10);
    const authReq = req as AuthenticatedRequest;
    const targetUserId = Number(req.params.id);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash: hash, status: "PENDING_SETUP" }, // Force setup again? Or just active?
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "USER_PASSWORD_RESET",
      entity: "User",
      entityId: targetUserId,
      details: { status: "PENDING_SETUP" },
      ipAddress: req.ip,
    });

    res.json({ message: "Password reset successfully" });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /api/users/profile - Get current user's profile (Person + Employee)
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      status: "ok",
      data: {
        names: user.person.names,
        fatherName: user.person.fatherName,
        motherName: user.person.motherName,
        rut: user.person.rut,
        email: user.email,
        phone: user.person.phone,
        address: user.person.address,
        bankName: user.person.employee?.bankName,
        bankAccountType: user.person.employee?.bankAccountType,
        bankAccountNumber: user.person.employee?.bankAccountNumber,
      },
    });
  } catch (error) {
    logger.error({ tag: "UserManagement", error }, "Get profile error");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// POST /api/users/setup - Complete onboarding (Full Profile + Password)
router.post("/setup", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      // Profile
      names: z.string().min(1),
      fatherName: z.string().optional(),
      motherName: z.string().optional(),
      rut: z.string().min(1), // Basic validation, should be enhanced
      phone: z.string().optional(),
      address: z.string().optional(),
      // Financial (Optional)
      bankName: z.string().optional(),
      bankAccountType: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      // Security
      password: z.string().min(8),
    });

    const data = schema.parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { person: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const hash = await bcrypt.hash(data.password, 10);

    // Transaction to update everything
    await prisma.$transaction(async (tx) => {
      // 1. Update Person
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

      // 2. Update/Create Employee (if bank details provided or just to initialize)
      // We assume every internal user is an employee for now, or we check role?
      // For now, we'll upsert the Employee record.
      await tx.employee.upsert({
        where: { personId: user.personId },
        create: {
          personId: user.personId,
          position: "Por definir", // Default
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

      // 3. Update User (Password + Status)
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: hash,
          status: "ACTIVE", // Will be ACTIVE, but MFA might be enforced next
        },
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

    res.json({ message: "Setup complete" });
  } catch (error) {
    logger.error({ tag: "UserManagement", error }, "Setup error");
    res.status(500).json({ error: "Setup failed" });
  }
});

// DELETE /api/users/:id/mfa - Admin disable MFA (Recovery)
router.delete("/:id/mfa", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = Number(req.params.id);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "USER_MFA_RESET",
      entity: "User",
      entityId: targetUserId,
      ipAddress: req.ip,
    });

    res.json({ message: "MFA disabled for user" });
  } catch {
    res.status(500).json({ error: "Failed to disable MFA" });
  }
});

// POST /api/users/:id/mfa/toggle - Admin toggle MFA
router.post("/:id/mfa/toggle", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = Number(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    if (enabled) {
      // We can't really "enable" MFA remotely without the user scanning the QR code.
      // But we can set the flag if they already have a secret?
      // Or maybe this is just to re-enable if it was disabled but secret exists?
      // For safety, we only allow disabling or re-enabling if secret exists.
      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user?.mfaSecret) {
        return res.status(400).json({ status: "error", message: "User has no MFA secret configured" });
      }
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { mfaEnabled: enabled },
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "USER_MFA_RESET", // Using RESET for toggle as per available actions
      entity: "User",
      entityId: targetUserId,
      details: { adminToggle: true, enabled },
      ipAddress: req.ip,
    });

    res.json({ status: "ok", message: `MFA ${enabled ? "enabled" : "disabled"}` });
  } catch (error) {
    logger.error({ tag: "UserManagement", error }, "MFA toggle error");
    res.status(500).json({ status: "error", message: "Failed to toggle MFA" });
  }
});

// DELETE /api/users/:id/passkey - Admin remove passkey
router.delete("/:id/passkey", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = Number(req.params.id);

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        passkeyCredentialID: null,
        passkeyPublicKey: null,
        passkeyCounter: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passkeyTransports: null as any,
      },
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "USER_PASSKEY_DELETE",
      entity: "User",
      entityId: targetUserId,
      details: { adminDelete: true },
      ipAddress: req.ip,
    });

    res.json({ status: "ok", message: "Passkey removed" });
  } catch (error) {
    logger.error({ tag: "UserManagement", error }, "Passkey delete error");
    res.status(500).json({ status: "error", message: "Failed to remove Passkey" });
  }
});

export default router;
