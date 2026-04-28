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

export const dteAnalyticsSalesLinkedEventsQuerySchema = z.object({
  dteSaleDetailId: z.string().min(1),
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
  lineItemsCount: z.number().int().nonnegative(),
  netAmount: z.number(),
  referenceDocFolio: z.string().nullable(),
  referenceDocType: z.string().nullable(),
  saleType: z.string(),
  linkedEventsCount: z.number().int().nonnegative(),
  totalAmount: z.number(),
});

export const dteAnalyticsSalesLinkedEventSchema = z.object({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  calendarId: z.string(),
  confidenceScore: z.number().nullable(),
  displayName: z.string().nullable(),
  eventDate: z.string(),
  eventId: z.string(),
  eventTime: z.string().nullable(),
  matchedBy: z.string().nullable(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).nullable(),
  summary: z.string().nullable(),
});

export const dteAnalyticsSalesLinkedEventsResponseSchema = z.object({
  data: z.object({
    dte: dteAnalyticsSalesDetailSchema,
    linkedEvents: z.array(dteAnalyticsSalesLinkedEventSchema),
  }),
  status: z.literal("success"),
});

export const dteAnalyticsPurchaseDetailSchema = z.object({
  documentDate: z.string(),
  documentType: z.number().int(),
  exemptAmount: z.number(),
  folio: z.string(),
  id: z.string(),
  lineItemsCount: z.number().int().nonnegative(),
  netAmount: z.number(),
  nonRecoverableIVA: z.number(),
  providerName: z.string(),
  providerRUT: z.string(),
  purchaseType: z.string(),
  receiptDate: z.string(),
  recoverableIVA: z.number(),
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

// ── Line Items (from XML) ────────────────────────────────────────────────────

export const dteLineItemSchema = z.object({
  id: z.string(),
  lineNumber: z.number().int(),
  itemName: z.string(),
  itemDescription: z.string().nullable(),
  quantity: z.number(),
  unit: z.string().nullable(),
  unitPrice: z.number(),
  amount: z.number(),
  isExempt: z.boolean(),
  itemCode: z.string().nullable(),
  itemCodeType: z.string().nullable(),
  discountPercent: z.number().nullable(),
  discountAmount: z.number().nullable(),
});

export const dteLineItemsQuerySchema = z.object({
  dteId: z.string().min(1),
  direction: z.enum(["sale", "purchase"]),
});

export const dteLineItemsResponseSchema = z.object({
  data: z.array(dteLineItemSchema),
  status: z.literal("success"),
});

export const dteFetchXmlInputSchema = z.object({
  dteIds: z.array(z.string().min(1)).min(1).max(50),
  direction: z.enum(["sales", "purchases"]),
});

export const dteFetchXmlByPeriodInputSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  direction: z.enum(["sales", "purchases"]),
  onlyMissing: z.boolean().default(true),
});

export const dteFetchXmlByPeriodResponseSchema = z.object({
  jobId: z.string(),
  total: z.number().int(),
  status: z.literal("success"),
});

export const dteXmlJobStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  progress: z.number().int(),
  total: z.number().int(),
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
});

export const dteXmlJobStatusResponseSchema = z.object({
  job: dteXmlJobStatusSchema.nullable(),
  status: z.literal("success"),
});

export const dteFetchXmlResultDetailSchema = z.object({
  folio: z.string(),
  documentType: z.number().int(),
  lineItemsCount: z.number().int(),
  status: z.enum(["fetched", "not_found", "error", "already_has"]),
});

export const dteFetchXmlResponseSchema = z.object({
  fetched: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(z.string()),
  details: z.array(dteFetchXmlResultDetailSchema),
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
  salesLinkedEvents: oc
    .route({ method: "GET", path: "/sales/linked-events" })
    .input(dteAnalyticsSalesLinkedEventsQuerySchema)
    .output(dteAnalyticsSalesLinkedEventsResponseSchema),
  salesSummary: oc
    .route({ method: "GET", path: "/sales/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema),
  lineItems: oc
    .route({ method: "GET", path: "/line-items" })
    .input(dteLineItemsQuerySchema)
    .output(dteLineItemsResponseSchema),
  fetchXml: oc
    .route({ method: "POST", path: "/fetch-xml" })
    .input(dteFetchXmlInputSchema)
    .output(dteFetchXmlResponseSchema),
  fetchXmlByPeriod: oc
    .route({ method: "POST", path: "/fetch-xml-by-period" })
    .input(dteFetchXmlByPeriodInputSchema)
    .output(dteFetchXmlByPeriodResponseSchema),
  xmlJobStatus: oc
    .route({ method: "GET", path: "/xml-job-status" })
    .output(dteXmlJobStatusResponseSchema),
};

export type DteAnalyticsContract = typeof dteAnalyticsContract;
