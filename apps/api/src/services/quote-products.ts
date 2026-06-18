import { db } from "@finanzas/db";
import type {
  CreateQuoteProductInput,
  UpdateQuoteProductInput,
} from "@finanzas/orpc-contracts/quotes";
import { DomainError } from "../lib/errors.ts";

type QuoteProductRow = Awaited<ReturnType<typeof db.quoteProduct.findFirst>>;

export function serializeQuoteProduct(p: NonNullable<QuoteProductRow>) {
  return {
    id: p.id,
    code: p.code,
    brand: p.brand,
    category: p.category,
    name: p.name,
    format: p.format,
    unitPrice: Number(p.unitPrice.toString()),
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    slug: p.slug,
    description: p.description,
    imageUrl: p.imageUrl,
    publishedOnSite: p.publishedOnSite,
    seoDescription: p.seoDescription,
    allergenId: p.allergenId,
  };
}

export async function listQuoteProducts() {
  return db.quoteProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { name: "asc" }],
  });
}

async function assertSlugFree(slug: string, exceptId?: number) {
  const clash = await db.quoteProduct.findFirst({
    where: exceptId ? { slug, NOT: { id: exceptId } } : { slug },
    select: { id: true },
  });
  if (clash) throw new DomainError("CONFLICT", "Ya existe un producto con ese slug");
}

export async function createQuoteProduct(input: CreateQuoteProductInput) {
  const slug = input.slug?.trim() || null;
  if (slug) await assertSlugFree(slug);
  return db.quoteProduct.create({
    data: {
      code: input.code ?? null,
      brand: input.brand ?? null,
      category: input.category ?? null,
      name: input.name.trim(),
      format: input.format ?? null,
      unitPrice: input.unitPrice,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      publishedOnSite: input.publishedOnSite,
      seoDescription: input.seoDescription ?? null,
      allergenId: input.allergenId ?? null,
    },
  });
}

export async function updateQuoteProduct(input: UpdateQuoteProductInput) {
  const { id, ...rest } = input;
  const existing = await db.quoteProduct.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Producto no encontrado");

  if (rest.slug !== undefined && rest.slug !== null && rest.slug.trim()) {
    await assertSlugFree(rest.slug.trim(), id);
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  if (typeof data.slug === "string") data.slug = (data.slug as string).trim() || null;
  return db.quoteProduct.update({ where: { id }, data });
}

export async function deleteQuoteProduct(id: number) {
  await db.quoteProduct.delete({ where: { id } });
}
