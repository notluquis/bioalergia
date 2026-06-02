// Backfill de variantes responsivas (WebP + AVIF + JXL) para imágenes de
// producto YA subidas. Reusa el mismo servicio que el confirm de upload
// (sharp server-side). Genera y sube las variantes a R2 (free tier, egress $0)
// y persiste los srcset.
//
// Uso:  node src/scripts/backfill-product-image-variants.ts [--all]
//   --all  reprocesa todas (default: sólo las que faltan variantes).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

const REPROCESS_ALL = process.argv.includes("--all");

async function main() {
  const { db } = await import("@finanzas/db");
  const { processProductImageVariants } = await import("../services/product-images.ts");

  const where = REPROCESS_ALL ? {} : { OR: [{ srcset: null }, { avifSrcset: null }] };
  const images = await db.productImage.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, productId: true },
  });
  console.log(
    `🖼️  ${images.length} imágenes a procesar${REPROCESS_ALL ? " (todas)" : " (faltantes)"}`
  );

  let done = 0;
  let failed = 0;
  for (const img of images) {
    try {
      await processProductImageVariants(img.id);
      done += 1;
      console.log(`  ✓ #${img.id} (producto ${img.productId})`);
    } catch (error) {
      failed += 1;
      console.warn(`  ✗ #${img.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`🎉 Listo. ${done} procesadas, ${failed} fallidas.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
