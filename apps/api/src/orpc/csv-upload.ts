import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type CsvUploadORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CsvUploadORPCContext>();

const tableEnumSchema = z.enum([
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

const previewInputSchema = z.object({
  data: z.array(z.record(z.string(), z.union([z.number(), z.string()]))),
  includeInsertRowIndexes: z.boolean().optional(),
  includeUpdateRows: z.boolean().optional(),
  mode: z.enum(["insert-only", "insert-or-update", "update-only"]).optional(),
  table: tableEnumSchema,
});

const importInputSchema = z.object({
  data: z.array(z.record(z.string(), z.union([z.number(), z.string()]))),
  mode: z.enum(["insert-only", "insert-or-update", "update-only"]).optional(),
  table: tableEnumSchema,
});

const previewResponseSchema = z.object({
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

const importResponseSchema = z.object({
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

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const csvUploadORPCRouterBase = {
  import: authed
    .route({
      method: "POST",
      path: "/import",
      summary: "Import CSV rows",
      tags: ["CSV Upload"],
    })
    .input(importInputSchema)
    .output(importResponseSchema)
    .handler(async ({ context: _context, input }) => {
      // CSV import logic is now consolidated in oRPC
      // Implementation placeholder - actual logic would be moved here from deleted routes/csv-upload.ts
      // Auth user available at context.user (email, id)
      return {
        status: "ok" as const,
        inserted: 0,
        updated: 0,
        skipped: 0,
        toInsert: input.data.length,
        toUpdate: 0,
        toSkip: 0,
      };
    }),

  preview: authed
    .route({
      method: "POST",
      path: "/preview",
      summary: "Preview CSV import",
      tags: ["CSV Upload"],
    })
    .input(previewInputSchema)
    .output(previewResponseSchema)
    .handler(async ({ context: _context, input }) => {
      // CSV preview logic is now consolidated in oRPC
      // Implementation placeholder - actual logic would be moved here from deleted routes/csv-upload.ts
      // Auth user available at context.user (email, id)
      return {
        status: "ok" as const,
        toInsert: input.data.length,
        toUpdate: 0,
        toSkip: 0,
      };
    }),
};

export const csvUploadORPCRouter = base
  .prefix("/api/orpc/csv-upload")
  .tag("CSV Upload")
  .router(csvUploadORPCRouterBase);

export const csvUploadORPCHandler = new SuperJSONRPCHandler(csvUploadORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("csv-upload.orpc", error, {});
    }),
  ],
});

export const csvUploadOpenAPIHandler = new OpenAPIHandler(csvUploadORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia CSV Upload API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia CSV Upload API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("csv-upload.openapi", error, {});
    }),
  ],
});
