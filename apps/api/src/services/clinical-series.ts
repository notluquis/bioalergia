import { db, kysely } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { sql } from "kysely";
import jaroWinkler from "talisman/metrics/jaro-winkler.js";
import { joinClinicalText, normalizeClinicalText } from "../lib/clinical-text.ts";
import { parseCalendarMetadata } from "../lib/parsers.ts";
import { normalizeRut, validateRut } from "../lib/rut.ts";
import {
  clearRebuildJobAfter,
  patchRebuildJob,
  setRebuildJob,
} from "./clinical-series-rebuild-status.ts";
import {
  AGE_REGEX,
  FORMATTED_RUT_REGEX,
  LONG_NUMBER_REGEX,
  LOWERCASE_NAME_STOPWORDS,
  RUT_REGEX,
  SEPARATOR_REGEX,
  STANDALONE_NUMBER_REGEX,
  TIMEZONE,
  TIME_REGEX,
} from "./clinical-series/constants.ts";
import {
  inferAllergenType,
  inferVaccineProduct,
} from "./clinical-series/classification/allergens.ts";
import { inferDeliveryModality } from "./clinical-series/classification/delivery.ts";
import {
  buildSeriesDisplayName,
  computeExpectedSessions,
} from "./clinical-series/classification/display.ts";
import { inferHealthInsurance } from "./clinical-series/classification/insurance.ts";
import {
  getSeriesWindowDays,
  inferSeriesKind,
} from "./clinical-series/classification/kind.ts";
import {
  collapseRepeatedNameEdges,
  getSignificantNameTokens,
  normalizeName,
  normalizeNameToken,
  stripNoiseFromText,
  stripNonNamePhrases,
  stripStopwordPrefix,
} from "./clinical-series/normalization/names.ts";
import {
  extractPhoneCandidates,
  normalizeExtractedPhone,
  normalizeExtractedPhoneDigits,
  normalizePhoneSearch,
  normalizeStoredPhoneArray,
} from "./clinical-series/normalization/phones.ts";
import { isCloseNormalizedRut, sanitizeRut } from "./clinical-series/normalization/rut.ts";
import type { ClinicalIdentity, StoredClinicalIdentity } from "./clinical-series/types.ts";
import {
  extractIdentityHints,
  extractPatientHints,
  hasIdentitySourceText,
  resolveClinicalIdentity,
} from "./clinical-series/extraction/identity.ts";
import {
  extractNamesFromCleanedText,
  extractNamesFromText,
  extractRutAdjacentNames,
  isAcceptedRutCandidate,
  isExplicitRutContext,
} from "./clinical-series/extraction/names.ts";
import { extractSeriesPhones, getSeriesPatientPhones } from "./clinical-series/extraction/phones.ts";
import {
  cleanStructuredFieldValue,
  extractStructuredClinicalDescription,
  normalizeIdentitySourceText,
  stripStructuredNoiseForNames,
  trimBoletaBlock,
} from "./clinical-series/extraction/structured.ts";
import {
  loadEventSeriesCandidateByExternalIds,
  loadEventSeriesCandidateByInternalId,
  loadEventSeriesCandidatesByIds,
} from "./clinical-series/matching/candidates.ts";
import {
  chooseBetterSeriesCandidate,
  chooseCanonicalPhoneDuplicateCandidate,
  compareRepresentativeIdentity,
  compareSeriesCanonicalPriority,
  hasConflictingPrimaryIdentity,
  hasHardPatientRutConflictForDuplicateDetection,
  haveCompatiblePatientNames,
  scoreClinicalSeriesIdentityQuality,
  scoreRepresentativeIdentity,
  shouldPreferCandidateOverRutMatch,
} from "./clinical-series/matching/compare.ts";
import {
  chooseDominantIdentityName,
  incrementIdentityNameCount,
  isAllLowercase,
  isSingleLetterPrefixedVariant,
} from "./clinical-series/identity-naming/dominant.ts";
import {
  buildIdentityGroupKey,
  choosePreferredIdentityName,
} from "./clinical-series/identity-naming/group-key.ts";
import {
  selectRepresentativeClinicalIdentity,
  shouldPromoteBeneficiaryToPatientIdentity,
} from "./clinical-series/identity-naming/representative.ts";
import { upgradePatientNameFromDte } from "./clinical-series/identity-naming/upgrade.ts";
import {
  SeriesAssignmentContext,
  type SeriesEntry,
} from "./clinical-series/context.ts";
import { findMatchingSeries } from "./clinical-series/matching/find.ts";
import { refreshClinicalSeriesMetadata } from "./clinical-series/metadata.ts";
import {
  syncClinicalSeriesForEventIds,
  syncClinicalSeriesForExternalEvents,
  syncClinicalSeriesForInternalEventId,
} from "./clinical-series/assignment/sync.ts";
import { assignEventToSeries } from "./clinical-series/assignment/assign-event.ts";
import { runConcurrent } from "./clinical-series/assignment/concurrent.ts";
import { updateAllSeriesStatuses } from "./clinical-series/status.ts";
import {
  rebuildClinicalSeries,
  startRebuildClinicalSeries,
} from "./clinical-series/rebuild.ts";
import { detectDuplicateSeries } from "./clinical-series/duplicates/detect.ts";
import { mergeClinicalSeries } from "./clinical-series/duplicates/merge.ts";
import {
  createAbandonmentContact,
  listAbandonmentContacts,
} from "./clinical-series/abandonment.ts";
export {
  findMatchingSeries,
  syncClinicalSeriesForInternalEventId,
  syncClinicalSeriesForEventIds,
  syncClinicalSeriesForExternalEvents,
  updateAllSeriesStatuses,
  rebuildClinicalSeries,
  startRebuildClinicalSeries,
  detectDuplicateSeries,
  mergeClinicalSeries,
  createAbandonmentContact,
  listAbandonmentContacts,
};
// Public re-exports for back-compat.
export {
  selectRepresentativeClinicalIdentity,
  shouldPromoteBeneficiaryToPatientIdentity,
};
export type { RebuildJob } from "./clinical-series-rebuild-status.ts";
export { getCurrentRebuildJob } from "./clinical-series-rebuild-status.ts";
// Public re-exports for back-compat with external consumers.
export { extractPatientHints, extractIdentityHints, resolveClinicalIdentity };

dayjs.extend(utc);
dayjs.extend(timezone);

type ClinicalSeriesKind =
  | "PATCH_TEST"
  | "SKIN_TEST"
  | "SUBCUTANEOUS_TREATMENT"
  | "MEDICAL_CONSULTATION";
type ClinicalSeriesStageKind = "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";
type SubcutaneousAllergenType = "ACAROS" | "ACAROS_GRAMINEAS" | "GRAMINEAS";
type SubcutaneousVaccineProduct =
  | "ALXOID"
  | "CLUSTOID"
  | "CLUSTOID_B120"
  | "CLUSTOID_FORTE"
  | "ORAL_TEC";
type HealthInsuranceType = "FONASA" | "ISAPRE" | "PARTICULAR";
type DeliveryModality = "DOMICILIO" | "PRESENCIAL";

type EventSeriesCandidate = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  category: null | string;
  clinicalSeriesId: null | number;
  description: null | string;
  eventDate: string;
  eventTime: null | string;
  eventId: number;
  externalEventId: string;
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
  testMetadata: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  treatmentStage: null | string;
};

type ClinicalSeriesEventSnapshot = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  description: null | string;
  dosageUnit: null | string;
  dosageValue: null | number;
  eventDate: string;
  eventTime: null | string;
  eventId: number;
  externalEventId: string;
  linkedDocuments: Array<{
    dteSaleDetailId: string;
    folio: string;
    totalAmount: number;
  }>;
  linkedFolios: string[];
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
};

type ClinicalSeriesLinkedDocument = {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
};

export interface ClinicalSeriesSnapshot {
  allergenType: null | SubcutaneousAllergenType;
  abandonmentBucket: null | "month_1" | "month_2" | "month_3" | "month_4_plus";
  daysSinceLastEvent: null | number;
  vaccineProduct: null | SubcutaneousVaccineProduct;
  healthInsurance: null | HealthInsuranceType;
  isapreName: null | string;
  deliveryModality: null | DeliveryModality;
  beneficiaryName: null | string;
  beneficiaryPhones: string[];
  beneficiaryRut: null | string;
  displayName: null | string;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEventSnapshot[];
  id: number;
  kind: ClinicalSeriesKind;
  lastAbandonmentContact: null | {
    contactedAt: string;
    outcome: "WILL_RETURN" | "DECLINED" | "UNREACHABLE" | "RESCHEDULED" | "OTHER";
  };
  lastEventDate: null | string;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  nextEventDate: null | string;
  patientName: null | string;
  patientPhones: string[];
  patientRut: null | string;
  remainingExpected: number;
  remainingPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
  totalExpected: number;
  totalLinkedAmount: number;
  totalPaid: number;
  upcomingCount: number;
}

function isPastOrTodayEvent(eventDate: string, today: string) {
  return eventDate <= today;
}

function computeSnapshotTiming(snapshot: Pick<ClinicalSeriesSnapshot, "events">, today: string) {
  const past = snapshot.events.filter((event) => event.eventDate <= today);
  const future = snapshot.events.filter((event) => event.eventDate > today);

  const lastEventDate = past.length
    ? past.reduce(
        (acc, event) => (event.eventDate > acc ? event.eventDate : acc),
        past[0]!.eventDate
      )
    : null;
  const nextEventDate = future.length
    ? future.reduce(
        (acc, event) => (event.eventDate < acc ? event.eventDate : acc),
        future[0]!.eventDate
      )
    : null;
  const upcomingCount = future.length;
  const daysSinceLastEvent = lastEventDate
    ? dayjs(today, "YYYY-MM-DD").diff(dayjs(lastEventDate, "YYYY-MM-DD"), "day")
    : null;

  return {
    abandonmentBucket: resolveAbandonmentBucket(daysSinceLastEvent),
    daysSinceLastEvent,
    lastEventDate,
    nextEventDate,
    upcomingCount,
  };
}

type ClinicalSeriesFilters = {
  abandonmentBucket?: "month_1" | "month_2" | "month_3" | "month_4_plus";
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
  sortColumn?:
    | "daysSinceLastEvent"
    | "financial"
    | "kind"
    | "lastEvent"
    | "nextEvent"
    | "patient"
    | "status"
    | "totalEvents"
    | "upcomingEvents";
  sortDirection?: "ascending" | "descending";
  status?: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
  view?: "abandonment" | "series";
};

export type ClinicalSeriesInsuranceStats = {
  fonasa: number;
  isapre: number;
  isapreProviders: Array<{ providerName: string; total: number }>;
  isapreUnidentified: number;
  particular: number;
  total: number;
  unidentified: number;
};

function resolveAbandonmentBucket(daysSinceLastEvent: null | number) {
  if (daysSinceLastEvent == null || daysSinceLastEvent < 30) return null;
  if (daysSinceLastEvent < 60) return "month_1" as const;
  if (daysSinceLastEvent < 90) return "month_2" as const;
  if (daysSinceLastEvent < 120) return "month_3" as const;
  return "month_4_plus" as const;
}

type PreparedClinicalSeriesFilters = {
  abandonmentFilterSql: ReturnType<typeof sql>;
  effectiveKind: ClinicalSeriesKind | null;
  effectiveHealthInsurance: HealthInsuranceType | null;
  effectiveStatus: ClinicalSeriesFilters["status"] | null;
  isapreFilterSql: ReturnType<typeof sql>;
  lastVisitFrom: null | string;
  lastVisitTo: null | string;
  nextVisitFrom: null | string;
  nextVisitTo: null | string;
  normalizedBeneficiaryRut: null | string;
  normalizedPatientName: null | string;
  normalizedPatientPhone: null | string;
  normalizedPatientRut: null | string;
  orderBy: ReturnType<typeof sql>;
  page: number;
  pageSize: number;
  phoneFilterSql: (phonePattern: null | string) => ReturnType<typeof sql>;
  queryFilterSql: ReturnType<typeof sql>;
  skinTestFilterSql: ReturnType<typeof sql>;
  today: string;
  view: "abandonment" | "series";
};

function prepareClinicalSeriesFilters(
  filters?: ClinicalSeriesFilters
): PreparedClinicalSeriesFilters {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const view = filters?.view ?? "series";
  const normalizedBeneficiaryRut = filters?.beneficiaryRut
    ? normalizeRut(filters.beneficiaryRut)
    : null;
  const normalizedPatientRut = filters?.patientRut ? normalizeRut(filters.patientRut) : null;
  const normalizedPatientName = filters?.patientName
    ? `%${normalizeName(filters.patientName)}%`
    : null;
  const normalizedPatientPhone = filters?.patientPhone
    ? `%${normalizePhoneSearch(filters.patientPhone)}%`
    : null;
  const lastVisitFrom = filters?.lastVisitFrom ?? null;
  const lastVisitTo = filters?.lastVisitTo ?? null;
  const nextVisitFrom = filters?.nextVisitFrom ?? null;
  const nextVisitTo = filters?.nextVisitTo ?? null;
  const normalizedQuery = filters?.query ? normalizeName(filters.query) : null;
  const queryRut = filters?.query ? normalizeRut(filters.query) : null;
  const queryPhone = filters?.query ? normalizePhoneSearch(filters.query) : null;
  const queryTokens = normalizedQuery
    ? normalizedQuery
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    : [];
  const persistedPhoneFilterSql = (phonePattern: null | string) =>
    sql`(
      regexp_replace(coalesce(cs.patient_phones::text, '[]'), '\D', '', 'g') LIKE ${phonePattern}
      OR regexp_replace(coalesce(cs.beneficiary_phones::text, '[]'), '\D', '', 'g') LIKE ${phonePattern}
    )`;
  const eventPhoneFilterSql = (phonePattern: null | string) =>
    sql`EXISTS (
      SELECT 1
      FROM events ef
      WHERE ef.clinical_series_id = cs.id
        AND regexp_replace(concat_ws(' ', coalesce(ef.summary, ''), coalesce(ef.description, '')), '\D', '', 'g') LIKE ${phonePattern}
    )`;
  const phoneFilterSql = (phonePattern: null | string) =>
    sql`(${persistedPhoneFilterSql(phonePattern)} OR ${eventPhoneFilterSql(phonePattern)})`;

  const textHaystack = sql`lower(concat_ws(' ', coalesce(cs.patient_name, ''), coalesce(cs.beneficiary_name, ''), coalesce(cs.display_name, ''), coalesce(cs.patient_rut, ''), coalesce(cs.beneficiary_rut, '')))`;
  const queryFilterSql =
    normalizedQuery || queryRut || queryPhone
      ? sql`(
          (${queryRut}::text IS NOT NULL AND (cs.patient_rut = ${queryRut} OR cs.beneficiary_rut = ${queryRut}))
          OR (${queryPhone}::text IS NOT NULL AND ${phoneFilterSql(queryPhone ? `%${queryPhone}%` : null)})
          OR (${normalizedQuery ? `%${normalizedQuery}%` : null}::text IS NOT NULL AND ${textHaystack} LIKE ${normalizedQuery ? `%${normalizedQuery}%` : null})
          OR ${
            queryTokens.length > 0
              ? sql.join(
                  queryTokens.map((token) => sql`${textHaystack} LIKE ${`%${token}%`}`),
                  sql` AND `
                )
              : sql`FALSE`
          }
        )`
      : sql`TRUE`;
  const isapreProvider = filters?.isapreProvider?.trim() || null;
  const isapreOnlyUnidentified = filters?.isapreOnlyUnidentified === true;
  const effectiveKind = view === "abandonment" ? "SUBCUTANEOUS_TREATMENT" : (filters?.kind ?? null);
  const effectiveHealthInsurance =
    isapreProvider || isapreOnlyUnidentified ? "ISAPRE" : (filters?.healthInsurance ?? null);
  const effectiveStatus = view === "abandonment" ? null : (filters?.status ?? null);
  const isapreFilterSql = isapreOnlyUnidentified
    ? sql`coalesce(nullif(trim(coalesce(cs.isapre_name, '')), ''), null) IS NULL`
    : isapreProvider
      ? sql`cs.isapre_name = ${isapreProvider}`
      : sql`TRUE`;
  const daysSinceLastEventSql = sql<number | null>`CASE
    WHEN es.last_event_date IS NULL THEN NULL
    ELSE (${today}::date - es.last_event_date)
  END`;
  const abandonmentBucketSql = sql<string | null>`CASE
    WHEN ${daysSinceLastEventSql} IS NULL OR ${daysSinceLastEventSql} < 30 THEN NULL
    WHEN ${daysSinceLastEventSql} < 60 THEN 'month_1'
    WHEN ${daysSinceLastEventSql} < 90 THEN 'month_2'
    WHEN ${daysSinceLastEventSql} < 120 THEN 'month_3'
    ELSE 'month_4_plus'
  END`;
  const abandonmentFilterSql =
    view === "abandonment"
      ? sql`(
          cs.kind::text = 'SUBCUTANEOUS_TREATMENT'
          AND cs.status::text NOT IN ('COMPLETED', 'CANCELLED')
          AND es.last_event_date IS NOT NULL
          AND es.next_event_date IS NULL
          AND ${daysSinceLastEventSql} >= 30
          AND (${filters?.abandonmentBucket ?? null}::text IS NULL OR ${abandonmentBucketSql} = ${
            filters?.abandonmentBucket ?? null
          }::text)
        )`
      : sql`TRUE`;
  const orderBy = resolveClinicalSeriesOrderBy(
    view === "abandonment" && filters?.sortColumn == null
      ? { ...filters, sortColumn: "daysSinceLastEvent", sortDirection: "descending" }
      : filters,
    today
  );

  // skinTest filter: EXISTS / NOT EXISTS correlated subquery on clinical_skin_tests.
  // Uses the indexed clinical_series_id FK — no sequential scan.
  const skinTestFilterSql =
    filters?.hasSkinTest === true
      ? sql`EXISTS (SELECT 1 FROM clinical_skin_tests cst WHERE cst.clinical_series_id = cs.id)`
      : filters?.hasSkinTest === false
        ? sql`NOT EXISTS (SELECT 1 FROM clinical_skin_tests cst WHERE cst.clinical_series_id = cs.id)`
        : sql`TRUE`;

  return {
    abandonmentFilterSql,
    effectiveKind,
    effectiveHealthInsurance,
    effectiveStatus,
    isapreFilterSql,
    lastVisitFrom,
    lastVisitTo,
    nextVisitFrom,
    nextVisitTo,
    normalizedBeneficiaryRut,
    normalizedPatientName,
    normalizedPatientPhone,
    normalizedPatientRut,
    orderBy,
    page,
    pageSize,
    phoneFilterSql,
    queryFilterSql,
    skinTestFilterSql,
    today,
    view,
  };
}

function resolveClinicalSeriesOrderBy(
  filters?: ClinicalSeriesFilters,
  today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD")
): ReturnType<typeof sql> {
  const sortColumn = filters?.sortColumn ?? "lastEvent";
  const sortDirection = filters?.sortDirection === "ascending" ? "ASC" : "DESC";

  const columnExpression = (() => {
    switch (sortColumn) {
      case "patient":
        return "lower(coalesce(cs.patient_name, ''))";
      case "daysSinceLastEvent":
        return `CASE WHEN es.last_event_date IS NULL THEN NULL ELSE ('${today}'::date - es.last_event_date) END`;
      case "kind":
        return "cs.kind::text";
      case "status":
        return "cs.status::text";
      case "nextEvent":
        return "es.next_event_date";
      case "totalEvents":
        return "coalesce(es.total_events, 0)";
      case "upcomingEvents":
        return "coalesce(es.upcoming_events, 0)";
      case "financial":
        return "greatest(0, coalesce(es.total_expected_due, 0) - coalesce(lt.total_linked_amount, 0))";
      case "lastEvent":
      default:
        return "es.last_event_date";
    }
  })();
  return sql.raw(`${columnExpression} ${sortDirection} NULLS LAST, cs.id DESC`);
}






// ── SeriesAssignmentContext ───────────────────────────────────────────────────
// Pre-loaded in-memory index of all clinical series. Eliminates per-event DB
// queries during bulk rebuilds — a single load replaces O(N) round trips with
// O(1) map lookups and O(k) token-overlap scans.




