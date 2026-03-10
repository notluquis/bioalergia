import { z } from "zod";
import { apiClient } from "@/lib/api-client";

export interface CsvImportPayload {
  data: Record<string, number | string>[];
  includeInsertRowIndexes?: boolean;
  includeUpdateRows?: boolean;
  table: string;
  period?: string; // Extracted from filename (YYYYMM format)
  mode?: "insert-only" | "insert-or-update" | "update-only"; // Import mode: insert new only, upsert, or update only
}

export interface CsvPreviewUpdateRow {
  key: string;
  rowIndex: number;
  summary: string;
}

export interface CsvPreviewResponse {
  [key: string]: unknown;
  errors?: string[];
  insertRowIndexes?: number[];
  inserted?: number;
  skipped?: number;
  toInsert: number;
  toSkip: number;
  toUpdate: number;
  updateRows?: CsvPreviewUpdateRow[];
  updated?: number;
}

const CsvPreviewResponseSchema = z.looseObject({
  errors: z.array(z.string()).optional(),
  insertRowIndexes: z.array(z.number()).optional(),
  inserted: z.number().optional(),
  skipped: z.number().optional(),
  toInsert: z.number(),
  toSkip: z.number(),
  toUpdate: z.number(),
  updateRows: z
    .array(
      z.object({
        key: z.string(),
        rowIndex: z.number(),
        summary: z.string(),
      }),
    )
    .optional(),
  updated: z.number().optional(),
});

export async function importCsvData(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/import", payload, {
    responseSchema: CsvPreviewResponseSchema,
    timeout: false,
  });
}

export async function previewCsvImport(payload: CsvImportPayload) {
  return apiClient.post<CsvPreviewResponse>("/api/csv-upload/preview", payload, {
    responseSchema: CsvPreviewResponseSchema,
    timeout: false,
  });
}
