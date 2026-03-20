import { oc } from "@orpc/contract";
import { z } from "zod";

export const dteEventLinksByDayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const dteEventLinksOverviewInputSchema = z.object({
  page: z.coerce.number().int().min(0).default(0).optional(),
  pageSize: z.coerce.number().int().min(10).max(100).default(25).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  query: z.string().optional(),
  status: z.enum(["all", "linked", "pending_issuance", "unlinked"]).default("all").optional(),
});

export const dteEventLinksSuggestionsInputSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  sameDayOnly: z.boolean().optional(),
});

export const dteEventLinksJobStatusInputSchema = z.object({
  jobId: z.string().min(1),
});

export const dteEventLinksConfirmInputSchema = z.object({
  calendarId: z.string().min(1),
  confidenceScore: z.number().min(0).max(100).optional(),
  dteSaleDetailId: z.string().min(1),
  eventId: z.string().min(1),
  matchedBy: z.enum(["manual", "mixed", "name_exact", "name_fuzzy", "rut"]).optional(),
  matchedName: z.string().nullable().optional(),
  matchedRUT: z.string().nullable().optional(),
});

export const dteEventLinksUnlinkInputSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
});

export const dteEventLinksAutoLinkDayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minScore: z.number().min(0).max(100).optional(),
});

export const dteEventLinksAutoLinkPeriodInputSchema = z.object({
  minScore: z.number().min(0).max(100).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export const dteEventLinksAutoLinkAllPeriodsInputSchema = z.object({
  minScore: z.number().min(0).max(100).optional(),
  periodConcurrency: z.coerce.number().int().min(1).max(6).optional(),
});

export const dteEventLinksSuggestionSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  documentType: z.number(),
  dteSaleDetailId: z.string(),
  exemptAmount: z.number(),
  folio: z.string(),
  ivaAmount: z.number(),
  method: z.enum(["mixed", "name_exact", "name_fuzzy", "rut"]),
  netAmount: z.number(),
  reasons: z.array(z.string()),
  totalAmount: z.number(),
});

export const dteEventLinksByDayLinkSchema = z.object({
  calendarId: z.string(),
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  dteSaleDetailId: z.string(),
  eventId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  status: z.string(),
  totalAmount: z.number(),
});

export const dteEventLinksSuggestionsResponseSchema = z.object({
  event: z
    .object({
      amountExpected: z.number().nullable(),
      amountPaid: z.number().nullable(),
      calendarId: z.string(),
      description: z.string().nullable(),
      eventDate: z.string(),
      eventId: z.string(),
      hints: z.object({
        nameHints: z.array(z.string()),
        rutHints: z.array(z.string()),
      }),
      summary: z.string().nullable(),
    })
    .nullable(),
  linked: z.unknown().nullable(),
  series: z
    .object({
      displayName: z.string().nullable(),
      eligibleDocumentDateFrom: z.string(),
      eligibleDocumentDateTo: z.string(),
      events: z.array(
        z.object({
          amountExpected: z.number().nullable(),
          amountPaid: z.number().nullable(),
          calendarGoogleId: z.string(),
          eventDate: z.string(),
          eventId: z.number(),
          externalEventId: z.string(),
          seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable(),
          seriesStageLabel: z.string().nullable(),
          seriesStageNumber: z.number().nullable(),
          summary: z.string().nullable(),
        }),
      ),
      id: z.number(),
      kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]),
      linkedDocuments: z.array(
        z.object({
          clientName: z.string(),
          clientRUT: z.string(),
          confidenceScore: z.number(),
          documentDate: z.string(),
          dteSaleDetailId: z.string(),
          folio: z.string(),
          matchedBy: z.string(),
          totalAmount: z.number(),
        }),
      ),
      patientName: z.string().nullable(),
      patientRut: z.string().nullable(),
      remainingExpected: z.number(),
      remainingPaid: z.number(),
      status: z.enum(["ACTIVE", "CANCELLED", "COMPLETED"]),
      totalExpected: z.number(),
      totalLinkedAmount: z.number(),
      totalPaid: z.number(),
    })
    .nullable(),
  suggestions: z.array(dteEventLinksSuggestionSchema),
});

export const dteEventLinksOverviewResponseSchema = z.object({
  items: z.array(
    z.object({
      amountExpected: z.number().nullable(),
      amountPaid: z.number().nullable(),
      calendarId: z.string(),
      clinicalSeriesId: z.number().nullable(),
      confidenceScore: z.number().nullable(),
      displayName: z.string().nullable(),
      eventDate: z.string(),
      eventId: z.string(),
      lastAutoLinkSkip: z
        .object({
          attemptedAt: z.string(),
          reason: z.string(),
        })
        .nullable(),
      linkStatus: z.enum(["linked", "pending_issuance", "unlinked"]),
      linked: z.boolean(),
      linkedClientName: z.string().nullable(),
      linkedClientRUT: z.string().nullable(),
      linkedDteSaleDetailId: z.string().nullable(),
      linkedFolio: z.string().nullable(),
      linkedMatchedBy: z.string().nullable(),
      linkedTotalAmount: z.number().nullable(),
      seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).nullable(),
      summary: z.string().nullable(),
      topSuggestion: dteEventLinksSuggestionSchema
        .extend({
          amountDiff: z.number().nullable(),
        })
        .nullable(),
    }),
  ),
  page: z.number(),
  pageSize: z.number(),
  period: z.string(),
  stats: z.object({
    avgLinkedScore: z.number(),
    dueEvents: z.number(),
    linkRate: z.number(),
    linkedEvents: z.number(),
    pendingIssuanceEvents: z.number(),
    totalEvents: z.number(),
    unlinkedEvents: z.number(),
    withPerfectScore: z.number(),
  }),
  totalCount: z.number(),
  totalPages: z.number(),
});

export const dteEventLinksJobStatusResponseSchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  message: z.string(),
  progress: z.number(),
  result: z.unknown(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  total: z.number(),
  type: z.string(),
});

export const dteEventLinksConfirmResponseSchema = z.unknown().nullable();

export const dteEventLinksUnlinkResponseSchema = z.object({
  deleted: z.boolean(),
});

export const dteEventLinksAutoLinkDayResponseSchema = z.object({
  date: z.string(),
  details: z.array(
    z.object({
      eventId: z.string(),
      reason: z.string(),
    }),
  ),
  linked: z.number(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

export const dteEventLinksAutoLinkPeriodResponseSchema = z.object({
  daysProcessed: z.number(),
  details: z.array(
    z.object({
      date: z.string(),
      linked: z.number(),
      skipped: z.number(),
      totalEvents: z.number(),
    }),
  ),
  linked: z.number(),
  period: z.string(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

export const dteEventLinksAutoLinkAllPeriodsResponseSchema = z.object({
  details: z.array(
    z.object({
      daysProcessed: z.number(),
      linked: z.number(),
      period: z.string(),
      skipped: z.number(),
      totalEvents: z.number(),
    }),
  ),
  linked: z.number(),
  periodsProcessed: z.number(),
  skipped: z.number(),
  skippedByReason: z.array(
    z.object({
      count: z.number(),
      reason: z.string(),
    }),
  ),
  totalEvents: z.number(),
});

export const dteEventLinksAutoLinkAllPeriodsStartResponseSchema = z.object({
  jobId: z.string(),
  periodConcurrency: z.number(),
  totalPeriods: z.number(),
});

export const dteEventLinksContract = {
  byDay: oc
    .route({ method: "GET", path: "/by-day" })
    .input(dteEventLinksByDayInputSchema)
    .output(z.array(dteEventLinksByDayLinkSchema)),
  suggestions: oc
    .route({ method: "GET", path: "/suggestions" })
    .input(dteEventLinksSuggestionsInputSchema)
    .output(dteEventLinksSuggestionsResponseSchema),
  overview: oc
    .route({ method: "GET", path: "/overview" })
    .input(dteEventLinksOverviewInputSchema)
    .output(dteEventLinksOverviewResponseSchema),
  autoLinkJobStatus: oc
    .route({ method: "GET", path: "/jobs/{jobId}" })
    .input(dteEventLinksJobStatusInputSchema)
    .output(dteEventLinksJobStatusResponseSchema),
  confirmLink: oc
    .route({ method: "POST", path: "/confirm" })
    .input(dteEventLinksConfirmInputSchema)
    .output(dteEventLinksConfirmResponseSchema),
  unlinkLink: oc
    .route({ method: "POST", path: "/unlink" })
    .input(dteEventLinksUnlinkInputSchema)
    .output(dteEventLinksUnlinkResponseSchema),
  autoLinkDay: oc
    .route({ method: "POST", path: "/auto-link-day" })
    .input(dteEventLinksAutoLinkDayInputSchema)
    .output(dteEventLinksAutoLinkDayResponseSchema),
  autoLinkPeriod: oc
    .route({ method: "POST", path: "/auto-link-period" })
    .input(dteEventLinksAutoLinkPeriodInputSchema)
    .output(dteEventLinksAutoLinkPeriodResponseSchema),
  autoLinkAllPeriods: oc
    .route({ method: "POST", path: "/auto-link-all-periods" })
    .input(dteEventLinksAutoLinkAllPeriodsInputSchema)
    .output(dteEventLinksAutoLinkAllPeriodsResponseSchema),
  startAutoLinkAllPeriods: oc
    .route({ method: "POST", path: "/auto-link-all-periods/start" })
    .input(dteEventLinksAutoLinkAllPeriodsInputSchema)
    .output(dteEventLinksAutoLinkAllPeriodsStartResponseSchema),
};

export type DteEventLinksContract = typeof dteEventLinksContract;
