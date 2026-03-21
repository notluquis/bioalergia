/**
 * Clinical Series Types
 * Represents  grouped calendar events into treatment/test series
 */

import { z } from "zod";

export type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
export type ClinicalSeriesStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
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
  eventDate: string;
  eventId: number;
  externalEventId: string;
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

export interface ClinicalSeriesSnapshot {
  allergenType: SubcutaneousAllergenType | null;
  vaccineProduct: SubcutaneousVaccineProduct | null;
  healthInsurance: HealthInsuranceType | null;
  deliveryModality: DeliveryModality | null;
  beneficiaryName: string | null;
  beneficiaryRut: string | null;
  id: number;
  kind: ClinicalSeriesKind;
  status: ClinicalSeriesStatus;
  displayName: string | null;
  patientName: string | null;
  patientRut: string | null;
  events: ClinicalSeriesEvent[];
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  totalExpected: number;
  totalPaid: number;
  totalLinkedAmount: number;
  remainingExpected: number;
  remainingPaid: number;
  eligibleDocumentDateFrom: string; // YYYY-MM-DD
  eligibleDocumentDateTo: string; // YYYY-MM-DD
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
  beneficiaryRut?: string;
  kind?: ClinicalSeriesKind;
  page?: number;
  pageSize?: number;
  patientName?: string;
  patientRut?: string;
  sortColumn?: ClinicalSeriesSortColumn;
  sortDirection?: ClinicalSeriesSortDirection;
  status?: ClinicalSeriesStatus;
}

export interface ClinicalSeriesListResult {
  items: ClinicalSeriesSnapshot[];
  page: number;
  pageSize: number;
  total: number;
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
  eventDate: z.string(),
  eventId: z.number(),
  externalEventId: z.string(),
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

export const ClinicalSeriesSnapshotSchema = z.object({
  allergenType: z.enum(["ACAROS", "ACAROS_GRAMINEAS", "GRAMINEAS"]).nullable().catch(null),
  vaccineProduct: z
    .enum(["ALXOID", "CLUSTOID", "CLUSTOID_B120", "CLUSTOID_FORTE", "ORAL_TEC"])
    .nullable()
    .catch(null),
  healthInsurance: z.enum(["FONASA", "ISAPRE", "PARTICULAR"]).nullable().catch(null),
  deliveryModality: z.enum(["DOMICILIO", "PRESENCIAL"]).nullable().catch(null),
  beneficiaryName: z.string().nullable(),
  beneficiaryRut: z.string().nullable(),
  id: z.number(),
  kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
  displayName: z.string().nullable(),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  events: z.array(ClinicalSeriesEventSchema),
  linkedDocuments: z.array(ClinicalSeriesLinkedDocumentSchema),
  totalExpected: z.number(),
  totalPaid: z.number(),
  totalLinkedAmount: z.number(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
});

export const RebuildSeriesResultSchema = z.object({
  jobId: z.string(),
  message: z.string(),
});

export interface ClinicalSeriesDuplicate {
  confidence: "high" | "medium";
  reason: string;
  sourceId: number;
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
  reason: z.string(),
  sourceId: z.number(),
  targetId: z.number(),
});

export const DetectDuplicatesResultSchema = z.object({
  duplicates: z.array(ClinicalSeriesDuplicateSchema),
});

export const MergeClinicalSeriesResultSchema = z.object({
  eventsMovedCount: z.number(),
  targetId: z.number(),
});
