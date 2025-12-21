/**
 * Settings schemas
 */
import { z } from "zod";
import { colorRegex, dateRegex, brandAssetUrlSchema, optionalHttpsUrl } from "./shared.js";

export const settingsSchema = z.object({
  orgName: z.string().min(1).max(120),
  tagline: z.string().max(200).optional().default(""),
  primaryColor: z.string().regex(colorRegex, "Debe ser un color HEX o CSS válido"),
  secondaryColor: z.string().regex(colorRegex, "Debe ser un color HEX o CSS válido"),
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
  calendarTimeZone: z.string().trim().min(2).max(60).optional().default("America/Santiago"),
  calendarSyncStart: z.string().regex(dateRegex).optional().default("2000-01-01"),
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
