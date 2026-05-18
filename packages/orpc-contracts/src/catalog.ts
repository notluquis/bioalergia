import { oc } from "@orpc/contract";
import { z } from "zod";

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const productImageSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  r2_key: z.string(),
  cdn_url: z.string().url(),
  alt: z.string().nullable(),
  position: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  is_primary: z.boolean(),
});

export const productCategorySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.number().int().nullable(),
  display_order: z.number().int(),
  ml_category_id: z.string().nullable(),
  image_url: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const productSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  short_description: z.string().nullable(),
  description: z.string().nullable(),
  category_id: z.number().int().nullable(),
  category: productCategorySchema.nullable().optional(),
  brand: z.string().nullable(),
  price_clp: z.number().int(),
  compare_at_price_clp: z.number().int().nullable(),
  cost_clp: z.number().int().nullable(),
  weight_grams: z.number().int().nullable(),
  barcode: z.string().nullable(),
  requires_prescription: z.boolean(),
  status: productStatusSchema,
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  available_qty: z.number().int(),
  safety_stock: z.number().int(),
  images: z.array(productImageSchema).optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const productListInputSchema = z.object({
  category_slug: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().optional(),
  include_inactive: z.coerce.boolean().optional(),
});

export const productListResponseSchema = z.object({
  data: z.array(productSchema),
  next_cursor: z.number().int().nullable(),
  status: z.literal("ok"),
});

export const productResponseSchema = z.object({
  data: productSchema,
  status: z.literal("ok"),
});

export const productSlugInputSchema = z.object({
  slug: z.string().min(1),
});

export const productIdInputSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const productCreateInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug debe ser kebab-case ASCII"),
  sku: z.string().min(1),
  name: z.string().min(1),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  brand: z.string().nullable().optional(),
  price_clp: z.number().int().nonnegative(),
  compare_at_price_clp: z.number().int().nonnegative().nullable().optional(),
  cost_clp: z.number().int().nonnegative().nullable().optional(),
  weight_grams: z.number().int().nonnegative().nullable().optional(),
  barcode: z.string().nullable().optional(),
  requires_prescription: z.boolean().optional(),
  status: productStatusSchema.optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  available_qty: z.number().int().nonnegative().optional(),
  safety_stock: z.number().int().nonnegative().optional(),
});

export const productUpdateInputSchema = productCreateInputSchema.partial();

export const productCategoryCreateInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parent_id: z.number().int().nullable().optional(),
  display_order: z.number().int().optional(),
  ml_category_id: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
});

export const productCategoryUpdateInputSchema = productCategoryCreateInputSchema.partial();

export const productCategoriesResponseSchema = z.object({
  data: z.array(productCategorySchema),
  status: z.literal("ok"),
});

export const productCategoryResponseSchema = z.object({
  data: productCategorySchema,
  status: z.literal("ok"),
});

export const catalogStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const publicShopConfigResponseSchema = z.object({
  data: z.object({
    low_stock_threshold: z.number().int().nonnegative(),
  }),
  status: z.literal("ok"),
});

export const catalogContract = {
  publicConfig: oc
    .route({ method: "GET", path: "/public-config" })
    .output(publicShopConfigResponseSchema),
  list: oc
    .route({ method: "GET", path: "/products" })
    .input(productListInputSchema)
    .output(productListResponseSchema),
  getBySlug: oc
    .route({ method: "GET", path: "/products/by-slug/{slug}" })
    .input(productSlugInputSchema)
    .output(productResponseSchema),
  getById: oc
    .route({ method: "GET", path: "/products/{id}" })
    .input(productIdInputSchema)
    .output(productResponseSchema),
  adminCreate: oc
    .route({ method: "POST", path: "/products" })
    .input(productCreateInputSchema)
    .output(productResponseSchema),
  adminUpdate: oc
    .route({ method: "PUT", path: "/products/{id}" })
    .input(
      z.object({ id: z.coerce.number().int().positive(), product: productUpdateInputSchema })
    )
    .output(productResponseSchema),
  adminArchive: oc
    .route({ method: "DELETE", path: "/products/{id}" })
    .input(productIdInputSchema)
    .output(catalogStatusResponseSchema),
  listCategories: oc
    .route({ method: "GET", path: "/categories" })
    .output(productCategoriesResponseSchema),
  createCategory: oc
    .route({ method: "POST", path: "/categories" })
    .input(productCategoryCreateInputSchema)
    .output(productCategoryResponseSchema),
  updateCategory: oc
    .route({ method: "PUT", path: "/categories/{id}" })
    .input(
      z.object({
        id: z.coerce.number().int().positive(),
        category: productCategoryUpdateInputSchema,
      })
    )
    .output(productCategoryResponseSchema),
  deleteCategory: oc
    .route({ method: "DELETE", path: "/categories/{id}" })
    .input(productIdInputSchema)
    .output(catalogStatusResponseSchema),
};

export type CatalogContract = typeof catalogContract;
