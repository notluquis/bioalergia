import { db } from "@finanzas/db";

type ProductCreateInput = {
  slug: string;
  sku: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  categoryId?: number | null;
  brand?: string | null;
  priceClp: number;
  compareAtPriceClp?: number | null;
  costClp?: number | null;
  weightGrams?: number | null;
  barcode?: string | null;
  requiresPrescription?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  seoTitle?: string | null;
  seoDescription?: string | null;
  availableQty?: number;
  safetyStock?: number;
};

type ProductUpdateInput = Partial<ProductCreateInput>;

type ProductListOptions = {
  categorySlug?: string;
  q?: string;
  limit: number;
  cursor?: number;
  includeInactive?: boolean;
};

export async function listProducts(opts: ProductListOptions) {
  const where: Record<string, unknown> = {};

  if (!opts.includeInactive) {
    where.status = "ACTIVE";
  }

  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug };
  }

  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" as const } },
      { sku: { contains: opts.q, mode: "insensitive" as const } },
      { brand: { contains: opts.q, mode: "insensitive" as const } },
    ];
  }

  if (opts.cursor) {
    where.id = { lt: opts.cursor };
  }

  const rows = await db.product.findMany({
    where,
    take: opts.limit + 1,
    orderBy: { id: "desc" },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });

  const hasMore = rows.length > opts.limit;
  const data = hasMore ? rows.slice(0, opts.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;
  return { data, nextCursor };
}

export async function getProductBySlug(slug: string) {
  return await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

export async function getProductById(id: number) {
  return await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

export async function createProduct(input: ProductCreateInput) {
  return await db.product.create({
    data: {
      slug: input.slug,
      sku: input.sku,
      name: input.name,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      brand: input.brand ?? null,
      priceClp: input.priceClp,
      compareAtPriceClp: input.compareAtPriceClp ?? null,
      costClp: input.costClp ?? null,
      weightGrams: input.weightGrams ?? null,
      barcode: input.barcode ?? null,
      requiresPrescription: input.requiresPrescription ?? false,
      status: input.status ?? "DRAFT",
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      availableQty: input.availableQty ?? 0,
      safetyStock: input.safetyStock ?? 2,
    },
    include: {
      category: true,
      images: true,
    },
  });
}

export async function updateProduct(id: number, input: ProductUpdateInput) {
  return await db.product.update({
    where: { id },
    data: {
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.brand !== undefined && { brand: input.brand }),
      ...(input.priceClp !== undefined && { priceClp: input.priceClp }),
      ...(input.compareAtPriceClp !== undefined && {
        compareAtPriceClp: input.compareAtPriceClp,
      }),
      ...(input.costClp !== undefined && { costClp: input.costClp }),
      ...(input.weightGrams !== undefined && { weightGrams: input.weightGrams }),
      ...(input.barcode !== undefined && { barcode: input.barcode }),
      ...(input.requiresPrescription !== undefined && {
        requiresPrescription: input.requiresPrescription,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
      ...(input.availableQty !== undefined && { availableQty: input.availableQty }),
      ...(input.safetyStock !== undefined && { safetyStock: input.safetyStock }),
    },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

export async function archiveProduct(id: number) {
  // Archivar (no borrar) — preserva referencias en order_items.
  await db.product.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

export async function listProductCategories() {
  return await db.productCategory.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

type CategoryCreateInput = {
  slug: string;
  name: string;
  description?: string | null;
  parentId?: number | null;
  displayOrder?: number;
  mlCategoryId?: string | null;
  imageUrl?: string | null;
};

export async function createProductCategory(input: CategoryCreateInput) {
  return await db.productCategory.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      displayOrder: input.displayOrder ?? 0,
      mlCategoryId: input.mlCategoryId ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

export async function updateProductCategory(id: number, input: Partial<CategoryCreateInput>) {
  return await db.productCategory.update({
    where: { id },
    data: {
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      ...(input.mlCategoryId !== undefined && { mlCategoryId: input.mlCategoryId }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
    },
  });
}

export async function deleteProductCategory(id: number) {
  const productCount = await db.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new Error(
      "No se puede borrar una categoría con productos asociados. Mueve los productos primero."
    );
  }
  await db.productCategory.delete({ where: { id } });
}
