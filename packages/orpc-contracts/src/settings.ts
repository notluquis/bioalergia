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
  shopLowStockThreshold: z.string(),
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

// ── Retención de datos (Ley 21.719) — política por tabla ─────────────
export const retentionPolicySchema = z.object({
  table: z.string(),
  enabled: z.boolean(),
  action: z.enum(["delete", "anonymize"]),
  windowDays: z.number().int(),
  dateColumn: z.string(),
  anonymizeMap: z.record(z.string(), z.unknown()),
  notes: z.string().nullable(),
  updatedAt: z.date(),
});
export const retentionPoliciesResponseSchema = z.object({
  policies: z.array(retentionPolicySchema),
});
export const upsertRetentionPolicyInputSchema = z.object({
  table: z.string().min(1),
  enabled: z.boolean().default(false),
  action: z.enum(["delete", "anonymize"]),
  windowDays: z.number().int().min(1),
  dateColumn: z.string().default("created_at"),
  anonymizeMap: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});
export const retentionTableInputSchema = z.object({ table: z.string().min(1) });

export const settingsContract = {
  app: oc.route({ method: "GET", path: "/app" }).output(settingsSchema),
  updateApp: oc
    .route({ method: "PUT", path: "/app" })
    .input(settingsSchema)
    .output(settingsStatusResponseSchema),
  internal: oc.route({ method: "GET", path: "/internal" }).output(settingsInternalResponseSchema),
  updateInternal: oc
    .route({ method: "PUT", path: "/internal" })
    .input(settingsUpdateInternalSchema)
    .output(settingsStatusResponseSchema),
  uploadAsset: oc
    .route({ method: "POST", path: "/branding/upload" })
    .input(settingsUploadAssetSchema)
    .output(settingsStatusResponseSchema),
  // Retención de datos (Ley 21.719)
  listRetentionPolicies: oc
    .route({ method: "GET", path: "/retention-policies" })
    .output(retentionPoliciesResponseSchema),
  upsertRetentionPolicy: oc
    .route({ method: "POST", path: "/retention-policies" })
    .input(upsertRetentionPolicyInputSchema)
    .output(retentionPolicySchema),
  deleteRetentionPolicy: oc
    .route({ method: "DELETE", path: "/retention-policies" })
    .input(retentionTableInputSchema)
    .output(settingsStatusResponseSchema),
};

export type SettingsContract = typeof settingsContract;
export type RetentionPolicyDto = z.infer<typeof retentionPolicySchema>;
export type UpsertRetentionPolicyInput = z.infer<typeof upsertRetentionPolicyInputSchema>;
