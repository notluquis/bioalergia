import { z } from "zod";
import type { AppSettings } from "./hooks/use-settings";
import { settingsORPCClient, toSettingsApiError } from "./orpc";

export interface InternalSettings {
  envUpsertChunkSize?: string;
  upsertChunkSize?: number | string;
}

export interface InternalSettingsResponse {
  internal: InternalSettings;
}

export interface UploadResponse {
  message?: string;
  status: string;
  url?: string;
}

const InternalSettingsResponseSchema = z.looseObject({
  internal: z.object({
    envUpsertChunkSize: z.string().optional(),
    upsertChunkSize: z.union([z.number(), z.string()]).optional(),
  }),
});

const StatusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.string(),
});

const UploadResponseSchema = z.object({
  message: z.string().optional(),
  status: z.string(),
  url: z.string().optional(),
});

const AppSettingsSchema = z.object({
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

export async function fetchInternalSettings() {
  try {
    return InternalSettingsResponseSchema.parse(await settingsORPCClient.internal());
  } catch (error) {
    throw toSettingsApiError(error);
  }
}

export async function fetchAppSettings() {
  try {
    return AppSettingsSchema.parse(await settingsORPCClient.app());
  } catch (error) {
    throw toSettingsApiError(error);
  }
}

export async function updateAppSettings(data: AppSettings) {
  try {
    return StatusResponseSchema.parse(await settingsORPCClient.updateApp(data));
  } catch (error) {
    throw toSettingsApiError(error);
  }
}

export async function updateInternalSettings(data: object) {
  try {
    return StatusResponseSchema.parse(
      await settingsORPCClient.updateInternal(data as { upsertChunkSize?: number })
    );
  } catch (error) {
    throw toSettingsApiError(error);
  }
}

export async function uploadBrandingAsset(file: File, endpoint: string): Promise<string> {
  void file;

  const assetType = endpoint.includes("logo") ? "logo" : "favicon";

  let data: UploadResponse;
  try {
    data = UploadResponseSchema.parse(await settingsORPCClient.uploadAsset({ assetType }));
  } catch (error) {
    throw toSettingsApiError(error);
  }

  if (data.status !== "ok" || !data.url) {
    throw new Error(data.message || "Error al subir archivo");
  }
  return data.url;
}
