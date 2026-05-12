import { z } from "zod";

const ApiResponseSchema = z.strictObject({
  data: z.unknown(),
  message: z.string().optional(),
  status: z.string().optional(),
});

const StatusResponseSchema = z.strictObject({ status: z.string().optional() });

const InventoryCategorySchema = z.strictObject({
  created_at: z.coerce.date().optional(),
  id: z.number(),
  name: z.string(),
});

const InventoryItemSchema = z.strictObject({
  category_id: z.number().nullable(),
  category_name: z.string().optional(),
  created_at: z.coerce.date().optional(),
  current_stock: z.number(),
  description: z.string().nullable(),
  id: z.number(),
  name: z.string(),
  updated_at: z.coerce.date().optional(),
});

const AllergyInventoryProviderSchema = z.strictObject({
  accounts: z.array(z.string()),
  current_price: z.number().nullable(),
  last_price_check: z.coerce.date().nullable(),
  last_stock_check: z.coerce.date().nullable(),
  provider_id: z.number(),
  provider_name: z.string(),
  provider_rut: z.string(),
});

const AllergyInventoryOverviewSchema = z.strictObject({
  allergy_type: z.strictObject({
    category: z
      .strictObject({
        id: z.number(),
        name: z.string(),
      })
      .optional(),
    subtype: z
      .strictObject({
        id: z.number(),
        name: z.string(),
      })
      .optional(),
    type: z
      .strictObject({
        id: z.number(),
        name: z.string(),
      })
      .optional(),
  }),
  category: z.strictObject({
    id: z.number().nullable(),
    name: z.string().nullable(),
  }),
  current_stock: z.number(),
  description: z.string().nullable(),
  item_id: z.number(),
  name: z.string(),
  providers: z.array(AllergyInventoryProviderSchema),
});

export const InventorySchemas = {
  AllergyOverviewResponse: ApiResponseSchema.extend({
    data: z.array(AllergyInventoryOverviewSchema),
  }),
  CategoriesResponse: ApiResponseSchema.extend({
    data: z.array(InventoryCategorySchema),
  }),
  ItemsResponse: ApiResponseSchema.extend({
    data: z.array(InventoryItemSchema),
  }),
  CategoryResponse: ApiResponseSchema.extend({
    data: InventoryCategorySchema,
  }),
  ItemResponse: ApiResponseSchema.extend({
    data: InventoryItemSchema,
  }),
  StatusResponse: StatusResponseSchema,
};
