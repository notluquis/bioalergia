import { oc } from "@orpc/contract";
import { z } from "zod";

export const releaseTransactionsQuerySchema = z.object({
  descriptions: z.string().optional(),
  from: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  paymentMethod: z.string().optional(),
  search: z.string().optional(),
  to: z.string().optional(),
});

export const releaseTransactionIdSchema = z.object({
  id: z.number().int().positive(),
});

export const releaseTransactionSchema = z.looseObject({});

export const releaseTransactionsListResponseSchema = z.object({
  data: z.array(releaseTransactionSchema),
  page: z.number(),
  pageSize: z.number(),
  status: z.literal("ok"),
  total: z.number(),
  totalPages: z.number(),
});

export const releaseTransactionsDetailResponseSchema = z.object({
  data: releaseTransactionSchema,
  status: z.literal("ok"),
});

export const releaseTransactionsContract = {
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(releaseTransactionIdSchema)
    .output(releaseTransactionsDetailResponseSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(releaseTransactionsQuerySchema)
    .output(releaseTransactionsListResponseSchema),
};

export type ReleaseTransactionsContract = typeof releaseTransactionsContract;
