import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Fichas técnicas de producto (shared-productdoc) — IFU/SDS/CoA/spec/ISO en R2.
 * `listPublicByProduct` es PÚBLICO y devuelve solo documentos `PUBLIC` (IFU/SDS).
 * El resto (presign, create, list completo, delete) es staff.
 */

export const productDocumentTypeSchema = z.enum([
  "IFU",
  "SDS",
  "COA",
  "SPEC_SHEET",
  "ISO_CERT",
  "PACKAGE_INSERT",
]);
export const productDocumentVisibilitySchema = z.enum(["PUBLIC", "AUTHED"]);

// ── DTO público (con URL CDN, sin la key cruda) ──────────────────────
export const publicProductDocumentSchema = z.object({
  id: z.number().int(),
  type: productDocumentTypeSchema,
  title: z.string(),
  url: z.string(),
  language: z.string(),
  version: z.string().nullable(),
  lotNumber: z.string().nullable(),
});
export const publicProductDocumentListResponseSchema = z.object({
  documents: z.array(publicProductDocumentSchema),
});

// ── DTO staff (incluye visibility + fileR2Key) ───────────────────────
export const productDocumentSchema = publicProductDocumentSchema.extend({
  productId: z.number().int(),
  visibility: productDocumentVisibilitySchema,
  fileR2Key: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
});
export const productDocumentListResponseSchema = z.object({
  documents: z.array(productDocumentSchema),
});
export const productDocumentResponseSchema = z.object({ document: productDocumentSchema });

// ── Inputs ───────────────────────────────────────────────────────────
export const presignProductDocumentInputSchema = z.object({
  filename: z.string().min(1).max(160),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});
export const presignProductDocumentResponseSchema = z.object({
  url: z.string(),
  cdnUrl: z.string(),
  r2Key: z.string(),
  expiresIn: z.number().int(),
});

export const createProductDocumentInputSchema = z.object({
  productId: z.number().int(),
  type: productDocumentTypeSchema,
  title: z.string().min(1).max(200),
  fileR2Key: z.string().min(1).max(400),
  visibility: productDocumentVisibilitySchema.default("PUBLIC"),
  lotNumber: z.string().max(80).nullable().optional(),
  version: z.string().max(40).nullable().optional(),
  language: z.string().max(10).default("es"),
  sortOrder: z.number().int().default(0),
});

export const listProductDocumentsInputSchema = z.object({ productId: z.number().int() });
export const deleteProductDocumentInputSchema = z.object({ id: z.number().int() });

export const productDocumentsContract = {
  // Público — solo documentos PUBLIC del producto.
  listPublicByProduct: oc
    .route({ method: "POST", path: "/public/by-product" })
    .input(listProductDocumentsInputSchema)
    .output(publicProductDocumentListResponseSchema),
  // Staff
  presignUpload: oc
    .route({ method: "POST", path: "/presign" })
    .input(presignProductDocumentInputSchema)
    .output(presignProductDocumentResponseSchema),
  create: oc
    .route({ method: "POST", path: "/documents" })
    .input(createProductDocumentInputSchema)
    .output(productDocumentResponseSchema),
  listByProduct: oc
    .route({ method: "POST", path: "/documents/list" })
    .input(listProductDocumentsInputSchema)
    .output(productDocumentListResponseSchema),
  deleteDocument: oc
    .route({ method: "POST", path: "/documents/{id}/delete" })
    .input(deleteProductDocumentInputSchema)
    .output(z.object({ ok: z.literal(true) })),
};

export type ProductDocumentsContract = typeof productDocumentsContract;
export type PublicProductDocumentDto = z.infer<typeof publicProductDocumentSchema>;
export type ProductDocumentDto = z.infer<typeof productDocumentSchema>;
export type ProductDocumentType = z.infer<typeof productDocumentTypeSchema>;
export type CreateProductDocumentInput = z.infer<typeof createProductDocumentInputSchema>;
