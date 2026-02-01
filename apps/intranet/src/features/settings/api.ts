import { z } from "zod";
import { apiClient } from "@/lib/api-client";

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
  const res = await apiClient.get<InternalSettingsResponse>("/api/settings/internal", {
    responseSchema: InternalSettingsResponseSchema,
  });
  return res;
}

export async function updateInternalSettings(data: object) {
  return apiClient.put<{ message?: string; status: string }>("/api/settings/internal", data, {
    responseSchema: StatusResponseSchema,
  });
}

export async function uploadBrandingAsset(file: File, endpoint: string): Promise<string> {
  const formData = new FormData();
  // Determine field name based on endpoint or just default to something consistent if backend handles it
  // The original component logic checked endpoint content
  const fieldName = endpoint.includes("logo") ? "logo" : "favicon";
  formData.append(fieldName, file);

  const data = await apiClient.post<UploadResponse>(endpoint, formData, {
    responseSchema: UploadResponseSchema,
  });

  if (data.status !== "ok" || !data.url) {
    throw new Error(data.message || "Error al subir archivo");
  }
  return data.url;
}
