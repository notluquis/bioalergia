/**
 * Clinical Series Types
 * Represents  grouped calendar events into treatment/test series
 */

import { z } from "zod";

export type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
export type ClinicalSeriesStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface ClinicalSeriesEvent {
  id: number;
  summary: string;
  description: string | null;
  startDate: string; // ISO date
  endDate: string; // ISO date
  stage: string | null;
  dosageValue: number | null;
  dosageUnit: string | null;
  note: string | null;
}

export interface ClinicalSeriesLinkedDocument {
  id: number;
  type: string;
  reference: string;
  amount: number;
  date: string; // ISO date
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
  id: z.number(),
  summary: z.string(),
  description: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  stage: z.string().nullable(),
  dosageValue: z.number().nullable(),
  dosageUnit: z.string().nullable(),
  note: z.string().nullable(),
});

export const ClinicalSeriesLinkedDocumentSchema = z.object({
  id: z.number(),
  type: z.string(),
  reference: z.string(),
  amount: z.number(),
  date: z.string(),
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
