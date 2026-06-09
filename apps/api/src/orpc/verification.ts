import {
  verifyDocumentInputSchema,
  verifyDocumentResponseSchema,
} from "@finanzas/orpc-contracts/verification";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os as orpcOs } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { verifyByCode } from "../services/verification.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type VerificationORPCContext = {
  hono: HonoContext;
};

const base = orpcOs.$context<VerificationORPCContext>();

// Verificación pública unificada: NO va detrás del middleware authed. Cualquiera
// con el QR/código puede resolver la proyección mínima segura. El service hace
// la lógica + proyección; el handler queda fino.
const verificationORPCRouterBase = {
  verify: base
    .route({
      method: "GET",
      path: "/verify/{code}",
      summary: "Verify a clinic document (prescription or certificate) by its public code",
      tags: ["Verification"],
    })
    .input(verifyDocumentInputSchema)
    .output(verifyDocumentResponseSchema)
    .handler(async ({ input }) => {
      return await verifyByCode(input.code, input.h);
    }),
};

export const verificationORPCRouter = base
  .prefix("/api/orpc/verification")
  .router(verificationORPCRouterBase);

export const verificationORPCHandler = new SuperJSONRPCHandler(verificationORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.verification",
      });
    }),
  ],
});

export const verificationOpenAPIHandler = new OpenAPIHandler(verificationORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Verification oRPC",
          description: "Verificación pública de documentos clínicos.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.verification",
      });
    }),
  ],
});

export type VerificationORPCRouter = typeof verificationORPCRouter;
