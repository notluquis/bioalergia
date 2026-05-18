import { oc } from "@orpc/contract";
import { z } from "zod";

export const mlConnectionStatusSchema = z.object({
  data: z.discriminatedUnion("connected", [
    z.object({
      connected: z.literal(true),
      ml_user_id: z.string(),
      expires_at: z.date(),
      scope: z.string().nullable(),
    }),
    z.object({ connected: z.literal(false) }),
  ]),
  status: z.literal("ok"),
});

export const mlStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const mlConnectUrlResponseSchema = z.object({
  data: z.object({ authorization_url: z.string().url(), state: z.string() }),
  status: z.literal("ok"),
});

export const mlPublishInputSchema = z.object({
  product_id: z.number().int().positive(),
  ml_category_id: z.string().optional(),
});

export const mlPublishResponseSchema = z.object({
  data: z.object({
    ml_item_id: z.string(),
    permalink: z.string().url(),
  }),
  status: z.literal("ok"),
});

export const mlPredictCategoryInputSchema = z.object({
  query: z.string().min(1),
});

export const mlPredictCategoryResponseSchema = z.object({
  data: z
    .object({
      category_id: z.string(),
      category_name: z.string(),
    })
    .nullable(),
  status: z.literal("ok"),
});

export const mlContract = {
  status: oc.route({ method: "GET", path: "/status" }).output(mlConnectionStatusSchema),
  connect: oc.route({ method: "POST", path: "/connect" }).output(mlConnectUrlResponseSchema),
  disconnect: oc
    .route({ method: "POST", path: "/disconnect" })
    .output(mlStatusResponseSchema),
  publishProduct: oc
    .route({ method: "POST", path: "/publish" })
    .input(mlPublishInputSchema)
    .output(mlPublishResponseSchema),
  predictCategory: oc
    .route({ method: "POST", path: "/predict-category" })
    .input(mlPredictCategoryInputSchema)
    .output(mlPredictCategoryResponseSchema),
};

export type MlContract = typeof mlContract;
