import {
  createProductDocumentInputSchema,
  deleteProductDocumentInputSchema,
  listProductDocumentsInputSchema,
  presignProductDocumentInputSchema,
  presignProductDocumentResponseSchema,
  productDocumentListResponseSchema,
  productDocumentResponseSchema,
  publicProductDocumentListResponseSchema,
} from "@finanzas/orpc-contracts/product-documents";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { z } from "zod";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createDocument,
  deleteDocument,
  listByProduct,
  listPublicByProduct,
  presignDocumentUpload,
  serializeDocument,
  serializePublicDocument,
} from "../services/product-documents.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ProductDocsORPCContext = { hono: HonoContext };
const base = os.$context<ProductDocsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "QuoteProduct");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const writer = requirePermission("update");
const reader = requirePermission("read");

const productDocumentsRouterBase = {
  // Público — solo documentos PUBLIC.
  listPublicByProduct: base
    .route({ method: "POST", path: "/public/by-product", tags: ["ProductDocuments"] })
    .input(listProductDocumentsInputSchema)
    .output(publicProductDocumentListResponseSchema)
    .handler(async ({ input }) => {
      const docs = await listPublicByProduct(input.productId);
      return { documents: docs.map((d) => serializePublicDocument(d)) };
    }),

  presignUpload: writer
    .route({ method: "POST", path: "/presign", tags: ["ProductDocuments"] })
    .input(presignProductDocumentInputSchema)
    .output(presignProductDocumentResponseSchema)
    .handler(async ({ input }) => presignDocumentUpload(input)),

  create: writer
    .route({ method: "POST", path: "/documents", tags: ["ProductDocuments"] })
    .input(createProductDocumentInputSchema)
    .output(productDocumentResponseSchema)
    .handler(async ({ input }) => {
      const document = await createDocument(input);
      return { document: serializeDocument(document) };
    }),

  listByProduct: reader
    .route({ method: "POST", path: "/documents/list", tags: ["ProductDocuments"] })
    .input(listProductDocumentsInputSchema)
    .output(productDocumentListResponseSchema)
    .handler(async ({ input }) => {
      const docs = await listByProduct(input.productId);
      return { documents: docs.map((d) => serializeDocument(d)) };
    }),

  deleteDocument: writer
    .route({ method: "POST", path: "/documents/{id}/delete", tags: ["ProductDocuments"] })
    .input(deleteProductDocumentInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ input }) => deleteDocument(input.id)),
};

export const productDocumentsORPCRouter = base
  .prefix("/api/orpc/product-documents")
  .router(productDocumentsRouterBase);

export const productDocumentsORPCHandler = new SuperJSONRPCHandler(productDocumentsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.product-documents" });
    }),
  ],
});

export const productDocumentsOpenAPIHandler = new OpenAPIHandler(productDocumentsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Product Documents oRPC",
          description: "Fichas técnicas de producto (IFU/SDS/CoA).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.product-documents" });
    }),
  ],
});

export type ProductDocumentsORPCRouter = typeof productDocumentsORPCRouter;
