import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { formatMpDate, MercadoPagoService } from "../services/mercadopago";
import {
  createMpSyncLogEntry,
  finalizeMpSyncLogEntry,
  listMpSyncLogs,
} from "../services/mercadopago-sync";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type MercadoPagoORPCContext = {
  hono: HonoContext;
};

const base = os.$context<MercadoPagoORPCContext>();

const reportTypeSchema = z.enum(["release", "settlement"]);

const listReportsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  type: reportTypeSchema.optional(),
});

const createReportInputSchema = z.object({
  begin_date: z.date(),
  end_date: z.date(),
  type: reportTypeSchema.optional(),
});

const processReportInputSchema = z.object({
  fileName: z.string().min(1),
  reportType: reportTypeSchema,
});

const syncLogsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const mpReportSchema = z
  .object({
    begin_date: z.date(),
    created_from: z.enum(["manual", "schedule"]),
    date_created: z.date().optional(),
    end_date: z.date(),
    file_name: z.string().optional(),
    id: z.number(),
    state: z.string().optional(),
    status: z.string().optional(),
    status_detail: z.string().optional(),
  })
  .passthrough();

const listReportsResponseSchema = z.object({
  reports: z.array(mpReportSchema),
  total: z.number(),
});

const syncLogSchema = z.object({
  changeDetails: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  excluded: z.number().nullable().optional(),
  finishedAt: z.date().nullable().optional(),
  id: z.bigint(),
  inserted: z.number().nullable().optional(),
  skipped: z.number().nullable().optional(),
  startedAt: z.date(),
  status: z.enum(["RUNNING", "SUCCESS", "ERROR"]),
  triggerLabel: z.string().nullable().optional(),
  triggerSource: z.string(),
  updated: z.number().nullable().optional(),
});

const syncLogsResponseSchema = z.object({
  logs: z.array(syncLogSchema),
  total: z.number(),
});

const processReportResponseSchema = z.object({
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
    processedSourceIds: z.array(z.string()).optional(),
    skippedRows: z.number(),
    sourceUnavailable: z.boolean().optional(),
    totalRows: z.number(),
    validRows: z.number(),
  }),
  status: z.enum(["error", "success"]),
});

function isMpDownloadMissing(error: unknown) {
  return error instanceof Error && error.message.includes("Download failed: 404");
}

function toMpDownloadErrorMessage(type: "release" | "settlement") {
  return type === "settlement"
    ? "El archivo de conciliación aún no está disponible para descarga en MercadoPago."
    : "El archivo de liberación aún no está disponible para descarga en MercadoPago.";
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const integrationRead = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Integration");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const integrationCreate = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "read", "Integration");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const mercadopagoORPCRouterBase = {
  createReport: integrationCreate
    .route({
      method: "POST",
      path: "/reports",
      summary: "Create Mercado Pago report",
      tags: ["MercadoPago"],
    })
    .input(createReportInputSchema)
    .output(mpReportSchema)
    .handler(async ({ input }) => {
      const type = input.type ?? "release";
      return await MercadoPagoService.createReport(type, {
        begin_date: formatMpDate(input.begin_date),
        end_date: formatMpDate(input.end_date),
      });
    }),

  listReports: integrationRead
    .route({
      method: "GET",
      path: "/reports",
      summary: "List Mercado Pago reports",
      tags: ["MercadoPago"],
    })
    .input(listReportsInputSchema)
    .output(listReportsResponseSchema)
    .handler(async ({ input }) => {
      const type = input.type ?? "release";
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      const data = await MercadoPagoService.listReports(type);
      const sliced = data.slice(offset, offset + limit);
      return {
        reports: sliced,
        total: data.length,
      };
    }),

  listSyncLogs: integrationRead
    .route({
      method: "GET",
      path: "/sync/logs",
      summary: "List Mercado Pago sync logs",
      tags: ["MercadoPago"],
    })
    .input(syncLogsInputSchema)
    .output(syncLogsResponseSchema)
    .handler(async ({ input }) => {
      const { logs, total } = await listMpSyncLogs({
        limit: input.limit,
        offset: input.offset,
      });
      return { logs, total };
    }),

  processReport: integrationCreate
    .route({
      method: "POST",
      path: "/process-report",
      summary: "Process Mercado Pago report",
      tags: ["MercadoPago"],
    })
    .input(processReportInputSchema)
    .output(processReportResponseSchema)
    .handler(async ({ context, input }) => {
      let logId: bigint | null = null;

      try {
        logId = await createMpSyncLogEntry({
          triggerLabel: `${input.reportType}:${input.fileName}`,
          triggerSource: "mp:manual",
          triggerUserId: context.user.id,
        });

        const stats = await MercadoPagoService.processReport(input.reportType, {
          fileName: input.fileName,
        });

        if (stats.sourceUnavailable) {
          const message = toMpDownloadErrorMessage(input.reportType);
          if (logId != null) {
            await finalizeMpSyncLogEntry(logId, {
              changeDetails: {
                fileName: input.fileName,
                reportType: input.reportType,
                sourceUnavailable: true,
              },
              errorMessage: message,
              status: "ERROR",
            });
          }
          return {
            message,
            stats,
            status: "error" as const,
          };
        }

        const sourceIds = Array.from(
          new Set(stats.processedSourceIds.map((id) => id.trim()).filter((id) => id.length > 0)),
        );
        const cashFlowSync =
          sourceIds.length > 0
            ? await MercadoPagoService.syncCashFlow(context.user.id, { sourceIds })
            : {
                created: 0,
                duplicates: 0,
                errors: ["No sourceIds found in processed report; cashflow sync skipped"],
                failed: 0,
                total: 0,
              };

        if (logId != null) {
          await finalizeMpSyncLogEntry(logId, {
            changeDetails: {
              cashFlowSync,
              fileName: input.fileName,
              importStats: {
                duplicateRows: stats.duplicateRows,
                errorCount: stats.errors?.length ?? 0,
                insertedRows: stats.insertedRows,
                skippedRows: stats.skippedRows,
                totalRows: stats.totalRows,
                validRows: stats.validRows,
              },
              importStatsByType: {
                [input.reportType]: {
                  duplicateRows: stats.duplicateRows,
                  errorCount: stats.errors?.length ?? 0,
                  insertedRows: stats.insertedRows,
                  skippedRows: stats.skippedRows,
                  totalRows: stats.totalRows,
                  validRows: stats.validRows,
                },
              },
              reportType: input.reportType,
              reportTypes: [input.reportType],
            },
            excluded: stats.duplicateRows,
            inserted: stats.insertedRows,
            skipped: stats.skippedRows,
            status: "SUCCESS",
          });
        }

        return {
          cashFlowSync,
          message: "Reporte procesado exitosamente",
          stats,
          status: "success" as const,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (logId != null) {
          await finalizeMpSyncLogEntry(logId, {
            changeDetails: {
              fileName: input.fileName,
              reportType: input.reportType,
            },
            errorMessage: message,
            status: "ERROR",
          });
        }

        if (isMpDownloadMissing(error)) {
          return {
            message: toMpDownloadErrorMessage(input.reportType),
            stats: {
              duplicateRows: 0,
              errors: [message],
              insertedRows: 0,
              skippedRows: 0,
              totalRows: 0,
              validRows: 0,
            },
            status: "error" as const,
          };
        }

        throw error;
      }
    }),
};

export const mercadopagoORPCRouter = base
  .prefix("/api/orpc/mercadopago")
  .tag("MercadoPago")
  .router(mercadopagoORPCRouterBase);

export const mercadopagoORPCHandler = new SuperJSONRPCHandler(mercadopagoORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("mercadopago.orpc", error, {
        module: "api",
        operation: "orpc.mercadopago",
      });
    }),
  ],
});

export const mercadopagoOpenAPIHandler = new OpenAPIHandler(mercadopagoORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia MercadoPago API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia MercadoPago API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("mercadopago.openapi", error, {
        module: "api",
        operation: "openapi.mercadopago",
      });
    }),
  ],
});
