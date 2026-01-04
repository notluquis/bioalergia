import { z } from "zod";

// ==========================================
// SHARED SCHEMAS
// ==========================================

export const colorRegex =
  /^(?:#(?:[0-9a-fA-F]{3}){1,2}|(?:oklch|hsl|rgb|var)\(.+\))$/;
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const timeRegex = /^\d{2}:\d{2}$/;
export const monthRegex = /^\d{4}-\d{2}$/;

// URL schemas
export const httpsUrlSchema = z
  .string()
  .trim()
  .url({ message: "Debe ser una URL válida" })
  .refine((value) => value.startsWith("https://"), {
    message: "Debe comenzar con https://",
  });

export const optionalHttpsUrl = z.union([z.literal(""), httpsUrlSchema]);

export const brandAssetUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith("https://") ||
      value.startsWith("/uploads/") ||
      (value.startsWith("/") && value.length > 1),
    {
      message: "Debe comenzar con https:// o una ruta interna que inicie con /",
    },
  );

// Numeric schemas
export const moneySchema = z.coerce.number().min(0);
export const clpInt = z.coerce.number().int().safe().default(0);

export const amountSchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value == null) return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return Number.NaN;
      return Math.trunc(value);
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      return Number.NaN;
    }
    return parsed;
  })
  .refine(
    (value) =>
      value == null ||
      (Number.isInteger(value) && value >= 0 && value <= 100_000_000),
    {
      message: "Monto inválido",
    },
  )
  .optional();

// ==========================================
// AUTH SCHEMAS
// ==========================================

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

// ==========================================
// SETTINGS SCHEMAS
// ==========================================

export const settingsSchema = z.object({
  orgName: z.string().min(1).max(120),
  tagline: z.string().max(200).optional().default(""),
  primaryColor: z
    .string()
    .regex(colorRegex, "Debe ser un color HEX o CSS válido"),
  secondaryColor: z
    .string()
    .regex(colorRegex, "Debe ser un color HEX o CSS válido"),
  logoUrl: brandAssetUrlSchema,
  faviconUrl: brandAssetUrlSchema,
  pageTitle: z.string().trim().min(1).max(160),
  dbDisplayHost: z.string().min(1).max(191),
  dbDisplayName: z.string().min(1).max(191),
  dbConsoleUrl: optionalHttpsUrl.default(""),
  cpanelUrl: optionalHttpsUrl.default(""),
  orgAddress: z.string().max(255).optional().default(""),
  orgPhone: z.string().max(60).optional().default(""),
  primaryCurrency: z.string().trim().min(2).max(8).optional().default("CLP"),
  supportEmail: z.string().email(),
  calendarTimeZone: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .optional()
    .default("America/Santiago"),
  calendarSyncStart: z
    .string()
    .regex(dateRegex)
    .optional()
    .default("2000-01-01"),
  calendarSyncLookaheadDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(1095)
    .transform((val) => String(val))
    .optional()
    .default("365"),
  calendarExcludeSummaries: z.string().optional().default("No Disponible"),
  calendarDailyMaxDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(120)
    .transform((val) => String(val))
    .optional()
    .default("31"),
});
