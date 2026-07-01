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
  // Chilexpress-validated street number (structured) + the comuna coverage code,
  // persisted so the shipment OT can be created without re-asking the buyer.
  street_number: z.string().optional(),
  city: z.string().min(2),
  region: z.string().min(2),
  county_code: z.string().optional(),
  postal_code: z.string().optional(),
});

export const checkoutStreetsInputSchema = z.object({
  county_name: z.string().min(2),
  query: z.string().min(2),
});

export const checkoutStreetsResponseSchema = z.object({
  data: z.object({
    streets: z.array(z.object({ street_id: z.number().int(), street_name: z.string() })),
  }),
  status: z.literal("ok"),
});

export const checkoutStreetNumbersInputSchema = z.object({
  street_name_id: z.number().int(),
});

export const checkoutStreetNumbersResponseSchema = z.object({
  data: z.object({
    numbers: z.array(z.object({ number: z.number().int(), address_id: z.number().int() })),
  }),
  status: z.literal("ok"),
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

export const checkoutStatusInputSchema = z
  .object({
    order_number: z.string(),
    // Opaque token (preferred, no PII in URL) or the customer email (legacy
    // links). One is required.
    token: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => Boolean(d.token) || Boolean(d.email), {
    message: "Se requiere token o email",
  });

export const checkoutStatusResponseSchema = z.object({
  data: z.object({
    order_number: z.string(),
    status: z.enum(["PENDING", "PAID", "FULFILLED", "DELIVERED", "CANCELLED", "REFUNDED"]),
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
  streets: oc
    .route({ method: "GET", path: "/streets" })
    .input(checkoutStreetsInputSchema)
    .output(checkoutStreetsResponseSchema),
  streetNumbers: oc
    .route({ method: "GET", path: "/street-numbers" })
    .input(checkoutStreetNumbersInputSchema)
    .output(checkoutStreetNumbersResponseSchema),
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
