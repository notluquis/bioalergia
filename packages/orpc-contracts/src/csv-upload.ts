import { oc } from "@orpc/contract";
import { z } from "zod";

export const csvUploadTableSchema = z.enum([
  "people",
  "employees",
  "counterparts",
  "daily_balances",
  "daily_production_balances",
  "transactions",
  "withdrawals",
  "services",
  "inventory_items",
  "employee_timesheets",
  "dte_purchases",
  "dte_sales",
]);

export const csvUploadModeSchema = z.enum(["insert-only", "insert-or-update", "update-only"]);

export const csvUploadRowSchema = z.record(z.string(), z.union([z.number(), z.string()]));

export const csvUploadPreviewInputSchema = z.object({
  data: z.array(csvUploadRowSchema),
  includeInsertRowIndexes: z.boolean().optional(),
  includeUpdateRows: z.boolean().optional(),
  mode: csvUploadModeSchema.optional(),
  table: csvUploadTableSchema,
});

export const csvUploadImportInputSchema = z.object({
  data: z.array(csvUploadRowSchema),
  mode: csvUploadModeSchema.optional(),
  table: csvUploadTableSchema,
});

export const csvUploadPreviewResponseSchema = z.object({
  errors: z.array(z.string()).optional(),
  insertRowIndexes: z.array(z.number()).optional(),
  status: z.literal("ok"),
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
});

export const csvUploadImportResponseSchema = z.object({
  errors: z.array(z.string()).optional(),
  inserted: z.number(),
  skipped: z.number(),
  status: z.literal("ok"),
  sync: z.unknown().optional(),
  toInsert: z.number(),
  toSkip: z.number(),
  toUpdate: z.number(),
  updated: z.number(),
});

export const csvUploadContract = {
  import: oc
    .route({ method: "POST", path: "/import" })
    .input(csvUploadImportInputSchema)
    .output(csvUploadImportResponseSchema),
  preview: oc
    .route({ method: "POST", path: "/preview" })
    .input(csvUploadPreviewInputSchema)
    .output(csvUploadPreviewResponseSchema),
};

export type CsvUploadContract = typeof csvUploadContract;
