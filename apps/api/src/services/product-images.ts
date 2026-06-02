import { db } from "@finanzas/db";
import sharp from "sharp";
import { deleteR2Objects, putR2Object, r2KeyFromCdnUrl } from "../modules/cloudflare/r2.ts";

// Tamaños responsivos + formatos next-gen (golden 2026). Orden de preferencia
// del <picture>: JXL → AVIF → WebP → original. Generación SERVER-SIDE con sharp
// (encoder confiable, a diferencia del canvas que no codifica AVIF en Safari).
//
// AVIF cubre Safari 16+ (lo DECODEA aunque no lo encodee). JXL queda fuera por
// ahora: el libvips prebuilt de sharp no trae libjxl (`jxlsave` no compilado),
// así que `.jxl()` tira en runtime. La columna jxlSrcset + el <source image/jxl>
// quedan como forward-compat: cuando haya un libvips con libjxl, basta agregar
// la línea jxl al arreglo y correr el backfill.
const VARIANT_WIDTHS = [400, 800, 1600];
const FORMATS = [
  {
    col: "srcset",
    ext: "webp",
    mime: "image/webp",
    run: (s: sharp.Sharp) => s.webp({ quality: 80 }),
  },
  {
    col: "avifSrcset",
    ext: "avif",
    mime: "image/avif",
    run: (s: sharp.Sharp) => s.avif({ quality: 55 }),
  },
] as const;

/**
 * Genera variantes responsivas (WebP + AVIF a 400/800/1600w, capadas al ancho
 * nativo) desde el original ya subido, las sube a R2 y persiste los srcset.
 * Idempotente. Lo usan el confirm de upload y el backfill.
 */
export async function processProductImageVariants(imageId: number): Promise<void> {
  const img = await db.productImage.findUnique({ where: { id: imageId } });
  if (!img) return;

  const res = await fetch(img.cdnUrl);
  if (!res.ok) throw new Error(`No se pudo leer el original (${res.status})`);
  const input = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) throw new Error("Imagen sin dimensiones");

  const cap = Math.min(meta.width, 1600);
  const widths = [...new Set(VARIANT_WIDTHS.filter((w) => w < cap).concat(cap))].sort(
    (a, b) => a - b
  );
  const aspect = meta.height / meta.width;

  const data: Record<string, string | number | null> = {
    width: cap,
    height: Math.round(cap * aspect),
  };

  for (const fmt of FORMATS) {
    const entries: string[] = [];
    for (const w of widths) {
      try {
        const buf = await fmt.run(sharp(input).resize({ width: w })).toBuffer();
        const url = await putR2Object(
          `products/${img.productId}/v-${img.id}-${w}w.${fmt.ext}`,
          buf,
          fmt.mime
        );
        entries.push(`${url} ${w}w`);
      } catch (error) {
        // JXL puede no estar en algún build de libvips; degradar sin romper.
        console.warn(`[product-images] ${fmt.ext} ${w}w falló:`, error);
      }
    }
    data[fmt.col] = entries.length > 1 ? entries.join(", ") : null;
  }

  await db.productImage.update({ where: { id: imageId }, data });
}

export async function createProductImage(input: {
  productId: number;
  r2Key: string;
  cdnUrl: string;
  srcset?: string | null;
  avifSrcset?: string | null;
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
      avifSrcset: input.avifSrcset ?? null,
      alt: input.alt ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      position,
      isPrimary,
    },
  });
}

export async function getProductImage(id: number) {
  return db.productImage.findUnique({ where: { id } });
}

export async function deleteProductImage(id: number) {
  const img = await db.productImage.findUnique({ where: { id } });
  if (!img) return;
  // Borra el objeto principal + todas las variantes WebP, AVIF y JXL.
  const keys = [img.r2Key];
  for (const set of [img.srcset, img.avifSrcset, img.jxlSrcset]) {
    if (!set) continue;
    for (const part of set.split(",")) {
      const url = part.trim().split(/\s+/)[0];
      const key = url ? r2KeyFromCdnUrl(url) : null;
      if (key) keys.push(key);
    }
  }
  await deleteR2Objects(keys);
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
