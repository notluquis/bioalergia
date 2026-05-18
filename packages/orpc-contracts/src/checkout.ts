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

export const brickSubmissionSchema = z.object({
  token: z.string(),
  payment_method_id: z.string(),
  issuer_id: z.string().optional(),
  installments: z.number().int().positive(),
  payer: z.object({
    email: z.string().email(),
    identification: z
      .object({
        type: z.string(),
        number: z.string(),
      })
      .optional(),
  }),
});

export const checkoutStartInputSchema = z.object({
  customer: customerInfoSchema,
  billing_type: billingTypeSchema.default("BOLETA"),
  shipping: z.discriminatedUnion("method", [
    z.object({ method: z.literal("pickup") }),
    z.object({
      method: z.literal("chilexpress"),
      address: shippingAddressSchema,
      service_code: z.string().optional(),
    }),
  ]),
  notes: z.string().optional(),
  brick: brickSubmissionSchema,
});

export const checkoutStartResponseSchema = z.object({
  data: z.object({
    order_id: z.number().int(),
    order_number: z.string(),
    mp_order_id: z.string(),
    mp_status: z.string(),
    mp_status_detail: z.string(),
    total_clp: z.number().int(),
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

export const checkoutContract = {
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
