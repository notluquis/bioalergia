import { z } from "zod";

export const calendarSearchSchema = z.object({
  beneficiaryRut: z.string().optional().catch(undefined),
  clinicalSeriesId: z.coerce.number().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  date: z.string().optional().catch(undefined),
  patientName: z.string().optional().catch(undefined),
  patientRut: z.string().optional().catch(undefined),
  source: z.enum(["doctoralia", "google"]).optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  seriesKind: z
    .enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"])
    .optional()
    .catch(undefined),
  seriesStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional().catch(undefined),
  maxDays: z.coerce.number().optional().catch(undefined),
  calendarId: z.array(z.string()).optional().catch(undefined),
  category: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) {
        return undefined;
      }
      const values = Array.isArray(val) ? val : [val];
      const normalized = values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry !== "[]");
      return normalized.length > 0 ? normalized : undefined;
    })
    .catch(undefined),
  page: z.coerce.number().optional().catch(undefined),
});

export type CalendarSearchParams = z.infer<typeof calendarSearchSchema>;

export interface CalendarAggregateByDate {
  amountExpected: number;
  amountPaid: number;
  date: string;
  total: number;
}

export interface CalendarAggregateByMonth {
  amountExpected: number;
  amountPaid: number;
  month: number;
  total: number;
  year: number;
}

export interface CalendarAggregateByWeek {
  amountExpected: number;
  amountPaid: number;
  isoWeek: number;
  isoYear: number;
  total: number;
}

export interface CalendarAggregateByWeekday {
  amountExpected: number;
  amountPaid: number;
  total: number;
  weekday: number;
}

export interface CalendarAggregateByYear {
  amountExpected: number;
  amountPaid: number;
  total: number;
  year: number;
}

export interface CalendarAggregateByDateType {
  date: string;
  eventType: null | string;
  total: number;
}

export interface CalendarDaily {
  days: CalendarDayEvents[];
  filters: {
    beneficiaryRut?: string;
    calendarIds: string[];
    categories: string[];
    clinicalSeriesId?: number;
    eventTypes?: string[];
    from: string;
    maxDays: number;
    patientName?: string;
    patientRut?: string;
    search?: string;
    seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
    seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED";
    to: string;
  };
  totals: {
    amountExpected: number;
    amountPaid: number;
    days: number;
    events: number;
  };
}

export interface CalendarData {
  createdAt: Date;
  eventCount: number;
  googleId: string;
  id: number;
  name: string;
  updatedAt: Date;
}

export interface CalendarDayEvents {
  amountExpected: number;
  amountPaid: number;
  date: Date;
  events: CalendarEventDetail[];
  total: number;
}

export interface CalendarEventClassificationPayload {
  amountExpected?: null | number;
  amountPaid?: null | number;
  attended?: boolean | null;
  calendarId: string;
  category?: null | string;
  clinicalSeriesId?: null | number;
  controlIncluded?: boolean | null;
  dosageValue?: null | number;
  dosageUnit?: null | string;
  eventId: string;
  seriesStageKind?: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel?: null | string;
  seriesStageNumber?: null | number;
  testMetadata?: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  treatmentStage?: null | string;
}

export interface CalendarEventDetail {
  amountExpected?: null | number;
  amountPaid?: null | number;
  attended?: boolean | null;
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  calendarId: string;
  category?: null | string;
  clinicalSeriesId?: null | number;
  colorId: null | string;
  controlIncluded?: boolean | null;
  description: null | string;
  dosageValue?: null | number;
  dosageUnit?: null | string;
  seriesStageKind?: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel?: null | string;
  seriesStageNumber?: null | number;
  endDate: null | string;
  endDateTime: null | string;
  endTimeZone: null | string;
  eventCreatedAt: null | string;
  eventDate: string;
  eventDateTime: null | string;
  eventId: string;
  eventType: null | string;
  eventUpdatedAt: null | string;
  hangoutLink: null | string;
  isDomicilio?: boolean | null;
  location: null | string;
  patientName?: null | string;
  patientRut?: null | string;
  rawEvent: unknown;
  startDate: null | string;
  startDateTime: null | string;
  startTimeZone: null | string;
  status: null | string;
  summary: null | string;
  testMetadata?: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  transparency: null | string;
  treatmentStage?: null | string;
  visibility: null | string;
}

export interface EventDteSuggestion {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  documentType: number;
  dteSaleDetailId: string;
  exemptAmount: number;
  folio: string;
  ivaAmount: number;
  linkedEventsCount: number;
  method: "mixed" | "name_exact" | "name_fuzzy" | "rut";
  netAmount: number;
  reasons: string[];
  totalAmount: number;
}

export interface EventDteMatchSignal {
  code: string;
  label: string;
  value?: null | string;
  weight: number;
}

export interface EventDteIdentityClaims {
  amountHint: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  eventDate: string;
  nameClaims: string[];
  patientName: null | string;
  patientRut: null | string;
  rutClaims: string[];
  sameDayOnly: boolean;
  seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
}

export interface EventDteCandidateSetSummary {
  consideredCount: number;
  fallbackCount: number;
  retrievedCount: number;
  sameDayCount: number;
}

export interface EventDteCrossSeriesConflict {
  patientName: null | string;
  patientRut: null | string;
  seriesId: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
}

export interface EventDteMatchHypothesis {
  amountDiff: null | number;
  autoLinkEligible: boolean;
  clientName: string;
  clientRUT: string;
  crossSeriesConflicts: EventDteCrossSeriesConflict[];
  documentDate: string;
  documents: EventDteSuggestion[];
  dteSaleDetailIds: string[];
  folios: string[];
  hypothesisId: string;
  kind: "bundle" | "single";
  method: "mixed" | "name_exact" | "name_fuzzy" | "rut";
  policyKey: "default_same_day" | "same_day_unlinked_fallback" | "skin_test_bundle";
  reasons: string[];
  score: number;
  signals: EventDteMatchSignal[];
  totalAmount: number;
}

export interface EventDteSuggestionResponse {
  candidateSetSummary: EventDteCandidateSetSummary;
  event: null | {
    amountExpected: null | number;
    amountPaid: null | number;
    calendarId: string;
    description: null | string;
    eventDate: string;
    eventId: string;
    summary: null | string;
  };
  fallbackCandidates: EventDteSuggestion[];
  hypotheses: EventDteMatchHypothesis[];
  identityClaims: EventDteIdentityClaims | null;
  linked: unknown;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  series: ClinicalSeriesSnapshot | null;
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

export interface ClinicalSeriesEvent {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarGoogleId: string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  seriesStageKind: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
}

export interface ClinicalSeriesSnapshot {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  displayName: null | string;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEvent[];
  id: number;
  kind: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  patientName: null | string;
  patientRut: null | string;
  remainingExpected: number;
  remainingPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  totalExpected: number;
  totalLinkedAmount: number;
  totalPaid: number;
}

export interface EventDteConfirmedLink {
  calendarId: string;
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  dteSaleDetailId: string;
  eventId: string;
  folio: string;
  matchedBy: string;
  status: string;
  totalAmount: number;
}

export interface CalendarFilters {
  beneficiaryRut?: string;
  calendarIds?: string[];
  categories: string[];
  clinicalSeriesId?: number;
  eventTypes?: string[];
  from: string;
  maxDays: number;
  patientName?: string;
  patientRut?: string;
  search?: string;
  seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED";
  to: string;
}

export interface CalendarSummary {
  aggregates: {
    byDate: CalendarAggregateByDate[];
    byDateType: CalendarAggregateByDateType[];
    byMonth: CalendarAggregateByMonth[];
    byWeek: CalendarAggregateByWeek[];
    byWeekday: CalendarAggregateByWeekday[];
    byYear: CalendarAggregateByYear[];
  };
  available: {
    calendars: { calendarId: string; total: number }[];
    categories: { category: null | string; total: number }[];
  };
  filters: {
    beneficiaryRut?: string;
    calendarIds: string[];
    categories: string[];
    clinicalSeriesId?: number;
    eventTypes?: string[];
    from: string;
    patientName?: string;
    patientRut?: string;
    search?: string;
    seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
    seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED";
    to: string;
  };
  totals: {
    amountExpected: number;
    amountPaid: number;
    days: number;
    events: number;
    maxEventCount?: number;
  };
}

export interface CalendarSyncLog {
  changeDetails?: null | {
    excluded?: string[];
    inserted?: string[];
    updated?: (string | { changes: string[]; summary: string })[];
  };
  logEntries?: Array<{
    attributes?: null | Record<string, unknown>;
    message: null | string;
    severity: string;
    tags?: null | Record<string, unknown>;
    timestamp: Date;
  }>;
  errorMessage: null | string;
  excluded: number;
  fetchedAt?: Date | null;
  finishedAt?: Date | null;
  id: number;
  inserted: number;
  skipped: number;
  startedAt: Date | null;
  status: "ERROR" | "RUNNING" | "SUCCESS";
  triggerLabel: null | string;
  triggerSource: string;
  triggerUserId: null | number;
  updated: number;
}

export interface CalendarSyncStep {
  details: Record<string, unknown>;
  durationMs: number;
  id: "exclude" | "fetch" | "snapshot" | "upsert";
  label: string;
}

export interface CalendarUnclassifiedEvent {
  amountExpected: null | number;
  amountPaid: null | number;
  attended: boolean | null;
  calendarId: string;
  category: null | string;
  clinicalSeriesId?: null | number;
  description: null | string;
  dosageValue: null | number;
  dosageUnit: null | string;
  seriesStageKind?: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel?: null | string;
  seriesStageNumber?: null | number;
  endDate: null | string;
  endDateTime: null | string;
  eventId: string;
  eventType: null | string;
  startDate: null | string;
  startDateTime: null | string;
  status: null | string;
  summary: null | string;
  testMetadata: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  treatmentStage: null | string;
}

export interface ClassificationFormValues {
  amountExpected: string;
  amountPaid: string;
  attended: boolean;
  category: string;
  clinicalSeriesId?: null | number;
  dosageValue: string;
  dosageUnit: string;
  seriesStageKind?: null | "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
  seriesStageLabel?: null | string;
  seriesStageNumber?: null | number;
  testPatchFirstReading: boolean;
  testPatchSecondReading: boolean;
  testPatchThirdReading: boolean;
  testSubtypePatch: boolean;
  testSubtypeSkin: boolean;
  treatmentStage: string;
}

export const calendarClassificationSchema = z.object({
  amountExpected: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }
      const parsed = Number.parseInt(value.replaceAll(/\D/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
  amountPaid: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }
      const parsed = Number.parseInt(value.replaceAll(/\D/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
  attended: z.boolean().optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  dosageValue: z.coerce.number().optional().nullable(),
  dosageUnit: z.string().max(20).optional().nullable(),
  treatmentStage: z.string().max(64).optional().nullable(),
});

export interface TreatmentAnalyticsFilters {
  beneficiaryRut?: string;
  calendarIds?: string[];
  clinicalSeriesId?: number;
  from?: string;
  patientRut?: string;
  seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED";
  to?: string;
}

export interface TreatmentAnalyticsPeriodData {
  amountExpected: number;
  amountPaid: number;
  domicilioCount: number;
  dosageMl: number;
  events: number;
  induccionCount: number;
  mantencionCount: number;
}

export interface TreatmentAnalyticsByDate extends TreatmentAnalyticsPeriodData {
  date: string;
}

export interface TreatmentAnalyticsByWeek extends TreatmentAnalyticsPeriodData {
  isoWeek: number;
  isoYear: number;
}

export interface TreatmentAnalyticsByMonth extends TreatmentAnalyticsPeriodData {
  month: number;
  year: number;
}

export interface TreatmentAnalytics {
  byDate?: TreatmentAnalyticsByDate[];
  byMonth?: TreatmentAnalyticsByMonth[];
  byWeek?: TreatmentAnalyticsByWeek[];
  totals: TreatmentAnalyticsPeriodData;
}

// Classification UI types
export type ClassifySearchParams = {
  calendarId?: string[];
  filterMode?: "AND" | "OR";
  missing?: string[];
  page?: number;
};

export type OnNavigate = (
  updater: (prev: ClassifySearchParams) => Partial<ClassifySearchParams>
) => void;

export interface ReclassifyJob {
  message: string;
  progress: number;
  total: number;
}

export interface EventDteOverviewAutoLinkSkip {
  attemptedAt: string;
  reason: string;
}

export interface EventDteOverviewItem {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarId: string;
  clinicalSeriesId: null | number;
  confidenceScore: null | number;
  displayName: null | string;
  eventDate: string;
  eventTime: null | string;
  eventId: string;
  lastAutoLinkSkip: EventDteOverviewAutoLinkSkip | null;
  linkStatus: "linked" | "pending_issuance" | "unlinked";
  linked: boolean;
  linkedClientName: null | string;
  linkedClientRUT: null | string;
  linkedDocuments: Array<{
    clientName: string;
    clientRUT: string;
    confidenceScore: number;
    dteSaleDetailId: string;
    folio: string;
    matchedBy: string;
    totalAmount: number;
  }>;
  linkedDteSaleDetailId: null | string;
  linkedFolio: null | string;
  linkedMatchedBy: null | string;
  linkedTotalAmount: null | number;
  seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  summary: null | string;
  topHypothesis: EventDteMatchHypothesis | null;
}

export interface EventDteOverviewStats {
  avgLinkedScore: number;
  dueEvents: number;
  linkRate: number;
  linkedEvents: number;
  pendingIssuanceEvents: number;
  totalEvents: number;
  unlinkedEvents: number;
  withPerfectScore: number;
}

export interface EventDteOverviewResponseData {
  items: EventDteOverviewItem[];
  page: number;
  pageSize: number;
  period: string;
  stats: EventDteOverviewStats;
  totalCount: number;
  totalPages: number;
}
