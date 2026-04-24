/**
 * Clinical Series Types
 * Represents  grouped calendar events into treatment/test series
 */

import { z } from "zod";

export type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
export type ClinicalSeriesStatus = "PLANNED" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "CANCELLED";
export type AbandonmentContactOutcome =
  | "WILL_RETURN"
  | "DECLINED"
  | "UNREACHABLE"
  | "RESCHEDULED"
  | "OTHER";
export type ClinicalSeriesViewMode = "series" | "abandonment";
export type ClinicalSeriesAbandonmentBucket = "month_1" | "month_2" | "month_3" | "month_4_plus";
export type SubcutaneousAllergenType = "ACAROS" | "ACAROS_GRAMINEAS" | "GRAMINEAS";
export type SubcutaneousVaccineProduct =
  | "ALXOID"
  | "CLUSTOID"
  | "CLUSTOID_B120"
  | "CLUSTOID_FORTE"
  | "ORAL_TEC";
export type HealthInsuranceType = "FONASA" | "ISAPRE" | "PARTICULAR";
export type DeliveryModality = "DOMICILIO" | "PRESENCIAL";
export type ClinicalSeriesSortColumn =
  | "daysSinceLastEvent"
  | "financial"
  | "kind"
  | "lastEvent"
  | "nextEvent"
  | "patient"
  | "status"
  | "totalEvents"
  | "upcomingEvents";
export type ClinicalSeriesSortDirection = "ascending" | "descending";

export interface ClinicalSeriesEvent {
  amountExpected: number | null;
  amountPaid: number | null;
  beneficiaryName: string | null;
  beneficiaryRut: string | null;
  calendarGoogleId: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  eventId: number;
  externalEventId: string;
  linkedDocuments: Array<{
    dteSaleDetailId: string;
    folio: string;
    totalAmount: number;
  }>;
  linkedFolios: string[];
  patientName: string | null;
  patientRut: string | null;
  seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel: string | null;
  seriesStageNumber: number | null;
  summary: string | null;
  dosageValue: number | null;
  dosageUnit: string | null;
}

export interface ClinicalSeriesLinkedDocument {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
}

export interface LastAbandonmentContact {
  contactedAt: string;
  outcome: AbandonmentContactOutcome;
}

export interface ClinicalSeriesSnapshot {
  allergenType: SubcutaneousAllergenType | null;
  abandonmentBucket: ClinicalSeriesAbandonmentBucket | null;
  daysSinceLastEvent: number | null;
  vaccineProduct: SubcutaneousVaccineProduct | null;
  healthInsurance: HealthInsuranceType | null;
  isapreName: string | null;
  deliveryModality: DeliveryModality | null;
  beneficiaryName: string | null;
  beneficiaryPhones: string[];
  beneficiaryRut: string | null;
  id: number;
  kind: ClinicalSeriesKind;
  lastAbandonmentContact: LastAbandonmentContact | null;
  status: ClinicalSeriesStatus;
  displayName: string | null;
  patientName: string | null;
  patientRut: string | null;
  events: ClinicalSeriesEvent[];
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  lastEventDate: string | null;
  nextEventDate: string | null;
  totalExpected: number;
  totalPaid: number;
  totalLinkedAmount: number;
  remainingExpected: number;
  remainingPaid: number;
  eligibleDocumentDateFrom: string; // YYYY-MM-DD
  eligibleDocumentDateTo: string; // YYYY-MM-DD
  upcomingCount: number;
  patientPhones: string[];
}

export interface AbandonmentContact {
  id: number;
  seriesId: number;
  outcome: AbandonmentContactOutcome;
  notes: string | null;
  contactedById: number;
  contactedByName: string | null;
  contactedAt: string;
}

export interface ClinicalSeriesListItem {
  id: number;
  kind: ClinicalSeriesKind;
  status: ClinicalSeriesStatus;
  displayName: string | null;
  patientName: string | null;
  patientRut: string | null;
  eventCount: number;
  lastEventDate: string;
}

export interface ClinicalSeriesFilters {
  abandonmentBucket?: ClinicalSeriesAbandonmentBucket;
  beneficiaryRut?: string;
  hasSkinTest?: boolean;
  healthInsurance?: HealthInsuranceType;
  isapreOnlyUnidentified?: boolean;
  isapreProvider?: string;
  kind?: ClinicalSeriesKind;
  lastVisitFrom?: string;
  lastVisitTo?: string;
  nextVisitFrom?: string;
  nextVisitTo?: string;
  page?: number;
  pageSize?: number;
  patientPhone?: string;
  query?: string;
  patientName?: string;
  patientRut?: string;
  sortColumn?: ClinicalSeriesSortColumn;
  sortDirection?: ClinicalSeriesSortDirection;
  status?: ClinicalSeriesStatus;
  view?: ClinicalSeriesViewMode;
}

export interface ClinicalSeriesListResult {
  items: ClinicalSeriesSnapshot[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ClinicalSeriesInsuranceStats {
  fonasa: number;
  isapre: number;
  isapreProviders: Array<{ providerName: string; total: number }>;
  isapreUnidentified: number;
  particular: number;
  total: number;
  unidentified: number;
}

export interface RebuildSeriesParams {
  autoMerge?: boolean;
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface RebuildSeriesResult {
  jobId: string;
  message: string;
}

export interface RebuildJob {
  currentStep: string;
  error?: string;
  from: null | string;
  jobId: string;
  processed: number;
  progress: number; // 0-100
  status: "completed" | "failed" | "running";
  to: null | string;
  total: number;
}

// Zod Schemas for API responses
export const ClinicalSeriesEventSchema = z.object({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  beneficiaryName: z.string().nullable(),
  beneficiaryRut: z.string().nullable(),
  calendarGoogleId: z.string(),
  description: z.string().nullable().catch(null),
  eventDate: z.string(),
  eventTime: z.string().nullable().catch(null),
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
  dosageValue: z.number().nullable(),
  dosageUnit: z.string().nullable(),
});

export const ClinicalSeriesLinkedDocumentSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  dteSaleDetailId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  totalAmount: z.number(),
});

export const LastAbandonmentContactSchema = z
  .object({
    contactedAt: z.string(),
    outcome: z.enum(["WILL_RETURN", "DECLINED", "UNREACHABLE", "RESCHEDULED", "OTHER"]),
  })
  .nullable()
  .catch(null);

export const AbandonmentContactSchema = z.object({
  id: z.number(),
  seriesId: z.number(),
  outcome: z.enum(["WILL_RETURN", "DECLINED", "UNREACHABLE", "RESCHEDULED", "OTHER"]),
  notes: z.string().nullable(),
  contactedById: z.number(),
  contactedByName: z.string().nullable(),
  contactedAt: z.string(),
});

export const ClinicalSeriesSnapshotSchema = z.object({
  allergenType: z.enum(["ACAROS", "ACAROS_GRAMINEAS", "GRAMINEAS"]).nullable().catch(null),
  abandonmentBucket: z
    .enum(["month_1", "month_2", "month_3", "month_4_plus"])
    .nullable()
    .catch(null),
  daysSinceLastEvent: z.number().int().nullable(),
  vaccineProduct: z
    .enum(["ALXOID", "CLUSTOID", "CLUSTOID_B120", "CLUSTOID_FORTE", "ORAL_TEC"])
    .nullable()
    .catch(null),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).nullable().catch(null),
  isapreName: z.string().nullable().catch(null),
  deliveryModality: z.enum(["DOMICILIO", "PRESENCIAL"]).nullable().catch(null),
  beneficiaryName: z.string().nullable(),
  beneficiaryPhones: z.array(z.string()).catch([]),
  beneficiaryRut: z.string().nullable(),
  id: z.number(),
  kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]),
  lastAbandonmentContact: LastAbandonmentContactSchema,
  status: z.enum(["PLANNED", "ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"]),
  displayName: z.string().nullable(),
  patientName: z.string().nullable(),
  patientPhones: z.array(z.string()).catch([]),
  patientRut: z.string().nullable(),
  events: z.array(ClinicalSeriesEventSchema),
  linkedDocuments: z.array(ClinicalSeriesLinkedDocumentSchema),
  lastEventDate: z.string().nullable(),
  nextEventDate: z.string().nullable(),
  totalExpected: z.number(),
  totalPaid: z.number(),
  totalLinkedAmount: z.number(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
  upcomingCount: z.number().int(),
});

export const RebuildSeriesResultSchema = z.object({
  jobId: z.string(),
  message: z.string(),
});

export const ClinicalSeriesInsuranceStatsSchema = z.object({
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

export interface ClinicalSeriesDuplicate {
  confidence: "high" | "medium";
  kind: ClinicalSeriesKind;
  patientName: string | null;
  reason: string;
  sourceEventCount: number;
  sourceId: number;
  sourcePatientName: string | null;
  sourcePatientRut: string | null;
  targetEventCount: number;
  targetId: number;
}

export interface MergeClinicalSeriesParams {
  mergeReason?: string;
  sourceId: number;
  targetId: number;
}

export interface MergeClinicalSeriesResult {
  eventsMovedCount: number;
  targetId: number;
}

export const ClinicalSeriesDuplicateSchema = z.object({
  confidence: z.enum(["high", "medium"]),
  kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]),
  patientName: z.string().nullable(),
  reason: z.string(),
  sourceEventCount: z.number(),
  sourceId: z.number(),
  sourcePatientName: z.string().nullable(),
  sourcePatientRut: z.string().nullable(),
  targetEventCount: z.number(),
  targetId: z.number(),
});

export const DetectDuplicatesResultSchema = z.object({
  duplicates: z.array(ClinicalSeriesDuplicateSchema),
});

export const MergeClinicalSeriesResultSchema = z.object({
  eventsMovedCount: z.number(),
  targetId: z.number(),
});
