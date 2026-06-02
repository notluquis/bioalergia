import { db } from "@finanzas/db";

export async function createProductImage(input: {
  productId: number;
  r2Key: string;
  cdnUrl: string;
  srcset?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  isPrimary?: boolean;
}) {
  // Posición = next slot.
  const last = await db.productImage.findFirst({
    where: { productId: input.productId },
    orderBy: { position: "desc" },
  });
  const position = last ? last.position + 1 : 0;

  // Si es la 1ra imagen, marca primary auto.
  const isFirst = position === 0;
  const isPrimary = input.isPrimary ?? isFirst;

  if (isPrimary) {
    await db.productImage.updateMany({
      where: { productId: input.productId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return await db.productImage.create({
    data: {
      productId: input.productId,
      r2Key: input.r2Key,
      cdnUrl: input.cdnUrl,
      srcset: input.srcset ?? null,
      alt: input.alt ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      position,
      isPrimary,
    },
  });
}

export async function deleteProductImage(id: number) {
  // TODO: borrar también el objeto en R2 (background job).
  await db.productImage.delete({ where: { id } });
}

export async function reorderProductImages(productId: number, orderedIds: number[]) {
  // Mass update en una tx.
  await db.$transaction(
    orderedIds.map((imgId, idx) =>
      db.productImage.update({
        where: { id: imgId },
        data: { position: idx },
      })
    )
  );
}

export async function setPrimaryImage(id: number) {
  const img = await db.productImage.findUnique({ where: { id } });
  if (!img) {
    throw new Error("Imagen no encontrada");
  }
  await db.$transaction([
    db.productImage.updateMany({
      where: { productId: img.productId, isPrimary: true },
      data: { isPrimary: false },
    }),
    db.productImage.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ]);
}
