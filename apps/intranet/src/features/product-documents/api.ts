import type { CreateProductDocumentInput } from "@finanzas/orpc-contracts/product-documents";
import { productDocumentsORPCClient, toProductDocumentsApiError } from "./orpc";

// ── Query keys ────────────────────────────────────────────────────────
export const productDocumentsKeys = {
  all: ["product-documents"] as const,
  byProduct: (productId: number) => [...productDocumentsKeys.all, "by-product", productId] as const,
};

type PresignUploadInput = {
  filename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
};

// ── Wrappers ──────────────────────────────────────────────────────────
export async function listDocuments(productId: number) {
  try {
    const res = await productDocumentsORPCClient.listByProduct({ productId });
    return res.documents;
  } catch (error) {
    throw toProductDocumentsApiError(error);
  }
}

export async function presignUpload(input: PresignUploadInput) {
  try {
    return await productDocumentsORPCClient.presignUpload(input);
  } catch (error) {
    throw toProductDocumentsApiError(error);
  }
}

export async function createDocument(input: CreateProductDocumentInput) {
  try {
    const res = await productDocumentsORPCClient.create(input);
    return res.document;
  } catch (error) {
    throw toProductDocumentsApiError(error);
  }
}

export async function deleteDocument(id: number) {
  try {
    const res = await productDocumentsORPCClient.deleteDocument({ id });
    return res.ok;
  } catch (error) {
    throw toProductDocumentsApiError(error);
  }
}
