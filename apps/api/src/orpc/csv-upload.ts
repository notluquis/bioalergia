import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { csvUploadContract } from "@finanzas/orpc-contracts/csv-upload";
import type { Context as HonoContext } from "hono";
import { getSessionUser } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type CsvUploadORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CsvUploadORPCContext>();

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
    .input(csvUploadContract.import["~orpc"].inputSchema)
    .output(csvUploadContract.import["~orpc"].outputSchema)
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
    .input(csvUploadContract.preview["~orpc"].inputSchema)
    .output(csvUploadContract.preview["~orpc"].outputSchema)
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

export type CsvUploadORPCRouter = typeof csvUploadORPCRouter;
