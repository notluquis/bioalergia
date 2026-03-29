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

const decimalValueSchema = z.union([z.number(), z.string(), z.null()]);
const jsonIdSchema = z.union([z.number(), z.string()]).nullable();

export const releaseTransactionSchema = z.object({
  balanceAmount: decimalValueSchema,
  businessUnit: z.string().nullable(),
  cardInitialNumber: z.string().nullable(),
  couponAmount: decimalValueSchema,
  currency: z.string().nullable(),
  date: z.coerce.date(),
  description: z.string().nullable(),
  effectiveCouponAmount: decimalValueSchema,
  externalPosId: z.string().nullable(),
  externalReference: z.string().nullable(),
  externalStoreId: z.string().nullable(),
  financingFeeAmount: decimalValueSchema,
  franchise: z.string().nullable(),
  grossAmount: decimalValueSchema,
  id: z.number(),
  installments: z.number().nullable(),
  issuerName: z.string().nullable(),
  itemId: z.string().nullable(),
  lastFourDigits: z.string().nullable(),
  mpFeeAmount: decimalValueSchema,
  netCreditAmount: decimalValueSchema,
  netDebitAmount: decimalValueSchema,
  operationTags: z.unknown(),
  orderId: jsonIdSchema,
  orderMp: z.string().nullable(),
  packId: jsonIdSchema,
  paymentMethod: z.string().nullable(),
  paymentMethodType: z.string().nullable(),
  payoutBankAccountNumber: z.string().nullable(),
  poiBankName: z.string().nullable(),
  poiId: z.string().nullable(),
  poiWalletName: z.string().nullable(),
  posId: z.string().nullable(),
  posName: z.string().nullable(),
  productSku: z.string().nullable(),
  purchaseId: z.string().nullable(),
  recordType: z.string().nullable(),
  saleDetail: z.string().nullable(),
  sellerAmount: decimalValueSchema,
  shipmentMode: z.string().nullable(),
  shippingFeeAmount: decimalValueSchema,
  shippingId: jsonIdSchema,
  shippingOrderId: z.string().nullable(),
  sourceId: z.string(),
  storeId: z.string().nullable(),
  storeName: z.string().nullable(),
  subUnit: z.string().nullable(),
  taxAmountTelco: decimalValueSchema,
  taxDetail: z.string().nullable(),
  taxesAmount: decimalValueSchema,
  taxesDisaggregated: z.unknown(),
  transactionApprovalDate: z.coerce.date().nullable(),
  transactionIntentId: z.string().nullable(),
});

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
