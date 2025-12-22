import { apiClient } from "@/lib/apiClient";

export interface InternalSettings {
  upsertChunkSize?: number | string;
  envUpsertChunkSize?: string;
}

export interface InternalSettingsResponse {
  internal: InternalSettings;
}

export interface UploadResponse {
  status: string;
  url?: string;
  message?: string;
}

export async function fetchInternalSettings() {
  const res = await apiClient.get<InternalSettingsResponse>("/api/settings/internal");
  return res;
}

export async function updateInternalSettings(data: object) {
  return apiClient.put<{ status: string; message?: string }>("/api/settings/internal", data);
}

export async function uploadBrandingAsset(file: File, endpoint: string): Promise<string> {
  const formData = new FormData();
  // Determine field name based on endpoint or just default to something consistent if backend handles it
  // The original component logic checked endpoint content
  const fieldName = endpoint.includes("logo") ? "logo" : "favicon";
  formData.append(fieldName, file);

  const data = await apiClient.post<UploadResponse>(endpoint, formData);

  if (data.status !== "ok" || !data.url) {
    throw new Error(data.message || "Error al subir archivo");
  }
  return data.url;
}
