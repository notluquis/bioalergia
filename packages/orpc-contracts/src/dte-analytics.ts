import { oc } from "@orpc/contract";
import { z } from "zod";

export const dteAnalyticsPeriodParamsSchema = z.object({
  startPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  endPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  year: z.number().int().min(2020).max(2030).optional(),
});

export const dteAnalyticsDetailsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(100),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const dteAnalyticsSummaryRowSchema = z.object({
  averageAmount: z.number(),
  count: z.number().int(),
  exemptAmount: z.number(),
  netAmount: z.number(),
  period: z.string(),
  taxAmount: z.number(),
  totalAmount: z.number(),
});

export const dteAnalyticsSalesDetailSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  documentDate: z.string(),
  documentType: z.number().int(),
  emitterRUT: z.string().nullable(),
  exemptAmount: z.number(),
  folio: z.string(),
  id: z.string(),
  ivaAmount: z.number(),
  netAmount: z.number(),
  referenceDocFolio: z.string().nullable(),
  referenceDocType: z.string().nullable(),
  registerNumber: z.number().int(),
  saleType: z.string(),
  totalAmount: z.number(),
});

export const dteAnalyticsPurchaseDetailSchema = z.object({
  documentDate: z.string(),
  documentType: z.number().int(),
  exemptAmount: z.number(),
  folio: z.string(),
  id: z.string(),
  netAmount: z.number(),
  nonRecoverableIVA: z.number(),
  providerName: z.string(),
  providerRUT: z.string(),
  purchaseType: z.string(),
  receiptDate: z.string(),
  recoverableIVA: z.number(),
  registerNumber: z.number().int(),
  totalAmount: z.number(),
});

export const dteAnalyticsListMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const dteAnalyticsSummaryResponseSchema = z.object({
  data: z.array(dteAnalyticsSummaryRowSchema),
  status: z.literal("success"),
});

export const dteAnalyticsPeriodsResponseSchema = z.object({
  data: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
  status: z.literal("success"),
});

export const dteAnalyticsSalesDetailsResponseSchema = z.object({
  data: z.array(dteAnalyticsSalesDetailSchema),
  meta: dteAnalyticsListMetaSchema,
  status: z.literal("success"),
});

export const dteAnalyticsPurchasesDetailsResponseSchema = z.object({
  data: z.array(dteAnalyticsPurchaseDetailSchema),
  meta: dteAnalyticsListMetaSchema,
  status: z.literal("success"),
});

export const dteAnalyticsContract = {
  purchasesAvailablePeriods: oc
    .route({ method: "GET", path: "/purchases/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema),
  purchasesDetails: oc
    .route({ method: "GET", path: "/purchases/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsPurchasesDetailsResponseSchema),
  purchasesSummary: oc
    .route({ method: "GET", path: "/purchases/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema),
  salesAvailablePeriods: oc
    .route({ method: "GET", path: "/sales/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema),
  salesDetails: oc
    .route({ method: "GET", path: "/sales/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsSalesDetailsResponseSchema),
  salesSummary: oc
    .route({ method: "GET", path: "/sales/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema),
};

export type DteAnalyticsContract = typeof dteAnalyticsContract;
