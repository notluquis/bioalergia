// Inserts a primary placeholder ProductImage for every product that has
// none. Uses placehold.co with the Bioalergia brand color + brand name
// overlay so the storefront shows visible cards immediately, even
// before real product photography is uploaded via the intranet
// ImageUploader (which writes to R2 and supersedes the placeholder).
//
// Idempotent: skips products that already have ≥1 image.
//
// Run via: node apps/api/src/scripts/seed-placeholder-images.ts

import { db } from "@finanzas/db";

const BRAND_BG = "0e64b7"; // bioalergia primary
const BRAND_FG = "ffffff";

function placeholderUrl(label: string): string {
  const text = encodeURIComponent(label.slice(0, 30));
  return `https://placehold.co/600x600/${BRAND_BG}/${BRAND_FG}.png?text=${text}&font=montserrat`;
}

async function main() {
  const products = await db.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, sku: true, name: true, brand: true },
  });

  if (products.length === 0) {
    console.log("[placeholders] no products without images, nothing to do");
    return;
  }

  console.log(`[placeholders] seeding ${products.length} placeholder images`);

  for (const p of products) {
    const label = p.brand ?? p.name.split(" ").slice(0, 2).join(" ");
    await db.productImage.create({
      data: {
        productId: p.id,
        r2Key: `placeholder/${p.sku}`,
        cdnUrl: placeholderUrl(label),
        alt: p.name,
        position: 0,
        isPrimary: true,
      },
    });
    console.log(`  ✓ ${p.sku} ← ${label}`);
  }

  console.log(`[placeholders] done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
