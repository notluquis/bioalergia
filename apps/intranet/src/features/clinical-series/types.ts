/**
 * Clinical Series Types
 * Represents  grouped calendar events into treatment/test series
 */

import { z } from "zod";

export type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
export type ClinicalSeriesStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface ClinicalSeriesEvent {
  amountExpected: number | null;
  amountPaid: number | null;
  calendarGoogleId: string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
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
  kind?: ClinicalSeriesKind;
  status?: ClinicalSeriesStatus;
  patientName?: string;
  patientRut?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RebuildSeriesParams {
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface RebuildSeriesResult {
  processed: number;
  from: string;
  to: string;
}

// Zod Schemas for API responses
export const ClinicalSeriesEventSchema = z.object({
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
  processed: z.number(),
  from: z.string(),
  to: z.string(),
});
