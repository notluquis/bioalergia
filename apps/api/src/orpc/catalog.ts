import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  catalogStatusResponseSchema,
  productCategoriesResponseSchema,
  productCategoryCreateInputSchema,
  productCategoryResponseSchema,
  productCategoryUpdateInputSchema,
  productCreateInputSchema,
  productIdInputSchema,
  productListInputSchema,
  productListResponseSchema,
  productResponseSchema,
  productSlugInputSchema,
  productUpdateInputSchema,
} from "@finanzas/orpc-contracts/catalog";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  archiveProduct,
  createProduct,
  createProductCategory,
  deleteProductCategory,
  getProductById,
  getProductBySlug,
  listProductCategories,
  listProducts,
  updateProduct,
  updateProductCategory,
} from "../services/catalog.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CatalogORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CatalogORPCContext>();

const optionalAuthed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  return next({ context: { ...context, user } });
});

const requireStaff = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

function serializeImage(img: {
  id: number;
  productId: number;
  r2Key: string;
  cdnUrl: string;
  alt: string | null;
  position: number;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
}) {
  return {
    id: img.id,
    product_id: img.productId,
    r2_key: img.r2Key,
    cdn_url: img.cdnUrl,
    alt: img.alt,
    position: img.position,
    width: img.width,
    height: img.height,
    is_primary: img.isPrimary,
  };
}

function serializeCategory(cat: {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  parentId: number | null;
  displayOrder: number;
  mlCategoryId: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    parent_id: cat.parentId,
    display_order: cat.displayOrder,
    ml_category_id: cat.mlCategoryId,
    image_url: cat.imageUrl,
    created_at: cat.createdAt,
    updated_at: cat.updatedAt,
  };
}

type ProductRow = Awaited<ReturnType<typeof getProductById>>;

function serializeProduct(p: NonNullable<ProductRow>) {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    short_description: p.shortDescription,
    description: p.description,
    category_id: p.categoryId,
    category: p.category ? serializeCategory(p.category) : null,
    brand: p.brand,
    price_clp: p.priceClp,
    compare_at_price_clp: p.compareAtPriceClp,
    cost_clp: p.costClp,
    weight_grams: p.weightGrams,
    barcode: p.barcode,
    requires_prescription: p.requiresPrescription,
    status: p.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    available_qty: p.availableQty,
    safety_stock: p.safetyStock,
    images: (p.images ?? []).map(serializeImage),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

const listRoute = optionalAuthed
  .route({ method: "GET", path: "/products", summary: "List products", tags: ["Catalog"] })
  .input(productListInputSchema)
  .output(productListResponseSchema)
  .handler(async ({ input, context }) => {
    const includeInactive = Boolean(input.include_inactive) && Boolean(context.user);
    const { data, nextCursor } = await listProducts({
      categorySlug: input.category_slug,
      q: input.q,
      limit: input.limit,
      cursor: input.cursor,
      includeInactive,
    });
    return {
      data: data.map(serializeProduct),
      next_cursor: nextCursor,
      status: "ok" as const,
    };
  });

const getBySlugRoute = optionalAuthed
  .route({
    method: "GET",
    path: "/products/by-slug/{slug}",
    summary: "Get product by slug",
    tags: ["Catalog"],
  })
  .input(productSlugInputSchema)
  .output(productResponseSchema)
  .handler(async ({ input, context }) => {
    const product = await getProductBySlug(input.slug);
    if (!product) {
      throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
    }
    if (product.status !== "ACTIVE" && !context.user) {
      throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
    }
    return { data: serializeProduct(product), status: "ok" as const };
  });

const getByIdRoute = requireStaff
  .route({
    method: "GET",
    path: "/products/{id}",
    summary: "Get product by id (staff)",
    tags: ["Catalog"],
  })
  .input(productIdInputSchema)
  .output(productResponseSchema)
  .handler(async ({ input }) => {
    const product = await getProductById(input.id);
    if (!product) {
      throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
    }
    return { data: serializeProduct(product), status: "ok" as const };
  });

const adminCreateRoute = requireStaff
  .route({
    method: "POST",
    path: "/products",
    summary: "Create product",
    tags: ["Catalog"],
  })
  .input(productCreateInputSchema)
  .output(productResponseSchema)
  .handler(async ({ input }: { input: z.input<typeof productCreateInputSchema> }) => {
    const product = await createProduct({
      slug: input.slug,
      sku: input.sku,
      name: input.name,
      shortDescription: input.short_description ?? null,
      description: input.description ?? null,
      categoryId: input.category_id ?? null,
      brand: input.brand ?? null,
      priceClp: input.price_clp,
      compareAtPriceClp: input.compare_at_price_clp ?? null,
      costClp: input.cost_clp ?? null,
      weightGrams: input.weight_grams ?? null,
      barcode: input.barcode ?? null,
      requiresPrescription: input.requires_prescription,
      status: input.status,
      seoTitle: input.seo_title ?? null,
      seoDescription: input.seo_description ?? null,
      availableQty: input.available_qty,
      safetyStock: input.safety_stock,
    });
    const full = await getProductById(product.id);
    return { data: serializeProduct(full!), status: "ok" as const };
  });

const adminUpdateRoute = requireStaff
  .route({
    method: "PUT",
    path: "/products/{id}",
    summary: "Update product",
    tags: ["Catalog"],
  })
  .input(z.object({ id: z.coerce.number().int().positive(), product: productUpdateInputSchema }))
  .output(productResponseSchema)
  .handler(
    async ({
      input,
    }: {
      input: { id: number; product: z.input<typeof productUpdateInputSchema> };
    }) => {
      const p = input.product;
      await updateProduct(input.id, {
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        shortDescription: p.short_description ?? undefined,
        description: p.description ?? undefined,
        categoryId: p.category_id ?? undefined,
        brand: p.brand ?? undefined,
        priceClp: p.price_clp,
        compareAtPriceClp: p.compare_at_price_clp ?? undefined,
        costClp: p.cost_clp ?? undefined,
        weightGrams: p.weight_grams ?? undefined,
        barcode: p.barcode ?? undefined,
        requiresPrescription: p.requires_prescription,
        status: p.status,
        seoTitle: p.seo_title ?? undefined,
        seoDescription: p.seo_description ?? undefined,
        availableQty: p.available_qty,
        safetyStock: p.safety_stock,
      });
      const full = await getProductById(input.id);
      if (!full) {
        throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
      }
      return { data: serializeProduct(full), status: "ok" as const };
    }
  );

const adminArchiveRoute = requireStaff
  .route({
    method: "DELETE",
    path: "/products/{id}",
    summary: "Archive product",
    tags: ["Catalog"],
  })
  .input(productIdInputSchema)
  .output(catalogStatusResponseSchema)
  .handler(async ({ input }) => {
    await archiveProduct(input.id);
    return { status: "ok" as const };
  });

const listCategoriesRoute = optionalAuthed
  .route({
    method: "GET",
    path: "/categories",
    summary: "List product categories",
    tags: ["Catalog"],
  })
  .output(productCategoriesResponseSchema)
  .handler(async () => {
    const rows = await listProductCategories();
    return { data: rows.map(serializeCategory), status: "ok" as const };
  });

const createCategoryRoute = requireStaff
  .route({
    method: "POST",
    path: "/categories",
    summary: "Create product category",
    tags: ["Catalog"],
  })
  .input(productCategoryCreateInputSchema)
  .output(productCategoryResponseSchema)
  .handler(async ({ input }: { input: z.input<typeof productCategoryCreateInputSchema> }) => {
    const cat = await createProductCategory({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      parentId: input.parent_id ?? null,
      displayOrder: input.display_order,
      mlCategoryId: input.ml_category_id ?? null,
      imageUrl: input.image_url ?? null,
    });
    return { data: serializeCategory(cat), status: "ok" as const };
  });

const updateCategoryRoute = requireStaff
  .route({
    method: "PUT",
    path: "/categories/{id}",
    summary: "Update product category",
    tags: ["Catalog"],
  })
  .input(
    z.object({
      id: z.coerce.number().int().positive(),
      category: productCategoryUpdateInputSchema,
    })
  )
  .output(productCategoryResponseSchema)
  .handler(
    async ({
      input,
    }: {
      input: { id: number; category: z.input<typeof productCategoryUpdateInputSchema> };
    }) => {
      const cat = await updateProductCategory(input.id, {
        slug: input.category.slug,
        name: input.category.name,
        description: input.category.description ?? undefined,
        parentId: input.category.parent_id ?? undefined,
        displayOrder: input.category.display_order,
        mlCategoryId: input.category.ml_category_id ?? undefined,
        imageUrl: input.category.image_url ?? undefined,
      });
      return { data: serializeCategory(cat), status: "ok" as const };
    }
  );

const deleteCategoryRoute = requireStaff
  .route({
    method: "DELETE",
    path: "/categories/{id}",
    summary: "Delete product category",
    tags: ["Catalog"],
  })
  .input(productIdInputSchema)
  .output(catalogStatusResponseSchema)
  .handler(async ({ input }) => {
    await deleteProductCategory(input.id);
    return { status: "ok" as const };
  });

const catalogORPCRouterBase = {
  list: listRoute,
  getBySlug: getBySlugRoute,
  getById: getByIdRoute,
  adminCreate: adminCreateRoute,
  adminUpdate: adminUpdateRoute,
  adminArchive: adminArchiveRoute,
  listCategories: listCategoriesRoute,
  createCategory: createCategoryRoute,
  updateCategory: updateCategoryRoute,
  deleteCategory: deleteCategoryRoute,
};

export const catalogORPCRouter = base
  .prefix("/api/orpc/catalog")
  .tag("Catalog")
  .router(catalogORPCRouterBase);

export const catalogORPCHandler = new SuperJSONRPCHandler(catalogORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("catalog.orpc.rpc", error, {});
    }),
  ],
});

export const catalogOpenAPIHandler = new OpenAPIHandler(catalogORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Catalog API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Catalog API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("catalog.orpc.openapi", error, {});
    }),
  ],
});

export type CatalogORPCRouter = typeof catalogORPCRouter;
