import { oc } from "@orpc/contract";
import { z } from "zod";

export const billingTypeSchema = z.enum(["BOLETA", "FACTURA"]);

export const customerInfoSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  rut: z
    .string()
    .regex(/^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/, "RUT inválido")
    .optional(),
});

export const shippingAddressSchema = z.object({
  street: z.string().min(2),
  city: z.string().min(2),
  region: z.string().min(2),
  postal_code: z.string().optional(),
});

export const checkoutStartInputSchema = z.object({
  customer: customerInfoSchema,
  billing_type: billingTypeSchema.default("BOLETA"),
  shipping: z.discriminatedUnion("method", [
    z.object({ method: z.literal("pickup") }),
    z.object({
      method: z.literal("chilexpress"),
      address: shippingAddressSchema,
      // Coverage code + chosen service let the server re-quote and charge the
      // real shipping fee (never trust a client-sent amount).
      county_code: z.string().min(3),
      service_code: z.string().optional(),
    }),
  ]),
  notes: z.string().optional(),
});

export const checkoutStartResponseSchema = z.object({
  data: z.object({
    order_id: z.number().int(),
    order_number: z.string(),
    total_clp: z.number().int(),
    // Checkout Pro hosted-checkout URL to redirect the buyer to.
    init_point: z.string(),
  }),
  status: z.literal("ok"),
});

export const checkoutStatusInputSchema = z.object({
  order_number: z.string(),
  email: z.string().email(),
});

export const checkoutStatusResponseSchema = z.object({
  data: z.object({
    order_number: z.string(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]),
    total_clp: z.number().int(),
    dte_folio: z.string().nullable(),
    dte_type: z.string().nullable(),
  }),
  status: z.literal("ok"),
});

export const checkoutQuoteInputSchema = z.object({
  destination_county_code: z.string().min(3),
});

export const checkoutQuoteResponseSchema = z.object({
  data: z.object({
    options: z.array(
      z.object({
        service_code: z.string(),
        service_description: z.string(),
        shipping_clp: z.number().int().nonnegative(),
        delivery_time_days: z.string().nullable(),
      })
    ),
  }),
  status: z.literal("ok"),
});

export const checkoutCommunesResponseSchema = z.object({
  data: z.object({
    communes: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        region: z.string(),
      })
    ),
  }),
  status: z.literal("ok"),
});

export const checkoutContract = {
  communes: oc
    .route({ method: "GET", path: "/communes" })
    .output(checkoutCommunesResponseSchema),
  quote: oc
    .route({ method: "POST", path: "/quote" })
    .input(checkoutQuoteInputSchema)
    .output(checkoutQuoteResponseSchema),
  start: oc
    .route({ method: "POST", path: "/start" })
    .input(checkoutStartInputSchema)
    .output(checkoutStartResponseSchema),
  status: oc
    .route({ method: "POST", path: "/status" })
    .input(checkoutStatusInputSchema)
    .output(checkoutStatusResponseSchema),
};

export type CheckoutContract = typeof checkoutContract;
