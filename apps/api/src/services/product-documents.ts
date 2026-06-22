import { db } from "@finanzas/db";
import type { CreateProductDocumentInput } from "@finanzas/orpc-contracts/product-documents";
import { DomainError } from "../lib/errors.ts";
import {
  cdnUrlForKey,
  deleteR2Objects,
  presignProductDocumentUpload,
} from "../modules/cloudflare/r2.ts";

type DocRow = NonNullable<Awaited<ReturnType<typeof db.productDocument.findUnique>>>;

export function serializePublicDocument(d: DocRow) {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    url: cdnUrlForKey(d.fileR2Key),
    language: d.language,
    version: d.version,
    lotNumber: d.lotNumber,
  };
}

export function serializeDocument(d: DocRow) {
  return {
    ...serializePublicDocument(d),
    productId: d.productId,
    visibility: d.visibility,
    fileR2Key: d.fileR2Key,
    sortOrder: d.sortOrder,
    createdAt: d.createdAt,
  };
}

/** Presign para subir un documento (PDF) a R2. */
export async function presignDocumentUpload(input: { filename: string; contentType: string }) {
  return presignProductDocumentUpload(input);
}

export async function createDocument(input: CreateProductDocumentInput) {
  return db.productDocument.create({
    data: {
      productId: input.productId,
      type: input.type,
      title: input.title.trim(),
      fileR2Key: input.fileR2Key,
      // Bucket R2 público → solo documentos PUBLIC por ahora (IFU/SDS). Gated
      // (CoA/contratos) requiere bucket privado + descarga firmada (diferido).
      visibility: "PUBLIC",
      lotNumber: input.lotNumber?.trim() || null,
      version: input.version?.trim() || null,
      language: input.language,
      sortOrder: input.sortOrder,
    },
  });
}

/** Solo documentos PUBLIC del producto (lectura pública). */
export async function listPublicByProduct(productId: number) {
  return db.productDocument.findMany({
    where: { productId, visibility: "PUBLIC" },
    orderBy: [{ sortOrder: "asc" }, { type: "asc" }],
  });
}

export async function listByProduct(productId: number) {
  return db.productDocument.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { type: "asc" }],
  });
}

export async function deleteDocument(id: number) {
  const existing = await db.productDocument.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Documento no encontrado");
  await db.productDocument.delete({ where: { id } });
  // Best-effort: borra el objeto en R2 (si falla, queda huérfano sin romper el flujo).
  try {
    await deleteR2Objects([existing.fileR2Key]);
  } catch {
    // no-op
  }
  return { ok: true as const };
}
