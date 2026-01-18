import { apiClient } from "@/lib/apiClient";

export interface CsvImportPayload {
  data: Record<string, number | string>[];
  table: string;
}

export interface CsvPreviewResponse {
  [key: string]: unknown;
  errors?: string[];
  inserted?: number;
  skipped?: number;
  toInsert: number;
  toSkip: number;
  toUpdate: number;
  updated?: number;
}

export async function importCsvData(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/import", payload);
}

export async function previewCsvImport(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/preview", payload);
}
