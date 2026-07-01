import { z } from "zod";

/**
 * LOCAL response schemas (per project rule: intranet validates API responses
 * with feature-local `z.strictObject` schemas, NOT the oRPC contract). superjson
 * revives `Date`, but we use `z.coerce.date()` to stay robust to transport drift.
 */

export const orderStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FULFILLED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const billingTypeSchema = z.enum(["BOLETA", "FACTURA"]);

export const orderSummarySchema = z.strictObject({
  id: z.number().int(),
  number: z.string(),
  status: orderStatusSchema,
  customer_name: z.string(),
  customer_email: z.string(),
  billing_type: billingTypeSchema,
  total_clp: z.number().int(),
  dte_folio: z.string().nullable(),
  dte_type: z.string().nullable(),
  item_count: z.number().int(),
  created_at: z.coerce.date(),
});

export const orderItemSchema = z.strictObject({
  id: z.number().int(),
  product_id: z.number().int(),
  product_name: z.string(),
  product_sku: z.string(),
  qty: z.number().int(),
  unit_price_clp: z.number().int(),
  line_total_clp: z.number().int(),
});

export const orderDetailSchema = orderSummarySchema.extend({
  customer_rut: z.string().nullable(),
  customer_phone: z.string().nullable(),
  subtotal_clp: z.number().int(),
  shipping_clp: z.number().int(),
  shipping_address: z.unknown().nullable(),
  cx_ot_number: z.string().nullable(),
  cx_label_base64: z.string().nullable(),
  dte_pdf_url: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(orderItemSchema),
});

export const ordersListResponseSchema = z.strictObject({
  data: z.strictObject({
    orders: z.array(orderSummarySchema),
    next_cursor: z.number().int().nullable(),
  }),
  status: z.literal("ok"),
});

export const orderDetailResponseSchema = z.strictObject({
  data: orderDetailSchema,
  status: z.literal("ok"),
});
