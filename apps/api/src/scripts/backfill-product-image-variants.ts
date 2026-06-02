// Backfill de variantes responsivas para imágenes de producto YA subidas
// (las que tienen srcset/avifSrcset null). Descarga el original desde el CDN,
// genera WebP + AVIF a 400/800/1600w (capado al ancho nativo) con sharp
// (cómputo local, $0), las sube a R2 y persiste srcset + avifSrcset.
//
// Uso:  node src/scripts/backfill-product-image-variants.ts [--all]
//   --all  reprocesa todas (default: sólo las que faltan variantes).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

const REPROCESS_ALL = process.argv.includes("--all");
const WIDTHS = [400, 800, 1600];
const QUALITY_WEBP = 80;
const QUALITY_AVIF = 55;

async function main() {
  const { db } = await import("@finanzas/db");
  const { putR2Object } = await import("../modules/cloudflare/r2.ts");

  const where = REPROCESS_ALL ? {} : { OR: [{ srcset: null }, { avifSrcset: null }] };
  const images = await db.productImage.findMany({ where, orderBy: { id: "asc" } });
  console.log(
    `🖼️  ${images.length} imágenes a procesar${REPROCESS_ALL ? " (todas)" : " (faltantes)"}`
  );

  let done = 0;
  let failed = 0;
  for (const img of images) {
    try {
      const res = await fetch(img.cdnUrl);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) throw new Error("sin dimensiones");

      const cap = Math.min(meta.width, 1600);
      const widths = [...new Set(WIDTHS.filter((w) => w < cap).concat(cap))].sort((a, b) => a - b);
      const aspect = meta.height / meta.width;

      const webp: string[] = [];
      const avif: string[] = [];
      for (const w of widths) {
        const base = `products/${img.productId}/v-${img.id}-${w}w`;
        const webpBuf = await sharp(input)
          .resize({ width: w })
          .webp({ quality: QUALITY_WEBP })
          .toBuffer();
        const avifBuf = await sharp(input)
          .resize({ width: w })
          .avif({ quality: QUALITY_AVIF })
          .toBuffer();
        webp.push(`${await putR2Object(`${base}.webp`, webpBuf, "image/webp")} ${w}w`);
        avif.push(`${await putR2Object(`${base}.avif`, avifBuf, "image/avif")} ${w}w`);
      }

      await db.productImage.update({
        where: { id: img.id },
        data: {
          srcset: webp.length > 1 ? webp.join(", ") : null,
          avifSrcset: avif.length > 1 ? avif.join(", ") : null,
          width: cap,
          height: Math.round(cap * aspect),
        },
      });
      done += 1;
      console.log(`  ✓ #${img.id} (producto ${img.productId}) → ${widths.length} tamaños`);
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
