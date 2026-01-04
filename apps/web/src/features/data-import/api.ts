import { apiClient } from "@/lib/apiClient";

export interface CsvPreviewResponse {
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  [key: string]: unknown;
}

export interface CsvImportPayload {
  table: string;
  data: Record<string, string | number>[];
}

export async function previewCsvImport(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/preview", payload);
}

export async function importCsvData(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/import", payload);
}
