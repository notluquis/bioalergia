import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  confirmUploadInputSchema,
  imageIdInputSchema,
  imageReorderInputSchema,
  imagesStatusResponseSchema,
  presignUploadInputSchema,
  presignUploadResponseSchema,
  productImageResponseSchema,
} from "@finanzas/orpc-contracts/images";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { presignProductImageUpload } from "../modules/cloudflare/r2.ts";
import {
  createProductImage,
  deleteProductImage,
  reorderProductImages,
  setPrimaryImage,
} from "../services/product-images.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { stripUndefined } from "../utils/strip-undefined.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ImagesORPCContext = { hono: HonoContext };

const base = os.$context<ImagesORPCContext>();

const requireStaff = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const presignRoute = requireStaff
  .route({ method: "POST", path: "/presign", summary: "Presign R2 upload", tags: ["Images"] })
  .input(presignUploadInputSchema)
  .output(presignUploadResponseSchema)
  .handler(async ({ input }) => {
    const result = await presignProductImageUpload({
      productId: input.product_id,
      filename: input.filename,
      contentType: input.content_type,
    });
    return {
      data: {
        url: result.url,
        cdn_url: result.cdnUrl,
        r2_key: result.r2Key,
        expires_in: result.expiresIn,
      },
      status: "ok" as const,
    };
  });

const confirmRoute = requireStaff
  .route({ method: "POST", path: "/confirm", summary: "Confirm uploaded image", tags: ["Images"] })
  .input(confirmUploadInputSchema)
  .output(productImageResponseSchema)
  .handler(async ({ input }) => {
    const img = await createProductImage(
      stripUndefined({
        productId: input.product_id,
        r2Key: input.r2_key,
        cdnUrl: input.cdn_url,
        srcset: input.srcset ?? null,
        alt: input.alt ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        isPrimary: input.is_primary,
      })
    );
    return {
      data: {
        id: img.id,
        product_id: img.productId,
        cdn_url: img.cdnUrl,
        srcset: img.srcset,
        r2_key: img.r2Key,
        alt: img.alt,
        position: img.position,
        is_primary: img.isPrimary,
      },
      status: "ok" as const,
    };
  });

const deleteRoute = requireStaff
  .route({ method: "DELETE", path: "/{id}", summary: "Delete image", tags: ["Images"] })
  .input(imageIdInputSchema)
  .output(imagesStatusResponseSchema)
  .handler(async ({ input }) => {
    await deleteProductImage(input.id);
    return { status: "ok" as const };
  });

const reorderRoute = requireStaff
  .route({ method: "POST", path: "/reorder", summary: "Reorder images", tags: ["Images"] })
  .input(imageReorderInputSchema)
  .output(imagesStatusResponseSchema)
  .handler(async ({ input }) => {
    await reorderProductImages(input.product_id, input.ordered_image_ids);
    return { status: "ok" as const };
  });

const setPrimaryRoute = requireStaff
  .route({
    method: "POST",
    path: "/{id}/primary",
    summary: "Set primary image",
    tags: ["Images"],
  })
  .input(imageIdInputSchema)
  .output(imagesStatusResponseSchema)
  .handler(async ({ input }) => {
    await setPrimaryImage(input.id);
    return { status: "ok" as const };
  });

const imagesORPCRouterBase = {
  presignUpload: presignRoute,
  confirmUpload: confirmRoute,
  deleteImage: deleteRoute,
  reorder: reorderRoute,
  setPrimary: setPrimaryRoute,
};

export const imagesORPCRouter = base
  .prefix("/api/orpc/images")
  .tag("Images")
  .router(imagesORPCRouterBase);

export const imagesORPCHandler = new SuperJSONRPCHandler(imagesORPCRouter, {
  interceptors: [onError((error) => logError("images.orpc.rpc", error, {}))],
});

export const imagesOpenAPIHandler = new OpenAPIHandler(imagesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Images API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia Images API", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("images.orpc.openapi", error, {}))],
});

export type ImagesORPCRouter = typeof imagesORPCRouter;
