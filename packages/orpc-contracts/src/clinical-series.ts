import { oc } from "@orpc/contract";
import { z } from "zod";

export const clinicalSeriesKindSchema = z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]);
export const clinicalSeriesStatusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);
export const clinicalSeriesSortColumnSchema = z.enum([
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
  dosageUnit: z.string().nullable(),
  dosageValue: z.number().nullable(),
  eventDate: z.string(),
  eventId: z.number(),
  externalEventId: z.string(),
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
  beneficiaryName: z.string().nullable(),
  beneficiaryRut: z.string().nullable(),
  displayName: z.string().nullable(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
  events: z.array(clinicalSeriesEventSchema),
  id: z.number(),
  kind: clinicalSeriesKindSchema,
  linkedDocuments: z.array(clinicalSeriesLinkedDocumentSchema),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  status: clinicalSeriesStatusSchema,
  totalExpected: z.number(),
  totalLinkedAmount: z.number(),
  totalPaid: z.number(),
});

export const clinicalSeriesListInputSchema = z.object({
  beneficiaryRut: z.string().optional(),
  kind: clinicalSeriesKindSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  sortColumn: clinicalSeriesSortColumnSchema.optional(),
  sortDirection: clinicalSeriesSortDirectionSchema.optional(),
  status: clinicalSeriesStatusSchema.optional(),
});

export const clinicalSeriesListOutputSchema = z.object({
  items: z.array(clinicalSeriesSnapshotSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export const clinicalSeriesDetailInputSchema = z.object({
  id: z.number().int().positive(),
});

export const clinicalSeriesRebuildInputSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const clinicalSeriesRebuildResponseSchema = z.object({
  jobId: z.string(),
  message: z.string(),
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
  rebuild: oc
    .route({ method: "POST", path: "/rebuild" })
    .input(clinicalSeriesRebuildInputSchema)
    .output(clinicalSeriesRebuildResponseSchema),
};

export type ClinicalSeriesContract = typeof clinicalSeriesContract;
