import { oc } from "@orpc/contract";
import { z } from "zod";

export const inventoryCategorySchema = z.object({
  created_at: z.date(),
  id: z.number().int(),
  name: z.string(),
});

export const inventoryItemSchema = z.object({
  category_id: z.number().int().nullable(),
  category_name: z.string().nullable().optional(),
  created_at: z.date(),
  current_stock: z.number().int(),
  description: z.string().nullable(),
  id: z.number().int(),
  name: z.string(),
  updated_at: z.date(),
});

export const inventoryAllergyProviderSchema = z.object({
  accounts: z.array(z.string()),
  current_price: z.number().nullable(),
  last_price_check: z.date().nullable(),
  last_stock_check: z.date().nullable(),
  provider_id: z.number(),
  provider_name: z.string(),
  provider_rut: z.string(),
});

export const inventoryAllergyOverviewSchema = z.object({
  allergy_type: z.object({
    category: z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
    }),
    type: z.object({
      id: z.number().int(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
    }),
  }),
  current_stock: z.number().int(),
  description: z.string().nullable(),
  item_id: z.number().int(),
  name: z.string(),
  providers: z.array(inventoryAllergyProviderSchema),
});

export const inventoryCategoriesResponseSchema = z.object({
  data: z.array(inventoryCategorySchema),
  status: z.literal("ok"),
});

export const inventoryCategoryResponseSchema = z.object({
  data: inventoryCategorySchema,
  status: z.literal("ok"),
});

export const inventoryItemsResponseSchema = z.object({
  data: z.array(inventoryItemSchema),
  status: z.literal("ok"),
});

export const inventoryItemResponseSchema = z.object({
  data: inventoryItemSchema,
  status: z.literal("ok"),
});

export const inventoryAllergyOverviewResponseSchema = z.object({
  data: z.array(inventoryAllergyOverviewSchema),
  status: z.literal("ok"),
});

export const inventoryStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const inventoryCategoryInputSchema = z.object({
  name: z.string().min(1),
});

export const inventoryItemCreateInputSchema = z.object({
  category_id: z.number().nullable().optional(),
  current_stock: z.number().int(),
  description: z.string().nullable().optional(),
  name: z.string().min(1),
});

export const inventoryItemUpdateInputSchema = inventoryItemCreateInputSchema.partial();

export const inventoryMovementInputSchema = z.object({
  item_id: z.number().int().positive(),
  quantity_change: z.number().int(),
  reason: z.string().min(1),
});

export const inventoryIdInputSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const inventoryContract = {
  allergyOverview: oc
    .route({ method: "GET", path: "/allergy-overview" })
    .output(inventoryAllergyOverviewResponseSchema),
  createCategory: oc
    .route({ method: "POST", path: "/categories" })
    .input(inventoryCategoryInputSchema)
    .output(inventoryCategoryResponseSchema),
  createItem: oc
    .route({ method: "POST", path: "/items" })
    .input(inventoryItemCreateInputSchema)
    .output(inventoryItemResponseSchema),
  createMovement: oc
    .route({ method: "POST", path: "/movements" })
    .input(inventoryMovementInputSchema)
    .output(inventoryStatusResponseSchema),
  deleteCategory: oc
    .route({ method: "DELETE", path: "/categories/{id}" })
    .input(inventoryIdInputSchema)
    .output(inventoryStatusResponseSchema),
  deleteItem: oc
    .route({ method: "DELETE", path: "/items/{id}" })
    .input(inventoryIdInputSchema)
    .output(inventoryStatusResponseSchema),
  listCategories: oc
    .route({ method: "GET", path: "/categories" })
    .output(inventoryCategoriesResponseSchema),
  listItems: oc.route({ method: "GET", path: "/items" }).output(inventoryItemsResponseSchema),
  updateItem: oc
    .route({ method: "PUT", path: "/items/{id}" })
    .input(
      z.object({ id: z.coerce.number().int().positive(), item: inventoryItemUpdateInputSchema })
    )
    .output(inventoryItemResponseSchema),
};

export type InventoryContract = typeof inventoryContract;
