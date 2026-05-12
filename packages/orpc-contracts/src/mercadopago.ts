import { oc } from "@orpc/contract";
import { z } from "zod";

export const reportTypeSchema = z.enum(["release", "settlement"]);

export const listReportsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  type: reportTypeSchema.optional(),
});

export const createReportInputSchema = z.object({
  beginDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: reportTypeSchema.optional(),
});

export const processReportInputSchema = z.object({
  fileName: z.string().min(1),
  reportType: reportTypeSchema,
});

export const downloadReportInputSchema = z.object({
  fileName: z.string().min(1),
  type: reportTypeSchema.optional(),
});

export const syncLogsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const mpReportSchema = z.object({
  begin_date: z.coerce.date(),
  created_from: z.string().nullable().optional(),
  date_created: z.coerce.date().nullable().optional(),
  end_date: z.coerce.date(),
  file_name: z.string().nullable().optional(),
  id: z.number(),
  state: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  status_detail: z.string().nullable().optional(),
});

export const listReportsResponseSchema = z.object({
  reports: z.array(mpReportSchema),
  total: z.number(),
});

export const syncLogSchema = z.object({
  changeDetails: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  excluded: z.number().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional(),
  id: z.bigint(),
  inserted: z.number().nullable().optional(),
  skipped: z.number().nullable().optional(),
  startedAt: z.coerce.date(),
  status: z.enum(["RUNNING", "SUCCESS", "ERROR"]),
  triggerLabel: z.string().nullable().optional(),
  triggerSource: z.string(),
  updated: z.number().nullable().optional(),
});

export const syncLogsResponseSchema = z.object({
  logs: z.array(syncLogSchema),
  total: z.number(),
});

export const processReportResponseSchema = z.object({
  cashFlowSync: z
    .object({
      created: z.number(),
      duplicates: z.number(),
      errors: z.array(z.string()),
      failed: z.number(),
      total: z.number(),
    })
    .optional(),
  message: z.string(),
  stats: z.object({
    duplicateRows: z.number(),
    errors: z.array(z.string()),
    insertedRows: z.number(),
    skippedRows: z.number(),
    totalRows: z.number(),
    validRows: z.number(),
  }),
  status: z.enum(["error", "success"]),
});

export const mercadopagoContract = {
  createReport: oc
    .route({ method: "POST", path: "/reports" })
    .input(createReportInputSchema)
    .output(mpReportSchema),
  downloadReport: oc
    .route({ method: "GET", path: "/reports/download" })
    .input(downloadReportInputSchema)
    .output(z.file()),
  listReports: oc
    .route({ method: "GET", path: "/reports" })
    .input(listReportsInputSchema)
    .output(listReportsResponseSchema),
  listSyncLogs: oc
    .route({ method: "GET", path: "/sync/logs" })
    .input(syncLogsInputSchema)
    .output(syncLogsResponseSchema),
  processReport: oc
    .route({ method: "POST", path: "/process-report" })
    .input(processReportInputSchema)
    .output(processReportResponseSchema),
};

export type MercadopagoContract = typeof mercadopagoContract;
