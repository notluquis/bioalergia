import { oc } from "@orpc/contract";
import { z } from "zod";

export const settlementTransactionsQuerySchema = z.object({
  from: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  paymentMethod: z.string().optional(),
  search: z.string().optional(),
  to: z.string().optional(),
  transactionType: z.string().optional(),
});

export const settlementTransactionIdSchema = z.object({
  id: z.number().int().positive(),
});

export const settlementTransactionSchema = z.looseObject({});

export const settlementTransactionsListResponseSchema = z.object({
  data: z.array(settlementTransactionSchema),
  page: z.number(),
  pageSize: z.number(),
  status: z.literal("ok"),
  total: z.number(),
  totalPages: z.number(),
});

export const settlementTransactionsDetailResponseSchema = z.object({
  data: settlementTransactionSchema,
  status: z.literal("ok"),
});

export const settlementTransactionsContract = {
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(settlementTransactionIdSchema)
    .output(settlementTransactionsDetailResponseSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(settlementTransactionsQuerySchema)
    .output(settlementTransactionsListResponseSchema),
};

export type SettlementTransactionsContract = typeof settlementTransactionsContract;
