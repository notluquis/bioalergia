import { Router } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticate as requireAuth, requireRole } from "../lib/http.js";
import type { AuthenticatedRequest } from "../types.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

// Schema for inviting a user
const inviteUserSchema = z.object({
  personId: z.number(),
  email: z.string().email(),
  role: z.enum(["GOD", "ADMIN", "ANALYST", "VIEWER"]),
});

// POST /api/users/invite - Create a user for an existing person
router.post("/invite", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const { personId, email, role } = inviteUserSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;

    // Check if person already has a user
    const existingUser = await prisma.user.findUnique({ where: { personId } });
    if (existingUser) return res.status(400).json({ error: "Person is already a user" });

    // Generate temporary password (or handle via email link in production)
    // For now, we set a default temp password "Temp1234!" that must be changed
    const tempPassword = await bcrypt.hash("Temp1234!", 10);

    const user = await prisma.user.create({
      data: {
        personId,
        email,
        role,
        passwordHash: tempPassword,
        status: "PENDING_SETUP",
      },
    });

    await logAudit(authReq.auth!.userId, "USER_INVITE", "User", String(user.id), { email, role, personId }, req.ip);

    res.json({ message: "User invited successfully", userId: user.id });
  } catch (error) {
    console.error("Invite error:", error);
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

    await logAudit(
      authReq.auth!.userId,
      "USER_PASSWORD_RESET",
      "User",
      String(targetUserId),
      { status: "PENDING_SETUP" },
      req.ip
    );

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
    console.error("Get profile error:", error);
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

    await logAudit(userId, "USER_SETUP", "User", String(userId), { status: "ACTIVE" }, req.ip);

    res.json({ message: "Setup complete" });
  } catch (error) {
    console.error("Setup error:", error);
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

    await logAudit(authReq.auth!.userId, "USER_MFA_DISABLE", "User", String(targetUserId), undefined, req.ip);

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

    await logAudit(
      authReq.auth!.userId,
      enabled ? "USER_MFA_ENABLE" : "USER_MFA_DISABLE",
      "User",
      String(targetUserId),
      { adminToggle: true },
      req.ip
    );

    res.json({ status: "ok", message: `MFA ${enabled ? "enabled" : "disabled"}` });
  } catch (error) {
    console.error("MFA toggle error:", error);
    res.status(500).json({ status: "error", message: "Failed to toggle MFA" });
  }
});

export default router;
