// Orquesta publicación/actualización productos → MercadoLibre.

import { db } from "@finanzas/db";

import { createMlItem, predictCategory, updateMlItem } from "./client.ts";
import { productToMlItem } from "./mappers.ts";

// Re-export low-level helpers que los webhooks/handlers necesitan sin acoplarse a client.ts.
export { getMlOrder, mlRequest } from "./client.ts";

export async function publishProductToMl(productId: number, opts?: { categoryId?: string }) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { position: "asc" } },
      mlListing: true,
      category: true,
    },
  });
  if (!product) throw new Error(`Producto ${productId} no encontrado`);
  if (product.status !== "ACTIVE") {
    throw new Error("Solo productos ACTIVE pueden publicarse a ML");
  }
  if (product.images.length === 0) {
    throw new Error("ML requiere al menos una imagen — sube fotos antes de publicar");
  }

  // Resolución de category_id (orden de prioridad):
  // 1. opts.categoryId (override manual desde UI)
  // 2. product.category.mlCategoryId (cache por categoría local)
  // 3. predict via ML domain_discovery
  let categoryId =
    opts?.categoryId ?? product.category?.mlCategoryId ?? null;
  if (!categoryId) {
    const pred = await predictCategory(product.name);
    if (!pred) {
      throw new Error("No se pudo predecir categoría ML. Selecciona una manualmente.");
    }
    categoryId = pred.category_id;
    // Cachea para próximos productos de la misma categoría local.
    if (product.categoryId) {
      await db.productCategory.update({
        where: { id: product.categoryId },
        data: { mlCategoryId: categoryId },
      });
    }
  }

  const payload = productToMlItem(
    {
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      priceClp: product.priceClp,
      sku: product.sku,
      availableQty: product.availableQty,
      brand: product.brand,
      images: product.images.map((i: (typeof product.images)[number]) => ({ cdnUrl: i.cdnUrl })),
    },
    categoryId
  );

  if (product.mlListing && product.mlListing.mlItemId) {
    // Re-publish flow: update existing item.
    const updated = await updateMlItem(product.mlListing.mlItemId, {
      price: payload.price,
      available_quantity: payload.available_quantity,
    });
    await db.mlListing.update({
      where: { productId },
      data: {
        status: "ACTIVE",
        permalink: updated.permalink,
        listingTypeId: updated.listing_type_id,
        categoryId: updated.category_id,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
    return { mlItemId: updated.id, permalink: updated.permalink };
  }

  // Primera publicación.
  const created = await createMlItem(payload);
  await db.mlListing.create({
    data: {
      productId,
      mlItemId: created.id,
      status: "ACTIVE",
      permalink: created.permalink,
      listingTypeId: created.listing_type_id,
      categoryId: created.category_id,
      lastSyncAt: new Date(),
    },
  });
  return { mlItemId: created.id, permalink: created.permalink };
}

export async function pushStockToMl(productId: number): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { mlListing: true },
  });
  if (!product?.mlListing) return;
  await updateMlItem(product.mlListing.mlItemId, {
    available_quantity: Math.max(0, product.availableQty),
  });
  await db.mlListing.update({
    where: { productId },
    data: { lastSyncAt: new Date() },
  });
}
