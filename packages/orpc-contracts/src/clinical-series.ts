import { oc } from "@orpc/contract";
import { z } from "zod";

export const clinicalSeriesKindSchema = z.enum([
  "PATCH_TEST",
  "SKIN_TEST",
  "SUBCUTANEOUS_TREATMENT",
  "MEDICAL_CONSULTATION",
]);
export const clinicalSeriesStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "CANCELLED",
]);
export const clinicalSeriesViewModeSchema = z.enum(["series", "abandonment"]);
export const clinicalSeriesAbandonmentBucketSchema = z.enum([
  "month_1",
  "month_2",
  "month_3",
  "month_4_plus",
]);
export const clinicalSeriesSortColumnSchema = z.enum([
  "daysSinceLastEvent",
  "financial",
  "kind",
  "lastEvent",
  "nextEvent",
  "patient",
  "status",
  "totalEvents",
  "upcomingEvents",
]);
export const clinicalSeriesSortDirectionSchema = z.enum(["ascending", "descending"]);

export const clinicalSeriesEventSchema = z.object({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  beneficiaryName: z.string().nullable(),
  beneficiaryRut: z.string().nullable(),
  calendarGoogleId: z.string(),
  description: z.string().nullable(),
  dosageUnit: z.string().nullable(),
  dosageValue: z.number().nullable(),
  eventDate: z.string(),
  eventTime: z.string().nullable(),
  eventId: z.number(),
  externalEventId: z.string(),
  linkedDocuments: z
    .array(
      z.object({
        dteSaleDetailId: z.string(),
        folio: z.string(),
        totalAmount: z.number(),
      })
    )
    .catch([]),
  linkedFolios: z.array(z.string()).catch([]),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable(),
  seriesStageLabel: z.string().nullable(),
  seriesStageNumber: z.number().nullable(),
  summary: z.string().nullable(),
});

export const clinicalSeriesLinkedDocumentSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  dteSaleDetailId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  totalAmount: z.number(),
});

export const clinicalSeriesSnapshotSchema = z.object({
  allergenType: z.enum(["ACAROS", "ACAROS_GRAMINEAS", "GRAMINEAS"]).nullable().catch(null),
  abandonmentBucket: clinicalSeriesAbandonmentBucketSchema.nullable().catch(null),
  daysSinceLastEvent: z.number().int().nullable(),
  deliveryModality: z.enum(["DOMICILIO", "PRESENCIAL"]).nullable().catch(null),
  beneficiaryName: z.string().nullable(),
  beneficiaryPhones: z.array(z.string()).catch([]),
  beneficiaryRut: z.string().nullable(),
  displayName: z.string().nullable(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
  events: z.array(clinicalSeriesEventSchema),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).nullable().catch(null),
  id: z.number(),
  isapreName: z.string().nullable().catch(null),
  kind: clinicalSeriesKindSchema,
  lastAbandonmentContact: z
    .object({
      contactedAt: z.string(),
      outcome: z.enum(["WILL_RETURN", "DECLINED", "UNREACHABLE", "RESCHEDULED", "OTHER"]),
    })
    .nullable()
    .catch(null),
  linkedDocuments: z.array(clinicalSeriesLinkedDocumentSchema),
  lastEventDate: z.string().nullable(),
  nextEventDate: z.string().nullable(),
  patientName: z.string().nullable(),
  patientPhones: z.array(z.string()).catch([]),
  patientRut: z.string().nullable(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  status: clinicalSeriesStatusSchema,
  totalExpected: z.number(),
  totalLinkedAmount: z.number(),
  totalPaid: z.number(),
  upcomingCount: z.number().int(),
  vaccineProduct: z
    .enum(["ALXOID", "CLUSTOID", "CLUSTOID_B120", "CLUSTOID_FORTE", "ORAL_TEC"])
    .nullable()
    .catch(null),
});

export const clinicalSeriesListInputSchema = z.object({
  abandonmentBucket: clinicalSeriesAbandonmentBucketSchema.optional(),
  beneficiaryRut: z.string().optional(),
  hasSkinTest: z.boolean().optional(),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).optional(),
  isapreOnlyUnidentified: z.boolean().optional(),
  isapreProvider: z.string().optional(),
  kind: clinicalSeriesKindSchema.optional(),
  lastVisitFrom: z.string().optional(),
  lastVisitTo: z.string().optional(),
  nextVisitFrom: z.string().optional(),
  nextVisitTo: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  patientPhone: z.string().optional(),
  query: z.string().optional(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  sortColumn: clinicalSeriesSortColumnSchema.optional(),
  sortDirection: clinicalSeriesSortDirectionSchema.optional(),
  status: clinicalSeriesStatusSchema.optional(),
  view: clinicalSeriesViewModeSchema.default("series").optional(),
});

export const clinicalSeriesListOutputSchema = z.object({
  items: z.array(clinicalSeriesSnapshotSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export const clinicalSeriesInsuranceStatsSchema = z.object({
  fonasa: z.number().int(),
  isapre: z.number().int(),
  isapreProviders: z.array(
    z.object({
      providerName: z.string(),
      total: z.number().int(),
    })
  ),
  isapreUnidentified: z.number().int(),
  particular: z.number().int(),
  total: z.number().int(),
  unidentified: z.number().int(),
});

export const clinicalSeriesDetailInputSchema = z.object({
  id: z.number().int().positive(),
});

export const clinicalSeriesRebuildInputSchema = z.object({
  autoMerge: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const clinicalSeriesRebuildResponseSchema = z.object({
  jobId: z.string(),
  message: z.string(),
});

export const clinicalSeriesDuplicateSchema = z.object({
  confidence: z.enum(["high", "medium"]),
  kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT", "MEDICAL_CONSULTATION"]),
  patientName: z.string().nullable(),
  reason: z.string(),
  sourceEventCount: z.number(),
  sourceId: z.number(),
  sourcePatientName: z.string().nullable(),
  sourcePatientRut: z.string().nullable(),
  targetEventCount: z.number(),
  targetId: z.number(),
});

export const clinicalSeriesDetectDuplicatesOutputSchema = z.object({
  duplicates: z.array(clinicalSeriesDuplicateSchema),
});

export const clinicalSeriesMergeInputSchema = z.object({
  mergeReason: z.string().optional(),
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});

export const clinicalSeriesMergeOutputSchema = z.object({
  eventsMovedCount: z.number(),
  targetId: z.number(),
});

// ── Abandonment Contacts ──────────────────────────────────────────────────────

export const abandonmentContactOutcomeSchema = z.enum([
  "WILL_RETURN",
  "DECLINED",
  "UNREACHABLE",
  "RESCHEDULED",
  "OTHER",
]);

export const abandonmentContactSchema = z.object({
  id: z.number(),
  seriesId: z.number(),
  outcome: abandonmentContactOutcomeSchema,
  notes: z.string().nullable(),
  contactedById: z.number(),
  contactedByName: z.string().nullable(),
  contactedAt: z.string(),
});

export const createAbandonmentContactInputSchema = z.object({
  seriesId: z.number().int().positive(),
  outcome: abandonmentContactOutcomeSchema,
  notes: z.string().max(500).optional(),
});

export const createAbandonmentContactOutputSchema = abandonmentContactSchema;

export const listAbandonmentContactsInputSchema = z.object({
  seriesId: z.number().int().positive(),
});

export const listAbandonmentContactsOutputSchema = z.object({
  contacts: z.array(abandonmentContactSchema),
});

export const clinicalSeriesContract = {
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(clinicalSeriesDetailInputSchema)
    .output(clinicalSeriesSnapshotSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(clinicalSeriesListInputSchema)
    .output(clinicalSeriesListOutputSchema),
  insuranceStats: oc
    .route({ method: "GET", path: "/stats/insurance" })
    .input(clinicalSeriesListInputSchema)
    .output(clinicalSeriesInsuranceStatsSchema),
  rebuild: oc
    .route({ method: "POST", path: "/rebuild" })
    .input(clinicalSeriesRebuildInputSchema)
    .output(clinicalSeriesRebuildResponseSchema),
  detectDuplicates: oc
    .route({ method: "GET", path: "/detect-duplicates" })
    .input(z.object({}))
    .output(clinicalSeriesDetectDuplicatesOutputSchema),
  merge: oc
    .route({ method: "POST", path: "/merge" })
    .input(clinicalSeriesMergeInputSchema)
    .output(clinicalSeriesMergeOutputSchema),
  createAbandonmentContact: oc
    .route({ method: "POST", path: "/abandonment-contacts" })
    .input(createAbandonmentContactInputSchema)
    .output(createAbandonmentContactOutputSchema),
  listAbandonmentContacts: oc
    .route({ method: "GET", path: "/abandonment-contacts" })
    .input(listAbandonmentContactsInputSchema)
    .output(listAbandonmentContactsOutputSchema),
};

export type ClinicalSeriesContract = typeof clinicalSeriesContract;
