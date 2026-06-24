import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  csvUploadImportInputSchema,
  csvUploadImportResponseSchema,
  csvUploadPreviewInputSchema,
  csvUploadPreviewResponseSchema,
} from "@finanzas/orpc-contracts/csv-upload";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";

import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  classifyProductionBalanceRows,
  importProductionBalances,
  parseProductionBalanceRows,
  summarizeProductionBalanceRow,
} from "../services/production-balance-import.ts";
import { importWithdrawals, previewWithdrawals } from "../services/withdraw-import.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CsvUploadORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CsvUploadORPCContext>();

type AuthedUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
type CsvUploadAuthedContext = CsvUploadORPCContext & { user: AuthedUser };

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const canReadCsvUpload = authed.use(async ({ context, next }) => {
  const canReadSettings = await hasPermission(context.user, "read", "Setting");
  if (!canReadSettings) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

// Sujeto de permiso por tabla importable (espejo de PERMISSION_MAP del
// CSVUploadPage). El chequeo va dentro del handler porque depende del input.
const IMPORT_PERMISSION_SUBJECT: Partial<Record<string, string>> = {
  daily_production_balances: "ProductionBalance",
  withdrawals: "WithdrawTransaction",
};

async function assertCanImportTable(user: AuthedUser, table: string): Promise<void> {
  const subject = IMPORT_PERMISSION_SUBJECT[table];
  if (!subject || !(await hasPermission(user, "create", subject))) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
}

const csvUploadORPCRouterBase = {
  import: authed
    .route({
      method: "POST",
      path: "/import",
      summary: "Import CSV rows",
      tags: ["CSV Upload"],
    })
    .input(csvUploadImportInputSchema)
    .output(csvUploadImportResponseSchema)
    .handler(
      async ({
        context,
        input,
      }: {
        context: CsvUploadAuthedContext;
        input: z.input<typeof csvUploadImportInputSchema>;
      }) => {
        // Authz depends on the target table → stays in the handler.
        await assertCanImportTable(context.user, input.table);

        if (input.table === "daily_production_balances") {
          const mode = input.mode ?? "insert-only";
          const { emptyRows, errors, validRows } = parseProductionBalanceRows(input.data);
          const result = await importProductionBalances({
            mode,
            rows: validRows,
            userId: context.user.id,
          });
          const skipped = result.skipped + emptyRows;
          return {
            errors: errors.length > 0 ? errors : undefined,
            inserted: result.inserted,
            skipped,
            status: "ok" as const,
            toInsert: result.inserted,
            toSkip: skipped,
            toUpdate: result.updated,
            updated: result.updated,
          };
        }

        if (input.table !== "withdrawals") {
          return {
            status: "ok" as const,
            inserted: 0,
            updated: 0,
            skipped: 0,
            toInsert: input.data.length,
            toUpdate: 0,
            toSkip: 0,
          };
        }

        return importWithdrawals({
          data: input.data,
          mode: input.mode,
          userId: context.user.id ?? null,
        });
      }
    ),

  preview: canReadCsvUpload
    .route({
      method: "POST",
      path: "/preview",
      summary: "Preview CSV import",
      tags: ["CSV Upload"],
    })
    .input(csvUploadPreviewInputSchema)
    .output(csvUploadPreviewResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof csvUploadPreviewInputSchema> }) => {
      if (input.table === "daily_production_balances") {
        const mode = input.mode ?? "insert-only";
        const { emptyRows, errors, validRows } = parseProductionBalanceRows(input.data);
        const { insertRows, unchangedRows, updateRows } =
          await classifyProductionBalanceRows(validRows);
        const skippedByMode =
          mode === "insert-only"
            ? updateRows.length
            : mode === "update-only"
              ? insertRows.length
              : 0;
        return {
          errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
          insertRowIndexes: input.includeInsertRowIndexes
            ? insertRows.map((row) => row.rowIndex)
            : undefined,
          status: "ok" as const,
          toInsert: mode === "update-only" ? 0 : insertRows.length,
          toSkip: unchangedRows.length + skippedByMode + emptyRows,
          toUpdate: mode === "insert-only" ? 0 : updateRows.length,
          updateRows: input.includeUpdateRows
            ? updateRows.map(({ row }) => ({
                key: row.dateKey,
                rowIndex: row.rowIndex,
                summary: summarizeProductionBalanceRow(row),
              }))
            : undefined,
        };
      }

      if (input.table !== "withdrawals") {
        return {
          status: "ok" as const,
          toInsert: input.data.length,
          toUpdate: 0,
          toSkip: 0,
        };
      }

      return previewWithdrawals({
        data: input.data,
        includeInsertRowIndexes: input.includeInsertRowIndexes,
        includeUpdateRows: input.includeUpdateRows,
        mode: input.mode,
      });
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

export type CsvUploadORPCRouter = typeof csvUploadORPCRouter;
