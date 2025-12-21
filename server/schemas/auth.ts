/**
 * Auth & Calendar schemas
 */
import { z } from "zod";
import { monthRegex, amountSchema } from "./shared.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional().default(""), // Allow empty for PENDING_SETUP users only
});

export const mfaVerifySchema = z.object({
  token: z.string().length(6, "El código debe tener 6 dígitos"),
  userId: z.coerce.number().int().positive().optional(),
});

export const monthParamSchema = z.object({
  month: z.string().regex(monthRegex, "Formato debe ser YYYY-MM"),
});

export const updateClassificationSchema = z.object({
  calendarId: z.string().min(1).max(200),
  eventId: z.string().min(1).max(200),
  category: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }),
  amountExpected: amountSchema,
  amountPaid: amountSchema,
  attended: z.boolean().nullable().optional(),
  dosage: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((value) => (value && value.length ? value : null)),
  treatmentStage: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((value) => (value && value.length ? value : null)),
  classification: z.enum(["personal", "business", "mixed", "other"]).optional(),
  notes: z.string().max(500).optional().nullable(),
});
