import { z } from "zod";

import { validateRut } from "../lib/rut.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  code: z.string().optional(), // MFA code
});

export const mfaVerifySchema = z.object({
  token: z.string().min(6).max(6),
  secret: z.string().optional(), // For setup verification
  userId: z.number().int().optional(), // For login verification
});

export const monthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato inválido (YYYY-MM)"),
});

export const updateClassificationSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
  category: z.string().optional(),
  amountExpected: z.coerce.number().optional(),
  amountPaid: z.coerce.number().optional(),
  attended: z.boolean().optional(),
  dosage: z.string().optional(),
  treatmentStage: z.string().optional(),
});

// New schemas moved from users.ts

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  position: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val : "Por definir")),
  mfaEnforced: z.boolean().default(true),
  personId: z.number().optional(),
});

export const setupUserSchema = z.object({
  names: z.string().min(1),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  rut: z
    .string()
    .trim()
    .min(1)
    .refine((val) => validateRut(val), { message: "RUT inválido" }), // Added validation for robustness
  phone: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountType: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  password: z.string().min(8),
});
