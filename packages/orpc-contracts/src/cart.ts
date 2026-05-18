import { oc } from "@orpc/contract";
import { z } from "zod";

export const cartItemSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  qty: z.number().int().positive(),
  unit_price_clp: z.number().int().nonnegative(),
  // Snapshot del producto al momento (no se re-fetch en checkout):
  product: z.object({
    id: z.number().int(),
    sku: z.string(),
    slug: z.string(),
    name: z.string(),
    brand: z.string().nullable(),
    primary_image_url: z.string().url().nullable(),
    available_qty: z.number().int(),
  }),
});

export const cartSchema = z.object({
  id: z.number().int(),
  currency: z.string(),
  items: z.array(cartItemSchema),
  subtotal_clp: z.number().int(),
  total_clp: z.number().int(),
  item_count: z.number().int(),
});

export const cartResponseSchema = z.object({
  data: cartSchema,
  status: z.literal("ok"),
});

export const addItemInputSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().int().positive().max(99).default(1),
});

export const updateItemInputSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().int().min(0).max(99),
});

export const removeItemInputSchema = z.object({
  product_id: z.number().int().positive(),
});

export const cartStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const cartContract = {
  get: oc.route({ method: "GET", path: "/cart" }).output(cartResponseSchema),
  addItem: oc
    .route({ method: "POST", path: "/cart/items" })
    .input(addItemInputSchema)
    .output(cartResponseSchema),
  updateItem: oc
    .route({ method: "PUT", path: "/cart/items" })
    .input(updateItemInputSchema)
    .output(cartResponseSchema),
  removeItem: oc
    .route({ method: "DELETE", path: "/cart/items" })
    .input(removeItemInputSchema)
    .output(cartResponseSchema),
  clear: oc.route({ method: "POST", path: "/cart/clear" }).output(cartStatusResponseSchema),
};

export type CartContract = typeof cartContract;
