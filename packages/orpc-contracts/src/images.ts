import { oc } from "@orpc/contract";
import { z } from "zod";

export const presignUploadInputSchema = z.object({
  product_id: z.number().int().positive(),
  filename: z.string().min(1).max(120),
  content_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
});

export const presignUploadResponseSchema = z.object({
  data: z.object({
    url: z.string().url(),
    cdn_url: z.string().url(),
    r2_key: z.string(),
    expires_in: z.number().int().positive(),
  }),
  status: z.literal("ok"),
});

export const confirmUploadInputSchema = z.object({
  product_id: z.number().int().positive(),
  r2_key: z.string().min(1),
  cdn_url: z.string().url(),
  srcset: z.string().nullable().optional(),
  avif_srcset: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  is_primary: z.boolean().optional(),
});

export const productImageResponseSchema = z.object({
  data: z.object({
    id: z.number().int(),
    product_id: z.number().int(),
    cdn_url: z.string().url(),
    srcset: z.string().nullable(),
    avif_srcset: z.string().nullable(),
    jxl_srcset: z.string().nullable(),
    r2_key: z.string(),
    alt: z.string().nullable(),
    position: z.number().int(),
    is_primary: z.boolean(),
  }),
  status: z.literal("ok"),
});

export const imageIdInputSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const imageReorderInputSchema = z.object({
  product_id: z.number().int().positive(),
  ordered_image_ids: z.array(z.number().int().positive()).min(1),
});

export const imagesStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const imagesContract = {
  presignUpload: oc
    .route({ method: "POST", path: "/presign" })
    .input(presignUploadInputSchema)
    .output(presignUploadResponseSchema),
  confirmUpload: oc
    .route({ method: "POST", path: "/confirm" })
    .input(confirmUploadInputSchema)
    .output(productImageResponseSchema),
  deleteImage: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(imageIdInputSchema)
    .output(imagesStatusResponseSchema),
  reorder: oc
    .route({ method: "POST", path: "/reorder" })
    .input(imageReorderInputSchema)
    .output(imagesStatusResponseSchema),
  setPrimary: oc
    .route({ method: "POST", path: "/{id}/primary" })
    .input(imageIdInputSchema)
    .output(imagesStatusResponseSchema),
};

export type ImagesContract = typeof imagesContract;
