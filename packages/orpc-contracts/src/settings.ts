import { oc } from "@orpc/contract";
import { z } from "zod";

export const settingsSchema = z.object({
  calendarDailyMaxDays: z.string(),
  calendarExcludeSummaries: z.string(),
  calendarSyncLookaheadDays: z.string(),
  calendarSyncStart: z.string(),
  calendarTimeZone: z.string(),
  cpanelUrl: z.string(),
  dbConsoleUrl: z.string(),
  dbDisplayHost: z.string(),
  dbDisplayName: z.string(),
  faviconUrl: z.string(),
  logoUrl: z.string(),
  orgAddress: z.string(),
  orgName: z.string(),
  orgPhone: z.string(),
  pageTitle: z.string(),
  primaryColor: z.string(),
  primaryCurrency: z.string(),
  secondaryColor: z.string(),
  supportEmail: z.string(),
  whatsappFreeformMessage: z.string(),
  tagline: z.string(),
});

export const settingsInternalSchema = z.object({
  envUpsertChunkSize: z.string().optional(),
  upsertChunkSize: z.union([z.number(), z.string()]).optional(),
});

export const settingsInternalResponseSchema = z.object({
  internal: settingsInternalSchema,
});

export const settingsStatusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.string(),
});

export const settingsUploadAssetSchema = z.object({
  assetType: z.enum(["favicon", "logo"]),
});

export const settingsUpdateInternalSchema = z.object({
  upsertChunkSize: z.number().optional(),
});

export const settingsContract = {
  app: oc.route({ method: "GET", path: "/app" }).output(settingsSchema),
  updateApp: oc
    .route({ method: "PUT", path: "/app" })
    .input(settingsSchema)
    .output(settingsStatusResponseSchema),
  internal: oc
    .route({ method: "GET", path: "/internal" })
    .output(settingsInternalResponseSchema),
  updateInternal: oc
    .route({ method: "PUT", path: "/internal" })
    .input(settingsUpdateInternalSchema)
    .output(settingsStatusResponseSchema),
  uploadAsset: oc
    .route({ method: "POST", path: "/branding/upload" })
    .input(settingsUploadAssetSchema)
    .output(settingsStatusResponseSchema),
};

export type SettingsContract = typeof settingsContract;
