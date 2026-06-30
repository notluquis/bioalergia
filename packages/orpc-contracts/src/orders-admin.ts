import { oc } from "@orpc/contract";
import { z } from "zod";

export const orderStatusEnum = z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]);

export const billingTypeEnum = z.enum(["BOLETA", "FACTURA"]);

// Row shown in the admin list — no items/address (kept light for the table).
export const orderSummarySchema = z.object({
  id: z.number().int(),
  number: z.string(),
  status: orderStatusEnum,
  customer_name: z.string(),
  customer_email: z.string(),
  billing_type: billingTypeEnum,
  total_clp: z.number().int(),
  dte_folio: z.string().nullable(),
  dte_type: z.string().nullable(),
  item_count: z.number().int(),
  created_at: z.date(),
});

export const orderItemSchema = z.object({
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
  // Chilexpress address JSON ({ street, city, region }) or null for pickup.
  shipping_address: z.unknown().nullable(),
  notes: z.string().nullable(),
  items: z.array(orderItemSchema),
});

export const ordersListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.number().int().optional(),
  status: orderStatusEnum.optional(),
  search: z.string().optional(),
});

export const ordersListResponseSchema = z.object({
  data: z.object({
    orders: z.array(orderSummarySchema),
    next_cursor: z.number().int().nullable(),
  }),
  status: z.literal("ok"),
});

export const orderIdInputSchema = z.object({ id: z.number().int() });

export const orderDetailResponseSchema = z.object({
  data: orderDetailSchema,
  status: z.literal("ok"),
});

export const ordersAdminContract = {
  list: oc
    .route({ method: "GET", path: "/orders" })
    .input(ordersListInputSchema)
    .output(ordersListResponseSchema),
  detail: oc
    .route({ method: "GET", path: "/orders/detail" })
    .input(orderIdInputSchema)
    .output(orderDetailResponseSchema),
  markFulfilled: oc
    .route({ method: "POST", path: "/orders/fulfill" })
    .input(orderIdInputSchema)
    .output(orderDetailResponseSchema),
  cancel: oc
    .route({ method: "POST", path: "/orders/cancel" })
    .input(orderIdInputSchema)
    .output(orderDetailResponseSchema),
  refund: oc
    .route({ method: "POST", path: "/orders/refund" })
    .input(orderIdInputSchema)
    .output(orderDetailResponseSchema),
};

export type OrdersAdminContract = typeof ordersAdminContract;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
