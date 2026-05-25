import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  catalogStatusResponseSchema,
  channelPriceDeleteInputSchema,
  channelPriceListResponseSchema,
  channelPriceResponseSchema,
  channelPriceUpsertInputSchema,
  productCategoriesResponseSchema,
  productCategoryCreateInputSchema,
  productCategoryResponseSchema,
  productCategoryUpdateInputSchema,
  productCreateInputSchema,
  productIdInputSchema,
  productListInputSchema,
  productListResponseSchema,
  productResponseSchema,
  productReviewListResponseSchema,
  productReviewModerateInputSchema,
  productReviewModerateResponseSchema,
  productReviewPendingListResponseSchema,
  productReviewSubmitInputSchema,
  productReviewSubmitResponseSchema,
  productSlugInputSchema,
  productUpdateInputSchema,
  publicShopConfigResponseSchema,
} from "@finanzas/orpc-contracts/catalog";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { DEFAULT_SETTINGS, getSetting, settingsKeyToDbKey } from "../lib/settings.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  archiveProduct,
  createProduct,
  createProductCategory,
  deleteChannelPrice,
  deleteProductCategory,
  getProductById,
  getProductBySlug,
  listApprovedReviews,
  listChannelPrices,
  listPendingReviews,
  listProductCategories,
  listProducts,
  moderateReview,
  submitReview,
  updateProduct,
  updateProductCategory,
  upsertChannelPrice,
} from "../services/catalog.ts";
import { stripUndefined } from "../utils/strip-undefined.ts";
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
    ml_listing: p.mlListing
      ? {
          ml_item_id: p.mlListing.mlItemId,
          status: p.mlListing.status as "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ERROR",
          permalink: p.mlListing.permalink,
          last_sync_at: p.mlListing.lastSyncAt,
          last_error: p.mlListing.lastError,
        }
      : null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

const publicConfigRoute = base
  .route({
    method: "GET",
    path: "/public-config",
    summary: "Public shop config (low_stock_threshold)",
    tags: ["Catalog"],
  })
  .output(publicShopConfigResponseSchema)
  .handler(async () => {
    const raw =
      (await getSetting(settingsKeyToDbKey("shopLowStockThreshold"))) ??
      DEFAULT_SETTINGS.shopLowStockThreshold;
    const parsed = Number.parseInt(raw, 10);
    const low_stock_threshold = Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
    return { data: { low_stock_threshold }, status: "ok" as const };
  });

const listRoute = optionalAuthed
  .route({ method: "GET", path: "/products", summary: "List products", tags: ["Catalog"] })
  .input(productListInputSchema)
  .output(productListResponseSchema)
  .handler(async ({ input, context }) => {
    const includeInactive = Boolean(input.include_inactive) && Boolean(context.user);
    const { data, nextCursor } = await listProducts(
      stripUndefined({
        categorySlug: input.category_slug,
        q: input.q,
        limit: input.limit,
        cursor: input.cursor,
        includeInactive,
      })
    );
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
    const product = await createProduct(
      stripUndefined({
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
      })
    );
    const full = await getProductById(product.id);
    if (!full) {
      throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
    }
    return { data: serializeProduct(full), status: "ok" as const };
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
      await updateProduct(
        input.id,
        stripUndefined({
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
        })
      );
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
    const cat = await createProductCategory(
      stripUndefined({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        parentId: input.parent_id ?? null,
        displayOrder: input.display_order,
        mlCategoryId: input.ml_category_id ?? null,
        imageUrl: input.image_url ?? null,
      })
    );
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
      const cat = await updateProductCategory(
        input.id,
        stripUndefined({
          slug: input.category.slug,
          name: input.category.name,
          description: input.category.description ?? undefined,
          parentId: input.category.parent_id ?? undefined,
          displayOrder: input.category.display_order,
          mlCategoryId: input.category.ml_category_id ?? undefined,
          imageUrl: input.category.image_url ?? undefined,
        })
      );
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

function serializeChannelPrice(cp: {
  id: number;
  productId: number;
  channel: "WEB" | "MERCADO_LIBRE" | "UBER_EATS" | "PEDIDOS_YA" | "RAPPI";
  priceClp: number;
  url: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: cp.id,
    product_id: cp.productId,
    channel: cp.channel,
    price_clp: cp.priceClp,
    url: cp.url,
    notes: cp.notes,
    created_at: cp.createdAt,
    updated_at: cp.updatedAt,
  };
}

const listChannelPricesRoute = requireStaff
  .route({
    method: "GET",
    path: "/products/{id}/channel-prices",
    summary: "List channel prices for a product",
    tags: ["Catalog"],
  })
  .input(productIdInputSchema)
  .output(channelPriceListResponseSchema)
  .handler(async ({ input }) => {
    const rows = await listChannelPrices(input.id);
    return { data: rows.map(serializeChannelPrice), status: "ok" as const };
  });

const upsertChannelPriceRoute = requireStaff
  .route({
    method: "PUT",
    path: "/channel-prices",
    summary: "Upsert channel price",
    tags: ["Catalog"],
  })
  .input(channelPriceUpsertInputSchema)
  .output(channelPriceResponseSchema)
  .handler(async ({ input }) => {
    const cp = await upsertChannelPrice(
      stripUndefined({
        productId: input.product_id,
        channel: input.channel,
        priceClp: input.price_clp,
        url: input.url ?? null,
        notes: input.notes ?? null,
      })
    );
    return { data: serializeChannelPrice(cp), status: "ok" as const };
  });

const deleteChannelPriceRoute = requireStaff
  .route({
    method: "DELETE",
    path: "/channel-prices",
    summary: "Delete channel price",
    tags: ["Catalog"],
  })
  .input(channelPriceDeleteInputSchema)
  .output(catalogStatusResponseSchema)
  .handler(async ({ input }) => {
    await deleteChannelPrice(input.product_id, input.channel);
    return { status: "ok" as const };
  });

function serializeReview(r: {
  id: number;
  productId: number;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  createdAt: Date;
}) {
  // NOTE: deliberately omits author_email + status from public response
  return {
    id: r.id,
    product_id: r.productId,
    author_name: r.authorName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    created_at: r.createdAt,
  };
}

const listReviewsRoute = base
  .route({
    method: "GET",
    path: "/products/{id}/reviews",
    summary: "List approved reviews for a product (public)",
    tags: ["Catalog"],
  })
  .input(productIdInputSchema)
  .output(productReviewListResponseSchema)
  .handler(async ({ input }) => {
    const { data, aggregate } = await listApprovedReviews(input.id);
    return {
      data: data.map(serializeReview),
      aggregate,
      status: "ok" as const,
    };
  });

const submitReviewRoute = base
  .route({
    method: "POST",
    path: "/reviews",
    summary: "Submit a product review (public, requires moderation)",
    tags: ["Catalog"],
  })
  .input(productReviewSubmitInputSchema)
  .output(productReviewSubmitResponseSchema)
  .handler(async ({ input }: { input: z.output<typeof productReviewSubmitInputSchema> }) => {
    const product = await getProductById(input.product_id);
    if (!product) {
      throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });
    }
    const { id } = await submitReview({
      productId: input.product_id,
      authorName: input.author_name,
      authorEmail: input.author_email,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
    });
    return {
      data: { id, status: "PENDING" as const },
      status: "ok" as const,
    };
  });

const moderateReviewRoute = requireStaff
  .route({
    method: "PUT",
    path: "/reviews/{id}",
    summary: "Approve or reject a pending review (staff)",
    tags: ["Catalog"],
  })
  .input(productReviewModerateInputSchema)
  .output(productReviewModerateResponseSchema)
  .handler(async ({ input }) => {
    const result = await moderateReview(input.id, input.status);
    return {
      data: { id: result.id, status: result.status },
      status: "ok" as const,
    };
  });

const pendingReviewsRoute = requireStaff
  .route({
    method: "GET",
    path: "/reviews/pending",
    summary: "List all pending reviews (staff moderation queue)",
    tags: ["Catalog"],
  })
  .output(productReviewPendingListResponseSchema)
  .handler(async () => {
    const rows = await listPendingReviews();
    return {
      data: rows.map((r: (typeof rows)[number]) => ({
        id: r.id,
        product_id: r.productId,
        author_name: r.authorName,
        author_email: r.authorEmail,
        rating: r.rating,
        title: r.title,
        body: r.body,
        verified: r.verified,
        status: "PENDING" as const,
        created_at: r.createdAt,
        product: {
          id: r.product.id,
          name: r.product.name,
          slug: r.product.slug,
        },
      })),
      status: "ok" as const,
    };
  });

const catalogORPCRouterBase = {
  publicConfig: publicConfigRoute,
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
  listChannelPrices: listChannelPricesRoute,
  upsertChannelPrice: upsertChannelPriceRoute,
  deleteChannelPrice: deleteChannelPriceRoute,
  listReviews: listReviewsRoute,
  submitReview: submitReviewRoute,
  moderateReview: moderateReviewRoute,
  pendingReviews: pendingReviewsRoute,
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
