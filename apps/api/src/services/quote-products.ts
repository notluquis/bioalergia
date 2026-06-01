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
  };
}

export async function listQuoteProducts() {
  return db.quoteProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { name: "asc" }],
  });
}

export async function createQuoteProduct(input: CreateQuoteProductInput) {
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
    },
  });
}

export async function updateQuoteProduct(input: UpdateQuoteProductInput) {
  const { id, ...rest } = input;
  const existing = await db.quoteProduct.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Producto no encontrado");

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  return db.quoteProduct.update({ where: { id }, data });
}

export async function deleteQuoteProduct(id: number) {
  await db.quoteProduct.delete({ where: { id } });
}
