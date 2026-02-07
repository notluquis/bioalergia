import { z } from "zod";
import { apiClient } from "@/lib/api-client";

export interface CsvImportPayload {
  data: Record<string, number | string>[];
  table: string;
  period?: string; // Extracted from filename (YYYYMM format)
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

const CsvPreviewResponseSchema = z.looseObject({
  errors: z.array(z.string()).optional(),
  inserted: z.number().optional(),
  skipped: z.number().optional(),
  toInsert: z.number(),
  toSkip: z.number(),
  toUpdate: z.number(),
  updated: z.number().optional(),
});

export async function importCsvData(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/import", payload, {
    responseSchema: CsvPreviewResponseSchema,
  });
}

export async function previewCsvImport(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/preview", payload, {
    responseSchema: CsvPreviewResponseSchema,
  });
}
