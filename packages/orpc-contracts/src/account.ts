import { oc } from "@orpc/contract";
import { z } from "zod";

// /mi-cuenta — orders + addresses + repurchase for shop customers.
// All routes require a valid site session cookie (bio_site_session).

export const accountOrderItemSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  qty: z.number().int(),
  unit_price_clp: z.number().int(),
  line_total_clp: z.number().int(),
  product_snapshot: z.unknown(),
});

export const accountOrderSummarySchema = z.object({
  id: z.number().int(),
  number: z.string(),
  status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]),
  channel: z.enum(["WEB", "ML", "POS", "PHONE"]),
  total_clp: z.number().int(),
  subtotal_clp: z.number().int(),
  shipping_clp: z.number().int(),
  discount_clp: z.number().int(),
  dte_folio: z.string().nullable(),
  dte_type: z.string().nullable(),
  created_at: z.string(),
  item_count: z.number().int(),
});

export const accountOrderDetailSchema = accountOrderSummarySchema.extend({
  customer_email: z.string(),
  customer_name: z.string(),
  shipping_address: z.unknown().nullable(),
  items: z.array(accountOrderItemSchema),
  payments: z.array(
    z.object({
      id: z.number().int(),
      provider: z.string(),
      status: z.string(),
      amount_clp: z.number().int(),
      created_at: z.string(),
    })
  ),
});

export const accountMyOrdersInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.number().int().positive().optional(),
});

export const accountMyOrdersResponseSchema = z.object({
  status: z.literal("ok"),
  data: z.array(accountOrderSummarySchema),
  next_cursor: z.number().int().nullable(),
});

export const accountMyOrderByNumberInputSchema = z.object({
  number: z.string(),
});

export const accountMyOrderByNumberResponseSchema = z.object({
  status: z.literal("ok"),
  data: accountOrderDetailSchema,
});

export const accountAddressSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  street: z.string(),
  number: z.string(),
  supplement: z.string().nullable(),
  reference: z.string().nullable(),
  postal_code: z.string().nullable(),
  comuna: z.string(),
  region: z.string(),
  is_primary: z.boolean(),
});

export const accountMyAddressesResponseSchema = z.object({
  status: z.literal("ok"),
  data: z.array(accountAddressSchema),
});

export const accountUpsertAddressInputSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().min(1).max(40).default("Principal"),
  street: z.string().min(2),
  number: z.string().min(1),
  supplement: z.string().optional(),
  reference: z.string().optional(),
  postalCode: z.string().optional(),
  comuna: z.string().min(2),
  region: z.string().min(2),
  isPrimary: z.boolean().default(false),
});

export const accountUpsertAddressResponseSchema = z.object({
  status: z.literal("ok"),
  data: accountAddressSchema,
});

export const accountDeleteAddressInputSchema = z.object({
  id: z.number().int().positive(),
});

export const accountStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const accountRepurchaseInputSchema = z.object({
  orderNumber: z.string(),
});

export const accountRepurchaseResponseSchema = z.object({
  status: z.literal("ok"),
  data: z.object({
    items_added: z.number().int(),
    items_skipped_oos: z.array(
      z.object({
        product_id: z.number().int(),
        name: z.string(),
        reason: z.string(),
      })
    ),
  }),
});

export const accountContract = {
  myOrders: oc
    .route({ method: "POST", path: "/orders" })
    .input(accountMyOrdersInputSchema)
    .output(accountMyOrdersResponseSchema),
  myOrderByNumber: oc
    .route({ method: "POST", path: "/orders/by-number" })
    .input(accountMyOrderByNumberInputSchema)
    .output(accountMyOrderByNumberResponseSchema),
  myAddresses: oc
    .route({ method: "GET", path: "/addresses" })
    .output(accountMyAddressesResponseSchema),
  upsertAddress: oc
    .route({ method: "POST", path: "/addresses/upsert" })
    .input(accountUpsertAddressInputSchema)
    .output(accountUpsertAddressResponseSchema),
  deleteAddress: oc
    .route({ method: "POST", path: "/addresses/delete" })
    .input(accountDeleteAddressInputSchema)
    .output(accountStatusResponseSchema),
  repurchase: oc
    .route({ method: "POST", path: "/repurchase" })
    .input(accountRepurchaseInputSchema)
    .output(accountRepurchaseResponseSchema),
};

export type AccountContract = typeof accountContract;
