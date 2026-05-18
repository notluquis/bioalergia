// Seed idempotente del catálogo ecommerce. Lee SKUs desde
// seed-products.data.json (mismo directorio). Upsert por SKU.
// Uso: pnpm --filter @finanzas/api tsx src/scripts/seed-products.ts
//
// Por diseño no hardcodea precios/productos: editar el JSON.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "@finanzas/db";

type SeedCategory = { slug: string; name: string };
type SeedProduct = {
  sku: string;
  name: string;
  brand?: string;
  price_clp: number;
  available_qty: number;
  category_slug?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  short_description?: string;
  description?: string;
};

type SeedFile = {
  categories: SeedCategory[];
  products: SeedProduct[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = join(here, "seed-products.data.json");
  const raw = await readFile(dataPath, "utf-8");
  const seed = JSON.parse(raw) as SeedFile;

  console.log(
    `[seed-products] ${seed.categories.length} categorías, ${seed.products.length} productos`
  );

  // 1. Upsert categorías por slug.
  const categoryIdBySlug = new Map<string, number>();
  for (const cat of seed.categories) {
    const row = await db.productCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { slug: cat.slug, name: cat.name },
    });
    categoryIdBySlug.set(cat.slug, row.id);
  }

  // 2. Upsert productos por SKU. Slug derivado del nombre si no se da.
  let created = 0;
  let updated = 0;
  for (const p of seed.products) {
    const slug = slugify(p.name);
    const categoryId = p.category_slug ? categoryIdBySlug.get(p.category_slug) ?? null : null;

    const existing = await db.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      await db.product.update({
        where: { sku: p.sku },
        data: {
          name: p.name,
          slug,
          brand: p.brand ?? null,
          priceClp: p.price_clp,
          availableQty: p.available_qty,
          categoryId,
          status: p.status ?? "ACTIVE",
          shortDescription: p.short_description ?? null,
          description: p.description ?? null,
        },
      });
      updated += 1;
    } else {
      await db.product.create({
        data: {
          sku: p.sku,
          slug,
          name: p.name,
          brand: p.brand ?? null,
          priceClp: p.price_clp,
          availableQty: p.available_qty,
          categoryId,
          status: p.status ?? "ACTIVE",
          shortDescription: p.short_description ?? null,
          description: p.description ?? null,
        },
      });
      created += 1;
    }
  }

  console.log(`[seed-products] OK — creados ${created}, actualizados ${updated}`);
}

main().catch((err) => {
  console.error("[seed-products] ERROR", err);
  process.exit(1);
});
