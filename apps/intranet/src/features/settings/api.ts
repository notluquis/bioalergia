import { z } from "zod";
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

export async function fetchInternalSettings() {
  try {
    return InternalSettingsResponseSchema.parse(await settingsORPCClient.internal());
  } catch (error) {
    throw toSettingsApiError(error);
  }
}

export async function updateInternalSettings(data: object) {
  try {
    return StatusResponseSchema.parse(
      await settingsORPCClient.updateInternal(data as { upsertChunkSize?: number }),
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
