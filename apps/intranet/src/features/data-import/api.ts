import { z } from "zod";
import { csvUploadORPCClient, toCsvUploadApiError } from "./orpc";

export interface CsvImportPayload {
  data: Record<string, number | string>[];
  includeInsertRowIndexes?: boolean;
  includeUpdateRows?: boolean;
  table: Parameters<typeof csvUploadORPCClient.preview>[0]["table"];
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
      })
    )
    .optional(),
  updated: z.number().optional(),
});

export async function importCsvData(payload: CsvImportPayload) {
  try {
    return CsvPreviewResponseSchema.parse(
      await csvUploadORPCClient.import({
        data: payload.data,
        mode: payload.mode,
        table: payload.table,
      })
    );
  } catch (error) {
    throw toCsvUploadApiError(error);
  }
}

export async function previewCsvImport(payload: CsvImportPayload) {
  try {
    return CsvPreviewResponseSchema.parse(
      await csvUploadORPCClient.preview({
        data: payload.data,
        includeInsertRowIndexes: payload.includeInsertRowIndexes,
        includeUpdateRows: payload.includeUpdateRows,
        mode: payload.mode,
        table: payload.table,
      })
    );
  } catch (error) {
    throw toCsvUploadApiError(error);
  }
}
