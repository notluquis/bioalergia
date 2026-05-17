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






async function loadEventSeriesCandidateByInternalId(
  eventId: number
): Promise<EventSeriesCandidate | null> {
  const rows = await db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      to_char(e.start_date_time AT TIME ZONE ${TIMEZONE}, 'HH24:MI') AS "eventTime",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function loadEventSeriesCandidateByExternalIds(
  calendarGoogleId: string,
  externalEventId: string
): Promise<EventSeriesCandidate | null> {
  const rows = await db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      to_char(e.start_date_time AT TIME ZONE ${TIMEZONE}, 'HH24:MI') AS "eventTime",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE c.google_id = ${calendarGoogleId}
      AND e.external_event_id = ${externalEventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

// Returns significant tokens from a normalized name: length ≥ 3, not a stopword.

// ── SeriesAssignmentContext ───────────────────────────────────────────────────
// Pre-loaded in-memory index of all clinical series. Eliminates per-event DB
// queries during bulk rebuilds — a single load replaces O(N) round trips with
// O(1) map lookups and O(k) token-overlap scans.

interface SeriesEntry {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  eventCount: number;
  id: number;
  kind: ClinicalSeriesKind;
  maxDate: dayjs.Dayjs | null;
  minDate: dayjs.Dayjs | null;
  patientName: null | string;
  patientPhones: string[];
  patientRut: null | string;
}

function haveCompatiblePatientNames(a: null | string, b: null | string): boolean {
  if (!a || !b) return false;
  const leftTokens = getSignificantNameTokens(a);
  const rightTokens = getSignificantNameTokens(b);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;

  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  if (overlap < 2) return false;

  return overlap / Math.min(leftTokens.length, rightTokens.length) >= 2 / 3;
}

function scoreClinicalSeriesIdentityQuality(series: {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  eventCount?: number;
  patientName?: null | string;
  patientRut?: null | string;
}): number {
  let score = 0;
  if (series.patientRut) score += 1_000;
  if (series.beneficiaryRut) score += 200;
  if (series.patientName && isLikelyPersonName(series.patientName)) score += 150;
  if (series.beneficiaryName && isLikelyPersonName(series.beneficiaryName)) score += 75;
  if (series.beneficiaryName && !isLikelyPersonName(series.beneficiaryName)) score -= 50;
  score += Math.min(series.eventCount ?? 0, 500);
  return score;
}

function scoreRepresentativeIdentity(identity: ClinicalIdentity & { eventCount?: number }): number {
  return scoreClinicalSeriesIdentityQuality(identity);
}

function compareRepresentativeIdentity(
  a: ClinicalIdentity & { eventCount?: number },
  b: ClinicalIdentity & { eventCount?: number }
): number {
  const scoreDelta = scoreRepresentativeIdentity(b) - scoreRepresentativeIdentity(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return (b.patientName ?? "").length - (a.patientName ?? "").length;
}

function compareSeriesCanonicalPriority<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): number {
  const scoreDelta = scoreClinicalSeriesIdentityQuality(b) - scoreClinicalSeriesIdentityQuality(a);
  if (scoreDelta !== 0) return scoreDelta;
  const eventDelta = (b.eventCount ?? 0) - (a.eventCount ?? 0);
  if (eventDelta !== 0) return eventDelta;
  return a.id - b.id;
}

function chooseBetterSeriesCandidate<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(...candidates: Array<null | T | undefined>): null | T {
  return (
    candidates
      .filter((candidate): candidate is T => candidate != null)
      .sort(compareSeriesCanonicalPriority)[0] ?? null
  );
}

function chooseCanonicalPhoneDuplicateCandidate<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    kind: ClinicalSeriesKind;
    patientName?: null | string;
    patientPhones?: string[];
    patientRut?: null | string;
  },
>(base: null | T | undefined, peers: Array<T>): null | T {
  if (!base?.patientName || !base.patientPhones?.length) return base ?? null;

  return chooseBetterSeriesCandidate(
    base,
    ...peers.filter(
      (candidate) =>
        candidate.id !== base.id &&
        candidate.kind === base.kind &&
        !!candidate.patientName &&
        !!candidate.patientPhones?.some((phone) => base.patientPhones?.includes(phone)) &&
        haveCompatiblePatientNames(candidate.patientName, base.patientName!)
    )
  );
}

function shouldPreferCandidateOverRutMatch<
  T extends {
    beneficiaryName?: null | string;
    beneficiaryRut?: null | string;
    eventCount?: number;
    id: number;
    patientName?: null | string;
    patientRut?: null | string;
  },
>(rutMatch: null | T | undefined, preferred: null | T | undefined): boolean {
  if (!rutMatch || !preferred) return false;
  if (rutMatch === preferred) return false;
  if (compareSeriesCanonicalPriority(preferred, rutMatch) >= 0) return false;

  const preferredCrossMatchesRut =
    !!preferred.beneficiaryRut &&
    !!rutMatch.patientRut &&
    (preferred.beneficiaryRut === rutMatch.patientRut ||
      isCloseNormalizedRut(preferred.beneficiaryRut, rutMatch.patientRut));

  const rutMatchLooksWeaker =
    !!rutMatch.patientName &&
    !!preferred.patientName &&
    haveCompatiblePatientNames(rutMatch.patientName, preferred.patientName);

  return preferredCrossMatchesRut && rutMatchLooksWeaker;
}

function hasConflictingPrimaryIdentity<
  T extends {
    beneficiaryRut?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): boolean {
  if (!a.patientRut || !b.patientRut) return false;
  if (a.patientRut === b.patientRut) return false;
  if (isCloseNormalizedRut(a.patientRut, b.patientRut)) return false;
  if (
    a.beneficiaryRut &&
    (a.beneficiaryRut === b.patientRut || isCloseNormalizedRut(a.beneficiaryRut, b.patientRut))
  ) {
    return false;
  }
  if (
    b.beneficiaryRut &&
    (b.beneficiaryRut === a.patientRut || isCloseNormalizedRut(b.beneficiaryRut, a.patientRut))
  ) {
    return false;
  }
  return true;
}

function hasHardPatientRutConflictForDuplicateDetection<
  T extends {
    beneficiaryRut?: null | string;
    patientRut?: null | string;
  },
>(a: T, b: T): boolean {
  if (!a.patientRut || !b.patientRut) return false;
  if (a.patientRut === b.patientRut) return false;
  if (isCloseNormalizedRut(a.patientRut, b.patientRut)) return false;

  const swappedPair =
    !!a.beneficiaryRut &&
    !!b.beneficiaryRut &&
    (a.patientRut === b.beneficiaryRut || isCloseNormalizedRut(a.patientRut, b.beneficiaryRut)) &&
    (b.patientRut === a.beneficiaryRut || isCloseNormalizedRut(b.patientRut, a.beneficiaryRut));

  return !swappedPair;
}

class SeriesAssignmentContext {
  // RUT index stays single-valued; exact-name collisions keep all candidates so
  // rebuild can prefer the best canonical series rather than the oldest id.
  private readonly rutKindIndex = new Map<string, number>(); // `${rut}:${kind}` → id
  private readonly nameKindIndex = new Map<string, number[]>(); // `${name}:${kind}` → [id, …]
  private readonly phoneKindIndex = new Map<string, number[]>(); // `${phone}:${kind}` → [id, …]
  // Token inverted index — insertion order matches id ASC load order.
  private readonly tokenIndex = new Map<string, number[]>(); // token → [id, …]
  readonly seriesById = new Map<number, SeriesEntry>();

  private addEntry(entry: SeriesEntry): void {
    this.seriesById.set(entry.id, entry);

    if (entry.patientRut) {
      const key = `${normalizeRut(entry.patientRut)}:${entry.kind}`;
      this.rutKindIndex.getOrInsert(key, entry.id);
    }
    if (entry.patientName) {
      const key = `${normalizeName(entry.patientName)}:${entry.kind}`;
      const ids = this.nameKindIndex.get(key);
      if (ids) ids.push(entry.id);
      else this.nameKindIndex.set(key, [entry.id]);
      for (const token of getSignificantNameTokens(entry.patientName)) {
        const list = this.tokenIndex.get(token);
        if (list) list.push(entry.id);
        else this.tokenIndex.set(token, [entry.id]);
      }
    }

    for (const phone of entry.patientPhones) {
      const key = `${phone}:${entry.kind}`;
      const ids = this.phoneKindIndex.get(key);
      if (ids) ids.push(entry.id);
      else this.phoneKindIndex.set(key, [entry.id]);
    }
  }

  static async load(): Promise<SeriesAssignmentContext> {
    const ctx = new SeriesAssignmentContext();
    const rows = await db.clinicalSeries.findMany({
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        kind: true,
        patientName: true,
        patientPhones: true,
        patientRut: true,
        events: {
          select: {
            description: true,
            endDate: true,
            endDateTime: true,
            startDate: true,
            startDateTime: true,
            summary: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
    for (const s of rows) {
      const dates = s.events
        .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
        .filter((v): v is Date => v instanceof Date)
        .map((v) => dayjs(v).tz(TIMEZONE))
        .sort((a, b) => a.valueOf() - b.valueOf());
      ctx.addEntry({
        beneficiaryName: s.beneficiaryName,
        beneficiaryRut: s.beneficiaryRut,
        eventCount: s.events.length,
        id: s.id,
        kind: s.kind,
        maxDate: dates[dates.length - 1] ?? null,
        minDate: dates[0] ?? null,
        patientName: s.patientName,
        patientPhones: getSeriesPatientPhones(s),
        patientRut: s.patientRut,
      });
    }
    return ctx;
  }

  /** Distance in days between eventDate and the series' event span. */
  private dist(entry: SeriesEntry, eventDate: dayjs.Dayjs): number {
    if (!entry.minDate || !entry.maxDate) return Infinity;
    if (eventDate.isBefore(entry.minDate)) return entry.minDate.diff(eventDate, "day");
    if (eventDate.isAfter(entry.maxDate)) return eventDate.diff(entry.maxDate, "day");
    return 0;
  }

  /** RUT uniquely identifies the patient — returns the oldest series for this rut+kind. */
  findByRut(rut: string, kind: ClinicalSeriesKind): number | undefined {
    return this.rutKindIndex.get(`${normalizeRut(rut)}:${kind}`);
  }

  /** Exact normalized name match, closest within the date window. */
  findByName(
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: dayjs.Dayjs,
    thresholdDays: number
  ): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    const candidates = ids
      .map((id) => this.seriesById.get(id))
      .filter(
        (entry): entry is SeriesEntry => !!entry && this.dist(entry, eventDate) <= thresholdDays
      )
      .sort((a, b) => {
        const distanceDelta = this.dist(a, eventDate) - this.dist(b, eventDate);
        if (distanceDelta !== 0) return distanceDelta;
        return compareSeriesCanonicalPriority(a, b);
      });
    return candidates[0]?.id;
  }

  /** Choose the canonical same-kind series for this exact normalized name. */
  findUniqueByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  findDuplicateCanonicalByExactName(name: string, kind: ClinicalSeriesKind): number | undefined {
    const ids = this.nameKindIndex.get(`${normalizeName(name)}:${kind}`) ?? [];
    if (ids.length !== 2) return undefined;
    return ids
      .map((id) => this.seriesById.get(id))
      .filter((entry): entry is SeriesEntry => !!entry)
      .sort(compareSeriesCanonicalPriority)[0]?.id;
  }

  findByPhoneAndCompatibleName(
    phones: string[],
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: dayjs.Dayjs,
    thresholdDays: number
  ): number | undefined {
    void eventDate;
    void thresholdDays;
    const candidateIds = new Set<number>();
    for (const phone of phones) {
      for (const id of this.phoneKindIndex.get(`${phone}:${kind}`) ?? []) {
        candidateIds.add(id);
      }
    }

    const candidates = [...candidateIds]
      .map((id) => this.seriesById.get(id))
      .filter(
        (entry): entry is SeriesEntry =>
          !!entry && !!entry.patientName && haveCompatiblePatientNames(entry.patientName, name)
      )
      .sort(compareSeriesCanonicalPriority);

    return candidates[0]?.id;
  }

  findCanonicalPhoneDuplicate(id: number): number | undefined {
    const base = this.seriesById.get(id);
    if (!base?.patientName || base.patientPhones.length === 0) return undefined;

    const candidateIds = new Set<number>([id]);
    for (const phone of base.patientPhones) {
      for (const candidateId of this.phoneKindIndex.get(`${phone}:${base.kind}`) ?? []) {
        candidateIds.add(candidateId);
      }
    }

    const candidates = [...candidateIds]
      .map((candidateId) => this.seriesById.get(candidateId))
      .filter(
        (entry): entry is SeriesEntry =>
          !!entry &&
          !!entry.patientName &&
          haveCompatiblePatientNames(entry.patientName, base.patientName)
      )
      .sort(compareSeriesCanonicalPriority);

    return candidates[0]?.id;
  }

  /**
   * Token-overlap fallback: finds the oldest same-kind series that shares ≥2
   * significant tokens covering ≥2/3 of the shorter name. Used when exact
   * name matching fails (e.g. "jose luis ojeda" ↔ "jose ojeda carrasco").
   */
  findByTokenOverlap(
    name: string,
    kind: ClinicalSeriesKind,
    eventDate: dayjs.Dayjs,
    thresholdDays: number
  ): number | undefined {
    const eventTokens = getSignificantNameTokens(name);
    if (eventTokens.length < 2) return undefined;

    // Count how many event tokens appear in each candidate series.
    const overlapCount = new Map<number, number>();
    for (const token of eventTokens) {
      for (const id of this.tokenIndex.get(token) ?? []) {
        overlapCount.set(id, (overlapCount.get(id) ?? 0) + 1);
      }
    }

    let best: SeriesEntry | undefined;
    for (const [id, overlap] of overlapCount) {
      if (overlap < 2) continue;
      const entry = this.seriesById.get(id);
      if (!entry || entry.kind !== kind || !entry.patientName) continue;
      const shorterLen = Math.min(
        eventTokens.length,
        getSignificantNameTokens(entry.patientName).length
      );
      if (overlap / shorterLen < 2 / 3) continue;
      if (this.dist(entry, eventDate) > thresholdDays) continue;
      if (!best) {
        best = entry;
        continue;
      }
      const currentBest = best;
      const bestOverlap = eventTokens.filter((t) =>
        getSignificantNameTokens(currentBest.patientName ?? "").includes(t)
      ).length;
      if (
        overlap > bestOverlap ||
        (overlap === bestOverlap && compareSeriesCanonicalPriority(entry, currentBest) < 0)
      ) {
        best = entry;
      }
    }
    return best?.id;
  }

  /** Register a newly created series so subsequent lookups can find it. */
  register(entry: SeriesEntry): void {
    this.addEntry(entry);
  }

  /** Extend the series' date span after assigning an event to it. */
  touch(id: number, eventDate: dayjs.Dayjs): void {
    const entry = this.seriesById.get(id);
    if (!entry) return;
    if (!entry.minDate || eventDate.isBefore(entry.minDate)) entry.minDate = eventDate;
    if (!entry.maxDate || eventDate.isAfter(entry.maxDate)) entry.maxDate = eventDate;
  }
}

export async function findMatchingSeries(
  params: {
    beneficiaryRut?: null | string;
    eventDate: string;
    kind: ClinicalSeriesKind;
    patientName: null | string;
    patientPhones?: string[];
    patientRut: null | string;
  },
  ctx?: SeriesAssignmentContext
): Promise<null | number> {
  const eventDateDjs = dayjs.tz(params.eventDate, TIMEZONE);
  const thresholdDays = getSeriesWindowDays(params.kind);

  // ── Fast path: all lookups in memory (O(1) / O(k)) ───────────────────────
  if (ctx) {
    const rutMatchEntry =
      params.patientRut != null
        ? (() => {
            const id = ctx.findByRut(params.patientRut, params.kind);
            return id != null ? (ctx.seriesById.get(id) ?? null) : null;
          })()
        : null;

    if (params.patientName) {
      const duplicateCanonical = ctx.findDuplicateCanonicalByExactName(
        params.patientName,
        params.kind
      );
      if (duplicateCanonical != null) {
        const canonical = ctx.seriesById.get(duplicateCanonical);
        if (
          canonical &&
          (!params.patientRut ||
            canonical.patientRut === params.patientRut ||
            canonical.beneficiaryRut === params.patientRut ||
            canonical.patientRut === params.beneficiaryRut ||
            canonical.beneficiaryRut === params.beneficiaryRut ||
            isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
            isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
            isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null))
        ) {
          return duplicateCanonical;
        }
      }
    }

    if (params.patientName) {
      const exact = ctx.findByName(params.patientName, params.kind, eventDateDjs, thresholdDays);
      const uniqueExact = ctx.findUniqueByExactName(params.patientName, params.kind);
      const phoneMatch = params.patientPhones?.length
        ? ctx.findByPhoneAndCompatibleName(
            params.patientPhones,
            params.patientName,
            params.kind,
            eventDateDjs,
            thresholdDays
          )
        : undefined;
      const chosen = chooseBetterSeriesCandidate(
        rutMatchEntry,
        exact != null
          ? { ...ctx.seriesById.get(exact)!, eventCount: ctx.seriesById.get(exact)!.eventCount }
          : null,
        uniqueExact != null
          ? {
              ...ctx.seriesById.get(uniqueExact)!,
              eventCount: ctx.seriesById.get(uniqueExact)!.eventCount,
            }
          : null,
        phoneMatch != null
          ? {
              ...ctx.seriesById.get(phoneMatch)!,
              eventCount: ctx.seriesById.get(phoneMatch)!.eventCount,
            }
          : null
      );
      if (chosen) {
        const canonicalPhoneDuplicate = ctx.findCanonicalPhoneDuplicate(chosen.id);
        if (canonicalPhoneDuplicate != null) return canonicalPhoneDuplicate;
        if (shouldPreferCandidateOverRutMatch(rutMatchEntry, chosen)) return chosen.id;
        if (chosen.patientRut) {
          const canonical = ctx.findByRut(chosen.patientRut, params.kind);
          if (canonical != null) return canonical;
        }
        return chosen.id;
      }
      const fuzzy = ctx.findByTokenOverlap(
        params.patientName,
        params.kind,
        eventDateDjs,
        thresholdDays
      );
      if (fuzzy != null) return fuzzy;
    }
    if (rutMatchEntry) {
      const canonicalPhoneDuplicate = ctx.findCanonicalPhoneDuplicate(rutMatchEntry.id);
      if (canonicalPhoneDuplicate != null) return canonicalPhoneDuplicate;
      return rutMatchEntry.id;
    }
    return null;
  }

  // ── Slow path: DB queries (single-event incremental sync) ─────────────────
  const eventSelect = {
    select: {
      description: true,
      endDate: true,
      endDateTime: true,
      startDate: true,
      startDateTime: true,
      summary: true,
    },
  } as const;

  if (params.patientName) {
    const duplicateCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      select: {
        beneficiaryName: true,
        beneficiaryRut: true,
        id: true,
        patientName: true,
        patientRut: true,
        _count: { select: { events: true } },
      },
      orderBy: { id: "asc" },
    });
    if (duplicateCandidates.length === 2) {
      const canonical = [...duplicateCandidates].sort((a, b) =>
        compareSeriesCanonicalPriority(
          {
            beneficiaryName: a.beneficiaryName,
            beneficiaryRut: a.beneficiaryRut,
            eventCount: a._count.events,
            id: a.id,
            patientName: a.patientName,
            patientRut: a.patientRut,
          },
          {
            beneficiaryName: b.beneficiaryName,
            beneficiaryRut: b.beneficiaryRut,
            eventCount: b._count.events,
            id: b.id,
            patientName: b.patientName,
            patientRut: b.patientRut,
          }
        )
      )[0]!;
      if (
        !params.patientRut ||
        canonical.patientRut === params.patientRut ||
        canonical.beneficiaryRut === params.patientRut ||
        canonical.patientRut === params.beneficiaryRut ||
        canonical.beneficiaryRut === params.beneficiaryRut ||
        isCloseNormalizedRut(canonical.patientRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.patientRut) ||
        isCloseNormalizedRut(canonical.patientRut, params.beneficiaryRut ?? null) ||
        isCloseNormalizedRut(canonical.beneficiaryRut, params.beneficiaryRut ?? null)
      ) {
        return canonical.id;
      }
    }
  }

  let rutMatchCandidate: null | {
    beneficiaryName: null | string;
    beneficiaryRut: null | string;
    eventCount: number;
    id: number;
    patientName: null | string;
    patientRut: null | string;
  } = null;

  if (params.patientRut) {
    // RUT uniquely identifies the patient — return oldest series for this rut+kind.
    const rutMatch = await db.clinicalSeries.findFirst({
      where: { kind: params.kind, patientRut: params.patientRut },
      orderBy: { id: "asc" },
      include: { events: eventSelect },
    });
    if (rutMatch) {
      rutMatchCandidate = {
        beneficiaryName: rutMatch.beneficiaryName,
        beneficiaryRut: rutMatch.beneficiaryRut,
        eventCount: rutMatch.events.length,
        id: rutMatch.id,
        patientName: rutMatch.patientName,
        patientRut: rutMatch.patientRut,
      };
      if (!params.patientName) return rutMatch.id;
    }
  }

  if (params.patientName) {
    // Exact name match within date window.
    const nameCandidates = await db.clinicalSeries.findMany({
      where: { kind: params.kind, patientName: params.patientName },
      include: { events: eventSelect },
      orderBy: { id: "asc" },
    });
    let best: null | { distance: number; id: number; score: number } = null;
    for (const c of nameCandidates) {
      const dates = c.events
        .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
        .filter((v): v is Date => v instanceof Date)
        .map((v) => dayjs(v).tz(TIMEZONE))
        .sort((a, b) => a.valueOf() - b.valueOf());
      const distance =
        dates.length === 0
          ? Infinity
          : (() => {
              const s = dates[0]!;
              const e = dates[dates.length - 1]!;
              return eventDateDjs.isBefore(s)
                ? s.diff(eventDateDjs, "day")
                : eventDateDjs.isAfter(e)
                  ? eventDateDjs.diff(e, "day")
                  : 0;
            })();
      if (distance > thresholdDays) continue;
      const score = scoreClinicalSeriesIdentityQuality({
        beneficiaryName: c.beneficiaryName,
        beneficiaryRut: c.beneficiaryRut,
        eventCount: c.events.length,
        patientName: c.patientName,
        patientRut: c.patientRut,
      });
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance &&
          (score > best.score || (score === best.score && c.id < best.id)))
      ) {
        best = { distance, id: c.id, score };
      }
    }

    const exactCandidate =
      best == null
        ? null
        : (() => {
            const candidate = nameCandidates.find((item) => item.id === best.id);
            return candidate
              ? {
                  beneficiaryName: candidate.beneficiaryName,
                  beneficiaryRut: candidate.beneficiaryRut,
                  eventCount: candidate.events.length,
                  id: candidate.id,
                  patientName: candidate.patientName,
                  patientRut: candidate.patientRut,
                }
              : null;
          })();
    const uniqueExactCandidate =
      nameCandidates.length === 0
        ? null
        : [...nameCandidates]
            .sort((a, b) =>
              compareSeriesCanonicalPriority(
                {
                  beneficiaryName: a.beneficiaryName,
                  beneficiaryRut: a.beneficiaryRut,
                  eventCount: a.events.length,
                  id: a.id,
                  patientName: a.patientName,
                  patientRut: a.patientRut,
                },
                {
                  beneficiaryName: b.beneficiaryName,
                  beneficiaryRut: b.beneficiaryRut,
                  eventCount: b.events.length,
                  id: b.id,
                  patientName: b.patientName,
                  patientRut: b.patientRut,
                }
              )
            )
            .map((candidate) => ({
              beneficiaryName: candidate.beneficiaryName,
              beneficiaryRut: candidate.beneficiaryRut,
              eventCount: candidate.events.length,
              id: candidate.id,
              patientName: candidate.patientName,
              patientRut: candidate.patientRut,
            }))[0]!;

    let phoneCandidate: null | {
      beneficiaryName: null | string;
      beneficiaryRut: null | string;
      eventCount: number;
      id: number;
      patientName: null | string;
      patientRut: null | string;
    } = null;
    let phoneCandidates: Array<{
      beneficiaryName: null | string;
      beneficiaryRut: null | string;
      events: Array<{
        description: null | string;
        endDate: Date | null;
        endDateTime: Date | null;
        startDate: Date | null;
        startDateTime: Date | null;
        summary: null | string;
      }>;
      id: number;
      patientName: null | string;
      patientPhones: unknown;
      patientRut: null | string;
    }> = [];

    if (params.patientPhones?.length) {
      phoneCandidates = await db.clinicalSeries.findMany({
        where: { kind: params.kind },
        include: {
          events: {
            select: {
              description: true,
              endDate: true,
              endDateTime: true,
              startDate: true,
              startDateTime: true,
              summary: true,
            },
          },
        },
        orderBy: { id: "asc" },
      });
      const matchingPhoneCandidates = phoneCandidates
        .filter((candidate) => {
          const storedPhones = getSeriesPatientPhones(candidate);
          return (
            candidate.patientName &&
            storedPhones.some((phone) => params.patientPhones?.includes(phone)) &&
            haveCompatiblePatientNames(candidate.patientName, params.patientName)
          );
        })
        .map((candidate) => ({
          candidate,
          score: scoreClinicalSeriesIdentityQuality({
            beneficiaryName: candidate.beneficiaryName,
            beneficiaryRut: candidate.beneficiaryRut,
            eventCount: candidate.events.length,
            patientName: candidate.patientName,
            patientRut: candidate.patientRut,
          }),
        }))
        .sort((left, right) => {
          const scoreDelta = right.score - left.score;
          if (scoreDelta !== 0) return scoreDelta;
          return left.candidate.id - right.candidate.id;
        });
      if (matchingPhoneCandidates[0]) {
        phoneCandidate = {
          beneficiaryName: matchingPhoneCandidates[0].candidate.beneficiaryName,
          beneficiaryRut: matchingPhoneCandidates[0].candidate.beneficiaryRut,
          eventCount: matchingPhoneCandidates[0].candidate.events.length,
          id: matchingPhoneCandidates[0].candidate.id,
          patientName: matchingPhoneCandidates[0].candidate.patientName,
          patientRut: matchingPhoneCandidates[0].candidate.patientRut,
        };
      }
    }

    const chosenCandidate = chooseBetterSeriesCandidate(
      rutMatchCandidate,
      exactCandidate,
      uniqueExactCandidate,
      phoneCandidate
    );
    if (chosenCandidate) {
      const canonicalPhoneDuplicate =
        params.patientPhones?.length && params.patientName
          ? chooseCanonicalPhoneDuplicateCandidate(
              {
                ...chosenCandidate,
                kind: params.kind,
                patientPhones: params.patientPhones,
              },
              [
                ...(nameCandidates ?? []).map((candidate) => ({
                  beneficiaryName: candidate.beneficiaryName,
                  beneficiaryRut: candidate.beneficiaryRut,
                  eventCount: candidate.events.length,
                  id: candidate.id,
                  kind: params.kind,
                  patientName: candidate.patientName,
                  patientPhones: getSeriesPatientPhones(candidate),
                  patientRut: candidate.patientRut,
                })),
                ...((params.patientPhones?.length ? phoneCandidates : []) ?? []).map(
                  (candidate) => ({
                    beneficiaryName: candidate.beneficiaryName,
                    beneficiaryRut: candidate.beneficiaryRut,
                    eventCount: candidate.events.length,
                    id: candidate.id,
                    kind: params.kind,
                    patientName: candidate.patientName,
                    patientPhones: getSeriesPatientPhones(candidate),
                    patientRut: candidate.patientRut,
                  })
                ),
              ]
            )
          : null;
      if (canonicalPhoneDuplicate) return canonicalPhoneDuplicate.id;
      if (shouldPreferCandidateOverRutMatch(rutMatchCandidate, chosenCandidate)) {
        return chosenCandidate.id;
      }
      return chosenCandidate.id;
    }

    // Token-overlap fallback.
    const eventTokens = getSignificantNameTokens(params.patientName);
    if (eventTokens.length >= 2) {
      const allSameKind = await db.clinicalSeries.findMany({
        where: { kind: params.kind },
        include: { events: eventSelect },
        orderBy: { id: "asc" },
      });
      let bestFuzzy: null | { distance: number; id: number; overlap: number; score: number } = null;
      for (const c of allSameKind) {
        if (!c.patientName) continue;
        const cTokens = getSignificantNameTokens(c.patientName);
        const overlap = eventTokens.filter((t) => cTokens.includes(t)).length;
        if (overlap < 2 || overlap / Math.min(eventTokens.length, cTokens.length) < 2 / 3) continue;
        const dates = c.events
          .map((e) => e.startDate ?? e.startDateTime ?? e.endDate ?? e.endDateTime)
          .filter((v): v is Date => v instanceof Date)
          .map((v) => dayjs(v).tz(TIMEZONE))
          .sort((a, b) => a.valueOf() - b.valueOf());
        const distance =
          dates.length === 0
            ? Infinity
            : (() => {
                const s = dates[0]!;
                const e = dates[dates.length - 1]!;
                return eventDateDjs.isBefore(s)
                  ? s.diff(eventDateDjs, "day")
                  : eventDateDjs.isAfter(e)
                    ? eventDateDjs.diff(e, "day")
                    : 0;
              })();
        if (distance > thresholdDays) continue;
        const score = scoreClinicalSeriesIdentityQuality({
          beneficiaryName: c.beneficiaryName,
          beneficiaryRut: c.beneficiaryRut,
          eventCount: c.events.length,
          patientName: c.patientName,
          patientRut: c.patientRut,
        });
        if (
          !bestFuzzy ||
          overlap > bestFuzzy.overlap ||
          (overlap === bestFuzzy.overlap &&
            (distance < bestFuzzy.distance ||
              (distance === bestFuzzy.distance &&
                (score > bestFuzzy.score || (score === bestFuzzy.score && c.id < bestFuzzy.id)))))
        ) {
          bestFuzzy = { distance, id: c.id, overlap, score };
        }
      }
      if (bestFuzzy) return bestFuzzy.id;
    }
  }

  if (rutMatchCandidate) return rutMatchCandidate.id;

  return null;
}

function buildIdentityGroupKey(name: null | string, rut: null | string): null | string {
  const normalizedRut = sanitizeRut(rut);
  if (normalizedRut) return `rut:${normalizedRut}`;
  const normalizedName = name ? normalizeName(name) : "";
  return normalizedName ? `name:${normalizedName}` : null;
}

function choosePreferredIdentityName(
  current: null | string,
  incoming: null | string
): null | string {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentTokens = getSignificantNameTokens(current);
  const incomingTokens = getSignificantNameTokens(incoming);
  if (incomingTokens.length !== currentTokens.length) {
    return incomingTokens.length > currentTokens.length ? incoming : current;
  }
  return incoming.length > current.length ? incoming : current;
}

export function shouldPromoteBeneficiaryToPatientIdentity(params: {
  beneficiaryName: null | string;
  dteClientNames?: string[];
  patientName: null | string;
}): boolean {
  const { beneficiaryName, dteClientNames = [], patientName } = params;
  if (!patientName) return true;
  if (beneficiaryName && haveCompatiblePatientNames(patientName, beneficiaryName)) return true;
  return dteClientNames.some((clientName) => haveCompatiblePatientNames(patientName, clientName));
}

type IdentityNameCounts = Map<string, { count: number; name: string }>;

function incrementIdentityNameCount(counts: IdentityNameCounts, name: null | string) {
  if (!name || !isLikelyPersonName(name)) return;
  const key = normalizeName(name);
  const current = counts.get(key);
  counts.set(key, {
    count: (current?.count ?? 0) + 1,
    name: choosePreferredIdentityName(current?.name ?? null, name) ?? name,
  });
}

function isSingleLetterPrefixedVariant(contaminated: string, canonical: string): boolean {
  const contaminatedTokens = normalizeName(contaminated).split(" ").filter(Boolean);
  const canonicalTokens = normalizeName(canonical).split(" ").filter(Boolean);
  if (contaminatedTokens.length !== canonicalTokens.length) return false;

  let changedTokens = 0;
  for (let i = 0; i < contaminatedTokens.length; i += 1) {
    const contaminatedToken = contaminatedTokens[i]!;
    const canonicalToken = canonicalTokens[i]!;
    if (contaminatedToken === canonicalToken) continue;
    if (contaminatedToken.length !== canonicalToken.length + 1) return false;
    if (!contaminatedToken.endsWith(canonicalToken)) return false;
    changedTokens += 1;
  }

  return changedTokens === 1;
}

function chooseDominantIdentityName(
  fallback: null | string,
  counts: IdentityNameCounts
): null | string {
  const candidates = [...counts.values()].sort((a, b) => {
    const countDelta = b.count - a.count;
    if (countDelta !== 0) return countDelta;
    const tokenDelta =
      getSignificantNameTokens(b.name).length - getSignificantNameTokens(a.name).length;
    if (tokenDelta !== 0) return tokenDelta;
    if (isSingleLetterPrefixedVariant(a.name, b.name)) return 1;
    if (isSingleLetterPrefixedVariant(b.name, a.name)) return -1;
    return b.name.length - a.name.length;
  });

  const dominant = candidates[0];
  if (!dominant) return fallback;

  return choosePreferredIdentityName(null, dominant.name);
}

export function selectRepresentativeClinicalIdentity(
  events: Array<{
    description: null | string;
    summary: null | string;
  }>,
  stored?: StoredClinicalIdentity
): ClinicalIdentity {
  const patientGroups = new Map<
    string,
    ClinicalIdentity & { eventCount: number; patientNameCounts: IdentityNameCounts }
  >();
  const beneficiaryGroups = new Map<
    string,
    ClinicalIdentity & { beneficiaryNameCounts: IdentityNameCounts; eventCount: number }
  >();
  let hasText = false;

  for (const event of events) {
    const eventHasText = hasIdentitySourceText(event.summary, event.description);
    hasText ||= eventHasText;
    const hints = resolveClinicalIdentity(event.summary, event.description);

    const patientKey = buildIdentityGroupKey(hints.patientName, hints.patientRut);
    if (patientKey) {
      const current = patientGroups.get(patientKey);
      const patientNameCounts = current?.patientNameCounts ?? new Map();
      incrementIdentityNameCount(patientNameCounts, hints.patientName);
      patientGroups.set(patientKey, {
        beneficiaryName: null,
        beneficiaryRut: null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: chooseDominantIdentityName(
          choosePreferredIdentityName(current?.patientName ?? null, hints.patientName),
          patientNameCounts
        ),
        patientNameCounts,
        patientRut: hints.patientRut ?? current?.patientRut ?? null,
      });
    }

    const beneficiaryKey = buildIdentityGroupKey(hints.beneficiaryName, hints.beneficiaryRut);
    const sameAsPatient =
      beneficiaryKey != null && patientKey != null && beneficiaryKey === patientKey;
    if (beneficiaryKey && !sameAsPatient) {
      const current = beneficiaryGroups.get(beneficiaryKey);
      const beneficiaryNameCounts = current?.beneficiaryNameCounts ?? new Map();
      incrementIdentityNameCount(beneficiaryNameCounts, hints.beneficiaryName);
      beneficiaryGroups.set(beneficiaryKey, {
        beneficiaryName: chooseDominantIdentityName(
          choosePreferredIdentityName(current?.beneficiaryName ?? null, hints.beneficiaryName),
          beneficiaryNameCounts
        ),
        beneficiaryNameCounts,
        beneficiaryRut: hints.beneficiaryRut ?? current?.beneficiaryRut ?? null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: null,
        patientRut: null,
      });
    }
  }

  if (!hasText) {
    return {
      beneficiaryName:
        stored?.beneficiaryName && isLikelyPersonName(stored.beneficiaryName)
          ? stored.beneficiaryName
          : null,
      beneficiaryRut: sanitizeRut(stored?.beneficiaryRut ?? null),
      patientName: stored?.patientName ?? null,
      patientRut: sanitizeRut(stored?.patientRut ?? null),
    };
  }

  const patient = [...patientGroups.values()].sort(compareRepresentativeIdentity)[0] ?? null;
  const patientKey = buildIdentityGroupKey(
    patient?.patientName ?? null,
    patient?.patientRut ?? null
  );
  const beneficiary =
    [...beneficiaryGroups.values()]
      .filter((candidate) => {
        const candidateKey = buildIdentityGroupKey(
          candidate.beneficiaryName ?? null,
          candidate.beneficiaryRut ?? null
        );
        return candidateKey != null && candidateKey !== patientKey;
      })
      .sort(compareRepresentativeIdentity)[0] ?? null;

  return {
    beneficiaryName: beneficiary?.beneficiaryName ?? null,
    beneficiaryRut: beneficiary?.beneficiaryRut ?? null,
    patientName: patient?.patientName ?? null,
    patientRut: patient?.patientRut ?? null,
  };
}

/**
 * If the DTE clientName (from SII, typically full legal name) is a more complete
 * version of the current patientName, return the DTE name as the upgrade.
 *
 * Matches when:
 * - All significant tokens of the current name fuzzy-match a token in the DTE name
 *   (Jaro-Winkler >= 0.90 to tolerate minor spelling differences like "krausse"/"krause")
 * - The DTE name has at least 2 significant tokens
 * - The DTE name has strictly more tokens than the current name
 */
function isAllLowercase(name: string): boolean {
  return name === name.toLowerCase() && name !== name.toUpperCase();
}

function upgradePatientNameFromDte(
  currentName: null | string,
  dteRecords: Array<{ clientName: string }>
): null | string {
  if (!currentName) return dteRecords[0]?.clientName ?? null;

  const currentTokens = getSignificantNameTokens(currentName);
  if (currentTokens.length === 0) return null;

  let best: null | string = null;
  let bestTokenCount = currentTokens.length;
  let bestIsCaseUpgrade = false;

  for (const dte of dteRecords) {
    if (!dte.clientName) continue;
    const dteTokens = getSignificantNameTokens(dte.clientName);

    // Must be a plausible person name: at least 2 significant tokens
    if (dteTokens.length < 2) continue;

    // Every current token must fuzzy-match at least one DTE token (JW >= 0.90)
    const allMatch = currentTokens.every((ct) =>
      dteTokens.some((dt) => jaroWinkler(ct, dt) >= 0.9)
    );
    if (!allMatch) continue;

    // Prefer the DTE name with the most tokens (most complete)
    if (dteTokens.length > bestTokenCount) {
      best = dte.clientName;
      bestTokenCount = dteTokens.length;
      bestIsCaseUpgrade = false;
    } else if (
      dteTokens.length >= currentTokens.length &&
      !bestIsCaseUpgrade &&
      best === null &&
      isAllLowercase(currentName) &&
      !isAllLowercase(dte.clientName)
    ) {
      // Current name is all lowercase but DTE has proper casing — adopt it
      best = dte.clientName;
      bestIsCaseUpgrade = true;
    }
  }

  return best;
}

async function refreshClinicalSeriesMetadata(seriesId: number) {
  const series = await db.clinicalSeries.findUnique({
    where: { id: seriesId },
    include: {
      events: {
        select: {
          amountExpected: true,
          amountPaid: true,
          description: true,
          seriesStageKind: true,
          seriesStageNumber: true,
          startDate: true,
          startDateTime: true,
          summary: true,
        },
      },
    },
  });

  if (!series) {
    return;
  }

  // Always re-extract from event text so an improved algorithm overwrites stale
  // stored values. When there is usable text, choose the dominant identity
  // across the whole series instead of trusting the first non-null event.
  let { patientName, patientRut, beneficiaryName, beneficiaryRut } =
    selectRepresentativeClinicalIdentity(series.events, {
      beneficiaryName: series.beneficiaryName,
      beneficiaryRut: series.beneficiaryRut,
      patientName: series.patientName,
      patientRut: series.patientRut,
    });

  // Upgrade patientName from DTE when the DTE clientRUT matches patientRut and
  // the clientName is a more complete version of the current name (e.g. calendar
  // has "villegas krausse" but the DTE has "JULIO RODRIGO VILLEGAS KRAUSE").
  if (patientRut) {
    const dteByPatientRut = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT s.client_name AS "clientName", s.client_rut AS "clientRUT"
      FROM dte_sale_details s
      WHERE s.client_rut = ${patientRut}
      LIMIT 5
    `;

    if (dteByPatientRut.length > 0) {
      const upgraded = upgradePatientNameFromDte(patientName, dteByPatientRut);
      if (upgraded) patientName = upgraded;
    }
  }

  // When there is no patientRut but the beneficiaryRut matches a DTE, upgrade
  // the beneficiary name and promote beneficiary → patient (since the beneficiary
  // is effectively the patient in this case).
  if (!patientRut && beneficiaryRut) {
    const dteByBeneficiaryRut = await db.$queryRaw<
      Array<{ clientName: string; clientRUT: string }>
    >`
      SELECT DISTINCT s.client_name AS "clientName", s.client_rut AS "clientRUT"
      FROM dte_sale_details s
      WHERE s.client_rut = ${beneficiaryRut}
      LIMIT 5
    `;

    if (dteByBeneficiaryRut.length > 0) {
      const upgradedBenef = upgradePatientNameFromDte(beneficiaryName, dteByBeneficiaryRut);
      if (upgradedBenef) beneficiaryName = upgradedBenef;
      const shouldPromote = shouldPromoteBeneficiaryToPatientIdentity({
        beneficiaryName,
        dteClientNames: dteByBeneficiaryRut.map((record) => record.clientName),
        patientName,
      });

      // Only promote BOLETA identity to patient when it actually matches the patient.
      if (shouldPromote) {
        patientRut = beneficiaryRut;
        patientName =
          choosePreferredIdentityName(
            patientName,
            beneficiaryName ?? dteByBeneficiaryRut[0]?.clientName ?? null
          ) ??
          dteByBeneficiaryRut[0]?.clientName ??
          null;
      }
    }
  }

  if (!beneficiaryRut || !beneficiaryName) {
    const linkedDocuments = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT
        s.client_name AS "clientName",
        s.client_rut AS "clientRUT"
      FROM event_dte_sale_links l
      JOIN events e ON e.id = l.event_id
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE e.clinical_series_id = ${seriesId}
        AND l.status != 'REJECTED'
    `;

    if (linkedDocuments.length === 1) {
      beneficiaryRut ||= linkedDocuments[0]?.clientRUT ?? null;
      beneficiaryName ||= linkedDocuments[0]?.clientName ?? null;
    }
  }

  const isSubcut = series.kind === "SUBCUTANEOUS_TREATMENT";
  const allergenType = isSubcut ? inferAllergenType(series.events) : null;
  const vaccineProduct = isSubcut ? inferVaccineProduct(series.events) : null;
  const { healthInsurance, isapreName } = inferHealthInsurance(series.events);
  const deliveryModality = isSubcut ? inferDeliveryModality(series.events) : null;
  const seriesPhones = series.events.reduce(
    (acc, item) => {
      const extracted = extractSeriesPhones(item.summary ?? null, item.description ?? null);
      extracted.patientPhones.forEach((phone) => acc.patientPhones.add(phone));
      extracted.beneficiaryPhones.forEach((phone) => acc.beneficiaryPhones.add(phone));
      return acc;
    },
    { beneficiaryPhones: new Set<string>(), patientPhones: new Set<string>() }
  );

  await db.clinicalSeries.update({
    where: { id: seriesId },
    data: {
      allergenType,
      vaccineProduct,
      healthInsurance,
      isapreName,
      deliveryModality,
      beneficiaryName,
      beneficiaryPhones: [...seriesPhones.beneficiaryPhones],
      beneficiaryRut,
      displayName: buildSeriesDisplayName({
        kind: series.kind as ClinicalSeriesKind,
        patientName,
        patientRut,
      }),
      expectedSessions: computeExpectedSessions(series.events),
      patientName,
      patientPhones: [...seriesPhones.patientPhones],
      patientRut,
    },
  });
}

// Run items concurrently using N "queue-draining" workers.
// Workers share a mutable queue; JS single-threaded shift() is safe without locks.
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  async function worker(): Promise<void> {
    let item: T | undefined;
    while ((item = queue.shift()) !== undefined) {
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

// Batch loader — one query for all events instead of N individual round trips.
async function loadEventSeriesCandidatesByIds(eventIds: number[]): Promise<EventSeriesCandidate[]> {
  if (eventIds.length === 0) return [];
  return db.$queryRaw<EventSeriesCandidate[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "calendarGoogleId",
      e.external_event_id AS "externalEventId",
      e.patient_name AS "patientName",
      e.patient_rut AS "patientRut",
      e.beneficiary_name AS "beneficiaryName",
      e.beneficiary_rut AS "beneficiaryRut",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      to_char(e.start_date_time AT TIME ZONE ${TIMEZONE}, 'HH24:MI') AS "eventTime",
      e.summary AS "summary",
      e.description AS "description",
      e.category AS "category",
      e.clinical_series_id AS "clinicalSeriesId",
      e.series_stage_kind AS "seriesStageKind",
      e.series_stage_label AS "seriesStageLabel",
      e.series_stage_number AS "seriesStageNumber",
      e.treatment_stage AS "treatmentStage",
      e.test_metadata AS "testMetadata",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    WHERE e.id = ANY(${eventIds}::int[])
    ORDER BY e.id ASC
  `;
}

// Core per-event sync logic — load-agnostic. Returns the series ID that was
// touched (for the caller to schedule a deduplicated metadata refresh), or
// null if the event does not qualify for a clinical series.
async function assignEventToSeries(
  event: EventSeriesCandidate,
  ctx?: SeriesAssignmentContext
): Promise<null | number> {
  const inferredMetadata = parseCalendarMetadata({
    description: event.description,
    summary: event.summary,
  });
  const kind = inferredMetadata.clinicalSeriesKind ?? inferSeriesKind(event);
  if (!kind) {
    if (event.clinicalSeriesId != null) {
      await db.event.update({
        where: { id: event.eventId },
        data: { clinicalSeries: { disconnect: true } },
      });
    }
    return null;
  }

  const identity = resolveClinicalIdentity(event.summary, event.description, {
    beneficiaryName: event.beneficiaryName,
    beneficiaryRut: event.beneficiaryRut,
    patientName: event.patientName,
    patientRut: event.patientRut,
  });

  const eventPatch = {
    beneficiaryName: identity.beneficiaryName,
    beneficiaryRut: identity.beneficiaryRut,
    patientName: identity.patientName,
    patientRut: identity.patientRut,
    seriesStageKind: inferredMetadata.seriesStageKind ?? null,
    seriesStageLabel: inferredMetadata.seriesStageLabel ?? null,
    seriesStageNumber: inferredMetadata.seriesStageNumber ?? null,
    treatmentStage: inferredMetadata.treatmentStage ?? null,
  };

  await db.event.update({
    where: { id: event.eventId },
    data: eventPatch,
  });

  if (!identity.patientName && !identity.patientRut) {
    return event.clinicalSeriesId ?? null;
  }

  const extractedPhones = extractSeriesPhones(event.summary, event.description);

  // Always call findMatchingSeries first — it returns the oldest canonical series
  // for this patient+kind by ordering candidates id ASC and preferring the one
  // with the smallest date distance. This ensures that during a rebuild an event
  // already sitting in a newer duplicate series gets re-assigned to the original.
  let targetSeriesId = await findMatchingSeries(
    {
      beneficiaryRut: identity.beneficiaryRut,
      eventDate: event.eventDate,
      kind,
      patientName: identity.patientName,
      patientPhones: extractedPhones.patientPhones,
      patientRut: identity.patientRut,
    },
    ctx
  );

  // Fallback: if nothing found but the event already has a compatible series
  // (e.g. brand-new patient, no prior series of this kind), keep it there.
  if (!targetSeriesId && event.clinicalSeriesId != null) {
    // Use context entry when available — avoids a DB round trip.
    const current =
      ctx?.seriesById.get(event.clinicalSeriesId) ??
      (await db.clinicalSeries.findUnique({
        where: { id: event.clinicalSeriesId },
        select: { beneficiaryRut: true, id: true, kind: true, patientRut: true },
      }));
    if (
      current?.kind === kind &&
      (!identity.patientRut || !current.patientRut || current.patientRut === identity.patientRut) &&
      (!identity.beneficiaryRut ||
        !current.beneficiaryRut ||
        current.beneficiaryRut === identity.beneficiaryRut)
    ) {
      targetSeriesId = current.id;
    }
  }

  const eventDateDjs = dayjs.tz(event.eventDate, TIMEZONE);

  if (!targetSeriesId) {
    const created = await db.clinicalSeries.create({
      data: {
        beneficiaryName: identity.beneficiaryName,
        beneficiaryRut: identity.beneficiaryRut,
        displayName: buildSeriesDisplayName({
          kind,
          patientName: identity.patientName,
          patientRut: identity.patientRut,
        }),
        expectedSessions:
          event.seriesStageNumber != null && Number.isFinite(event.seriesStageNumber)
            ? event.seriesStageNumber
            : null,
        kind,
        patientName: identity.patientName,
        patientRut: identity.patientRut,
      },
      select: { id: true },
    });
    targetSeriesId = created.id;
    // Register new series in the context so subsequent events find it.
    // Use `created.id` directly (number) instead of the `let`-typed
    // `targetSeriesId` (number | null) so TS doesn't widen the union.
    ctx?.register({
      beneficiaryName: identity.beneficiaryName,
      beneficiaryRut: identity.beneficiaryRut,
      eventCount: 1,
      id: created.id,
      kind,
      maxDate: eventDateDjs,
      minDate: eventDateDjs,
      patientName: identity.patientName,
      patientPhones: extractedPhones.patientPhones,
      patientRut: identity.patientRut,
    });
  }

  // Past this point `targetSeriesId` is guaranteed non-null: either
  // findMatchingSeries returned an id, or the fallback assigned
  // current.id, or the create-branch above assigned created.id. The
  // null-check below is unreachable but keeps TS happy without an
  // assertion operator.
  if (targetSeriesId == null) {
    throw new Error("targetSeriesId unexpectedly null after series resolution");
  }
  const seriesId: number = targetSeriesId;

  if (event.clinicalSeriesId !== seriesId) {
    await db.event.update({
      where: { id: event.eventId },
      data: { clinicalSeries: { connect: { id: seriesId } } },
    });
  }

  // Extend the series' date span so subsequent events get accurate distances.
  ctx?.touch(seriesId, eventDateDjs);

  return seriesId;
}

export async function syncClinicalSeriesForInternalEventId(
  eventId: number
): Promise<null | number> {
  const event = await loadEventSeriesCandidateByInternalId(eventId);
  if (!event) return null;
  const seriesId = await assignEventToSeries(event);
  if (seriesId != null) await refreshClinicalSeriesMetadata(seriesId);
  return seriesId;
}

export async function syncClinicalSeriesForEventIds(
  eventIds: number[],
  onProgress?: (processed: number, total: number) => void
) {
  const unique = [...new Set(eventIds.filter((value) => Number.isFinite(value) && value > 0))];
  if (unique.length === 0) return;
  const total = unique.length;

  // One query for all events + one query for all existing series — no per-event DB lookups.
  const [events, ctx] = await Promise.all([
    loadEventSeriesCandidatesByIds(unique),
    SeriesAssignmentContext.load(),
  ]);

  // Collect which series were touched so we can refresh metadata exactly once
  // per series at the end — eliminates redundant refreshes and race conditions
  // when the same series has multiple events in the batch.
  const touchedSeriesIds = new Set<number>();
  let processed = 0;

  // 8 concurrent workers sharing a queue — ~8x throughput vs serial processing.
  await runConcurrent(events, 8, async (event) => {
    const seriesId = await assignEventToSeries(event, ctx).catch(() => null);
    if (seriesId != null) touchedSeriesIds.add(seriesId);
    processed++;
    onProgress?.(processed, total);
  });

  // Refresh each touched series once, also concurrently.
  // Errors are isolated per series so one failure doesn't abort the rest.
  await runConcurrent([...touchedSeriesIds], 8, (id) =>
    refreshClinicalSeriesMetadata(id).catch((err: unknown) => {
      console.error(`[clinical-series] refreshClinicalSeriesMetadata(${id}) failed:`, err);
    })
  );
}

export async function syncClinicalSeriesForExternalEvents(
  events: Array<{ calendarId: string; eventId: string }>
) {
  for (const event of events) {
    const row = await loadEventSeriesCandidateByExternalIds(event.calendarId, event.eventId);
    if (!row) {
      continue;
    }
    await syncClinicalSeriesForInternalEventId(row.eventId);
  }
}

/**
 * Computes and persists the derived status for all clinical series based on
 * event schedule and series kind. Preserves CANCELLED status.
 *
 * Tests (PATCH_TEST, SKIN_TEST):
 *   PLANNED   → no events whose scheduled instant has started yet
 *   ACTIVE    → at least one event has started and there are future events pending
 *   COMPLETED → at least one event has started and no future events remain
 *
 * Subcutaneous treatment:
 *   PLANNED   → no events whose scheduled instant has started yet
 *   ACTIVE    → last started event ≤ 60 days ago
 *   INACTIVE  → last event 61–180 days ago
 *   COMPLETED → last started event > 180 days ago
 */
export async function updateAllSeriesStatuses(): Promise<{ updated: number }> {
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const now = dayjs().tz(TIMEZONE).toDate();
  const result = await db.$executeRaw`
    UPDATE clinical_series cs
    SET status = (
      -- Preserve manual CANCELLED
      CASE WHEN cs.status = 'CANCELLED' THEN 'CANCELLED'::\"ClinicalSeriesStatus\"
      ELSE (
        WITH event_dates AS (
          SELECT
            MAX(
              CASE
                WHEN COALESCE(
                  e.start_date_time AT TIME ZONE ${TIMEZONE},
                  e.start_date::timestamp AT TIME ZONE ${TIMEZONE}
                ) <= ${now}::timestamptz
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
              END
            ) AS last_past,
            MIN(
              CASE
                WHEN COALESCE(
                  e.start_date_time AT TIME ZONE ${TIMEZONE},
                  e.start_date::timestamp AT TIME ZONE ${TIMEZONE}
                ) > ${now}::timestamptz
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
              END
            ) AS next_future
          FROM events e
          WHERE e.clinical_series_id = cs.id
        )
        SELECT
          CASE cs.kind
            WHEN 'SUBCUTANEOUS_TREATMENT' THEN
              CASE
                WHEN (SELECT last_past FROM event_dates) IS NULL                                THEN 'PLANNED'
                WHEN (SELECT last_past FROM event_dates) >= (${today}::date - INTERVAL '60 days')  THEN 'ACTIVE'
                WHEN (SELECT last_past FROM event_dates) >= (${today}::date - INTERVAL '180 days') THEN 'INACTIVE'
                ELSE 'COMPLETED'
              END
            ELSE -- PATCH_TEST, SKIN_TEST
              CASE
                WHEN (SELECT last_past FROM event_dates) IS NULL                                THEN 'PLANNED'
                WHEN (SELECT next_future FROM event_dates) IS NOT NULL                          THEN 'ACTIVE'
                ELSE 'COMPLETED'
              END
          END::\"ClinicalSeriesStatus\"
        FROM event_dates
      )
      END
    )
  `;
  return { updated: result };
}

export async function rebuildClinicalSeries(
  params?: { autoMerge?: boolean; from?: string; to?: string },
  onProgress?: (processed: number, total: number) => void
) {
  const rows = await db.$queryRaw<Array<{ eventId: number }>>`
    SELECT e.id AS "eventId"
    FROM events e
    WHERE (
      e.category IN ('Test y exámenes', 'Tratamiento subcutáneo')
      OR e.clinical_series_id IS NOT NULL
    )
      AND (
        ${params?.from ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) >= ${params?.from ?? null}::date
      )
      AND (
        ${params?.to ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${params?.to ?? null}::date
      )
    ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) ASC, e.id ASC
  `;

  const total = rows.length;
  // Signal total is now known before processing starts
  onProgress?.(0, total);
  await syncClinicalSeriesForEventIds(
    rows.map((row) => row.eventId),
    onProgress
  );

  // Cleanup: delete series that ended up with no events after reassignment.
  const { count: deleted } = await db.clinicalSeries.deleteMany({
    where: { events: { none: {} } },
  });

  // Dedup pass: merge duplicates only when explicitly requested
  let deduped = 0;
  if (params?.autoMerge) {
    const duplicates = await detectDuplicateSeries();
    for (const dup of duplicates) {
      await mergeClinicalSeries({
        isAuto: true,
        mergeReason: dup.reason,
        sourceId: dup.sourceId,
        targetId: dup.targetId,
      });
    }
    deduped = duplicates.length;
  }

  // Update derived statuses for all series based on event dates.
  await updateAllSeriesStatuses();

  return {
    deleted,
    deduped,
    from: params?.from ?? null,
    processed: total,
    to: params?.to ?? null,
  };
}

// ─── Rebuild Job State (SSE progress) ────────────────────────────────────────
//
// `RebuildJob` interface, the live job singleton, and the read-only
// `getCurrentRebuildJob()` accessor live in
// `./clinical-series-rebuild-status.ts` so consumers that only need to
// observe progress (e.g. `app.ts`'s SSE endpoint) don't drag this
// 4.6k-LOC module into their type-check closure. This module mutates
// state via the imported `setRebuildJob` / `patchRebuildJob` /
// `clearRebuildJobAfter` helpers.

export function startRebuildClinicalSeries(params?: {
  autoMerge?: boolean;
  from?: string;
  to?: string;
}): string {
  const jobId = `rebuild-${Date.now()}`;
  setRebuildJob({
    jobId,
    status: "running",
    progress: 0,
    processed: 0,
    total: 0,
    currentStep: "Consultando eventos...",
    from: params?.from ?? null,
    to: params?.to ?? null,
  });

  rebuildClinicalSeries(params, (processed, total) => {
    patchRebuildJob(jobId, {
      processed,
      total,
      progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      currentStep:
        processed === 0
          ? `${total} eventos encontrados, reorganizando...`
          : `Reorganizando ${processed} de ${total}...`,
    });
  })
    .then((result) => {
      patchRebuildJob(jobId, {
        status: "completed",
        progress: 100,
        processed: result.processed,
        currentStep:
          result.deduped > 0
            ? `${result.processed} eventos procesados · ${result.deduped} serie${result.deduped !== 1 ? "s" : ""} fusionada${result.deduped !== 1 ? "s" : ""}`
            : `${result.processed} eventos procesados`,
      });
      clearRebuildJobAfter(jobId, 8000);
    })
    .catch((err: unknown) => {
      patchRebuildJob(jobId, {
        status: "failed",
        error: err instanceof Error ? err.message : "Error desconocido",
      });
      clearRebuildJobAfter(jobId, 8000);
    });

  return jobId;
}

export async function getClinicalSeriesSnapshotByExternalEvent(params: {
  calendarId: string;
  eventId: string;
}): Promise<ClinicalSeriesSnapshot | null> {
  const event = await loadEventSeriesCandidateByExternalIds(params.calendarId, params.eventId);
  if (!event?.clinicalSeriesId) {
    return null;
  }

  const series = await db.clinicalSeries.findUnique({
    where: { id: event.clinicalSeriesId },
    include: {
      events: {
        include: {
          calendar: {
            select: {
              googleId: true,
            },
          },
        },
        orderBy: [{ startDate: "asc" }, { startDateTime: "asc" }, { id: "asc" }],
      },
    },
  });

  // note: dosageValue and dosageUnit are included via the ORM (no extra selection needed)

  if (!series) {
    return null;
  }

  const linkedDocuments = await db.$queryRaw<ClinicalSeriesLinkedDocument[]>`
    SELECT DISTINCT ON (s.id)
      s.id AS "dteSaleDetailId",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    ORDER BY s.id, l.updated_at DESC
  `;

  const eventFolioRows = await db.$queryRaw<Array<{ eventId: number; folios: string[] }>>`
    SELECT l.event_id AS "eventId", ARRAY_AGG(s.folio ORDER BY s.document_date) AS "folios"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    GROUP BY l.event_id
  `;
  const foliosByEventId = new Map(eventFolioRows.map((r) => [r.eventId, r.folios]));
  const eventDocumentRows = await db.$queryRaw<
    Array<{ dteSaleDetailId: string; eventId: number; folio: string; totalAmount: number }>
  >`
    SELECT DISTINCT ON (l.event_id, s.id)
      l.event_id AS "eventId",
      s.id AS "dteSaleDetailId",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ${series.id}
      AND l.status != 'REJECTED'
    ORDER BY l.event_id, s.id, l.updated_at DESC
  `;
  const documentsByEventId = new Map<
    number,
    Array<{ dteSaleDetailId: string; folio: string; totalAmount: number }>
  >();
  for (const row of eventDocumentRows) {
    const documents = documentsByEventId.get(row.eventId) ?? [];
    documents.push({
      dteSaleDetailId: row.dteSaleDetailId,
      folio: row.folio,
      totalAmount: row.totalAmount,
    });
    documentsByEventId.set(row.eventId, documents);
  }
  const storedPatientPhones = normalizeStoredPhoneArray(series.patientPhones);
  const storedBeneficiaryPhones = normalizeStoredPhoneArray(series.beneficiaryPhones);
  const seriesPhones =
    storedPatientPhones.length > 0 || storedBeneficiaryPhones.length > 0
      ? {
          beneficiaryPhones: new Set(storedBeneficiaryPhones),
          patientPhones: new Set(storedPatientPhones),
        }
      : series.events.reduce(
          (acc, item) => {
            const extracted = extractSeriesPhones(item.summary ?? null, item.description ?? null);
            extracted.patientPhones.forEach((phone) => acc.patientPhones.add(phone));
            extracted.beneficiaryPhones.forEach((phone) => acc.beneficiaryPhones.add(phone));
            return acc;
          },
          { beneficiaryPhones: new Set<string>(), patientPhones: new Set<string>() }
        );

  const events = series.events.map((item) => ({
    amountExpected: item.amountExpected,
    amountPaid: item.amountPaid,
    beneficiaryName: item.beneficiaryName ?? null,
    beneficiaryRut: item.beneficiaryRut ?? null,
    calendarGoogleId: item.calendar.googleId,
    description: item.description ?? null,
    dosageUnit: item.dosageUnit ?? null,
    dosageValue: item.dosageValue ?? null,
    eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD"),
    eventTime:
      item.startDateTime != null
        ? dayjs(item.startDateTime).tz(TIMEZONE).format("HH:mm")
        : item.endDateTime != null
          ? dayjs(item.endDateTime).tz(TIMEZONE).format("HH:mm")
          : null,
    eventId: item.id,
    externalEventId: item.externalEventId,
    linkedDocuments: documentsByEventId.get(item.id) ?? [],
    linkedFolios: foliosByEventId.get(item.id) ?? [],
    patientName: item.patientName ?? null,
    patientRut: item.patientRut ?? null,
    seriesStageKind: (item.seriesStageKind as ClinicalSeriesStageKind | null) ?? null,
    seriesStageLabel: item.seriesStageLabel ?? null,
    seriesStageNumber: item.seriesStageNumber ?? null,
    summary: item.summary ?? null,
  }));

  const totalLinkedAmount = linkedDocuments.reduce((sum, item) => sum + item.totalAmount, 0);
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const dueEvents = events.filter((item) => isPastOrTodayEvent(item.eventDate, today));
  const totalExpectedDue = dueEvents.reduce((sum, item) => sum + (item.amountExpected ?? 0), 0);
  const totalPaidDue = dueEvents.reduce((sum, item) => sum + (item.amountPaid ?? 0), 0);
  const eventDates = events.map((item) => item.eventDate).sort();
  const startDate = eventDates[0] ?? dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const endDate = eventDates[eventDates.length - 1] ?? startDate;
  const eligibleDocumentDateFrom = dayjs
    .tz(startDate, TIMEZONE)
    .subtract(7, "day")
    .format("YYYY-MM-DD");
  const eligibleDocumentDateTo = dayjs
    .tz(endDate, TIMEZONE)
    .add(30, "day")
    .endOf("day")
    .isAfter(dayjs().tz(TIMEZONE))
    ? dayjs().tz(TIMEZONE).format("YYYY-MM-DD")
    : dayjs.tz(endDate, TIMEZONE).add(30, "day").format("YYYY-MM-DD");
  const inferredInsurance = inferHealthInsurance(
    series.events.map((item) => ({
      description: item.description ?? null,
      eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
        .tz(TIMEZONE)
        .format("YYYY-MM-DD"),
      eventId: item.id,
      summary: item.summary ?? null,
    }))
  );
  const resolvedHealthInsurance =
    (series.healthInsurance as HealthInsuranceType | null) ??
    inferredInsurance.healthInsurance ??
    null;
  const resolvedIsapreName = series.isapreName ?? inferredInsurance.isapreName ?? null;

  const baseSnapshot: ClinicalSeriesSnapshot = {
    allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
    abandonmentBucket: null,
    daysSinceLastEvent: null,
    vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
    healthInsurance: resolvedHealthInsurance,
    isapreName: resolvedIsapreName,
    deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
    beneficiaryName: series.beneficiaryName ?? null,
    beneficiaryPhones: [...seriesPhones.beneficiaryPhones],
    beneficiaryRut: series.beneficiaryRut ?? null,
    displayName: series.displayName ?? null,
    eligibleDocumentDateFrom,
    eligibleDocumentDateTo,
    events,
    id: series.id,
    kind: series.kind as ClinicalSeriesKind,
    lastAbandonmentContact: null,
    lastEventDate: null,
    linkedDocuments,
    nextEventDate: null,
    patientName: series.patientName ?? null,
    patientPhones: [...seriesPhones.patientPhones],
    patientRut: series.patientRut ?? null,
    remainingExpected: Math.max(0, totalExpectedDue - totalLinkedAmount),
    remainingPaid: Math.max(0, totalPaidDue - totalLinkedAmount),
    status: series.status as ClinicalSeriesSnapshot["status"],
    totalExpected: totalExpectedDue,
    totalLinkedAmount,
    totalPaid: totalPaidDue,
    upcomingCount: 0,
  };

  return {
    ...baseSnapshot,
    ...computeSnapshotTiming(baseSnapshot, today),
  };
}

export async function getClinicalSeriesSnapshotById(
  id: number
): Promise<ClinicalSeriesSnapshot | null> {
  const series = await db.clinicalSeries.findUnique({
    where: { id },
    include: {
      abandonmentContacts: {
        orderBy: { contactedAt: "desc" },
        take: 1,
        select: { contactedAt: true, outcome: true },
      },
      events: {
        include: {
          calendar: {
            select: {
              googleId: true,
            },
          },
        },
        orderBy: [{ startDate: "asc" }, { startDateTime: "asc" }, { id: "asc" }],
      },
    },
  });
  // dosageValue and dosageUnit are fetched as part of standard event fields via ORM

  if (!series) {
    return null;
  }

  const syntheticEvent = series.events[0];
  const today = dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
  const inferredInsurance = inferHealthInsurance(
    series.events.map((item) => ({
      description: item.description ?? null,
      eventDate: dayjs(item.startDate ?? item.startDateTime ?? item.endDate ?? item.endDateTime)
        .tz(TIMEZONE)
        .format("YYYY-MM-DD"),
      eventId: item.id,
      summary: item.summary ?? null,
    }))
  );
  const resolvedHealthInsurance =
    (series.healthInsurance as HealthInsuranceType | null) ??
    inferredInsurance.healthInsurance ??
    null;
  const resolvedIsapreName = series.isapreName ?? inferredInsurance.isapreName ?? null;
  const lastContact = series.abandonmentContacts[0] ?? null;
  const lastAbandonmentContact = lastContact
    ? { contactedAt: lastContact.contactedAt.toISOString(), outcome: lastContact.outcome }
    : null;

  if (!syntheticEvent) {
    return {
      allergenType: (series.allergenType as SubcutaneousAllergenType | null) ?? null,
      abandonmentBucket: null,
      beneficiaryName: series.beneficiaryName ?? null,
      beneficiaryPhones: normalizeStoredPhoneArray(series.beneficiaryPhones),
      beneficiaryRut: series.beneficiaryRut ?? null,
      daysSinceLastEvent: null,
      deliveryModality: (series.deliveryModality as DeliveryModality | null) ?? null,
      displayName: series.displayName ?? null,
      eligibleDocumentDateFrom: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      eligibleDocumentDateTo: dayjs().tz(TIMEZONE).format("YYYY-MM-DD"),
      events: [],
      healthInsurance: resolvedHealthInsurance,
      id: series.id,
      isapreName: resolvedIsapreName,
      kind: series.kind as ClinicalSeriesKind,
      lastAbandonmentContact,
      lastEventDate: null,
      linkedDocuments: [],
      nextEventDate: null,
      patientName: series.patientName ?? null,
      patientPhones: normalizeStoredPhoneArray(series.patientPhones),
      patientRut: series.patientRut ?? null,
      remainingExpected: 0,
      remainingPaid: 0,
      status: series.status as ClinicalSeriesSnapshot["status"],
      vaccineProduct: (series.vaccineProduct as SubcutaneousVaccineProduct | null) ?? null,
      totalExpected: 0,
      totalLinkedAmount: 0,
      totalPaid: 0,
      upcomingCount: 0,
    };
  }

  const snapshot = await getClinicalSeriesSnapshotByExternalEvent({
    calendarId: syntheticEvent.calendar.googleId,
    eventId: syntheticEvent.externalEventId,
  });
  if (!snapshot) return null;
  return {
    ...snapshot,
    ...computeSnapshotTiming(snapshot, today),
    lastAbandonmentContact,
  };
}

export async function listClinicalSeriesSnapshots(filters?: ClinicalSeriesFilters) {
  const {
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
  } = prepareClinicalSeriesFilters(filters);

  // Count total matching records (without pagination)
  const total = Number(
    (
      await sql<{ count: number }>`
        WITH event_stats AS (
          SELECT
            e.clinical_series_id AS series_id,
            MAX(
              CASE
                WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
                ELSE NULL
              END
            ) AS last_event_date,
            MIN(
              CASE
                WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
                THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
                ELSE NULL
              END
            ) AS next_event_date
          FROM events e
          WHERE e.clinical_series_id IS NOT NULL
          GROUP BY e.clinical_series_id
        )
        SELECT COUNT(*)::int AS count
        FROM clinical_series cs
        LEFT JOIN event_stats es ON es.series_id = cs.id
        WHERE (${normalizedBeneficiaryRut}::text IS NULL OR cs.beneficiary_rut = ${normalizedBeneficiaryRut})
          AND (${effectiveKind}::text IS NULL OR cs.kind::text = ${effectiveKind})
          AND (${effectiveStatus}::text IS NULL OR cs.status::text = ${effectiveStatus})
          AND (${effectiveHealthInsurance}::text IS NULL OR cs.health_insurance::text = ${effectiveHealthInsurance})
          AND ${isapreFilterSql}
          AND (${normalizedPatientRut}::text IS NULL OR cs.patient_rut = ${normalizedPatientRut})
          AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
          AND (${normalizedPatientPhone}::text IS NULL OR ${phoneFilterSql(normalizedPatientPhone)})
          AND (${lastVisitFrom}::date IS NULL OR es.last_event_date >= ${lastVisitFrom}::date)
          AND (${lastVisitTo}::date IS NULL OR es.last_event_date <= ${lastVisitTo}::date)
          AND (${nextVisitFrom}::date IS NULL OR es.next_event_date >= ${nextVisitFrom}::date)
          AND (${nextVisitTo}::date IS NULL OR es.next_event_date <= ${nextVisitTo}::date)
          AND ${queryFilterSql}
          AND ${abandonmentFilterSql}
          AND ${skinTestFilterSql}
      `.execute(kysely)
    ).rows[0]?.count ?? 0
  );

  const seriesResult = await sql<{ id: number }>`
    WITH event_stats AS (
      SELECT
        e.clinical_series_id AS series_id,
        MAX(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS last_event_date,
        MIN(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS next_event_date,
        COUNT(*)::int AS total_events,
        SUM(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
            THEN 1
            ELSE 0
          END
        )::int AS upcoming_events,
        COALESCE(SUM(e.amount_expected), 0)::float AS total_expected,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
              THEN e.amount_expected
              ELSE 0
            END
          ),
          0
        )::float AS total_expected_due
      FROM events e
      WHERE e.clinical_series_id IS NOT NULL
      GROUP BY e.clinical_series_id
    ),
    linked_totals AS (
      SELECT
        linked.series_id,
        COALESCE(SUM(linked.total_amount), 0)::float AS total_linked_amount
      FROM (
        SELECT DISTINCT ON (e.clinical_series_id, s.id)
          e.clinical_series_id AS series_id,
          COALESCE(s.total_amount, 0) AS total_amount
        FROM event_dte_sale_links l
        JOIN events e ON e.id = l.event_id
        JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
        WHERE e.clinical_series_id IS NOT NULL
        ORDER BY e.clinical_series_id, s.id, l.updated_at DESC
      ) AS linked
      GROUP BY linked.series_id
    )
    SELECT cs.id
    FROM clinical_series cs
    LEFT JOIN event_stats es ON es.series_id = cs.id
    LEFT JOIN linked_totals lt ON lt.series_id = cs.id
    WHERE (${normalizedBeneficiaryRut}::text IS NULL OR cs.beneficiary_rut = ${normalizedBeneficiaryRut})
      AND (${effectiveKind}::text IS NULL OR cs.kind::text = ${effectiveKind})
      AND (${effectiveStatus}::text IS NULL OR cs.status::text = ${effectiveStatus})
      AND (${effectiveHealthInsurance}::text IS NULL OR cs.health_insurance::text = ${effectiveHealthInsurance})
      AND ${isapreFilterSql}
      AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
      AND (${normalizedPatientRut}::text IS NULL OR cs.patient_rut = ${normalizedPatientRut})
      AND (${normalizedPatientPhone}::text IS NULL OR ${phoneFilterSql(normalizedPatientPhone)})
      AND (${lastVisitFrom}::date IS NULL OR es.last_event_date >= ${lastVisitFrom}::date)
      AND (${lastVisitTo}::date IS NULL OR es.last_event_date <= ${lastVisitTo}::date)
      AND (${nextVisitFrom}::date IS NULL OR es.next_event_date >= ${nextVisitFrom}::date)
      AND (${nextVisitTo}::date IS NULL OR es.next_event_date <= ${nextVisitTo}::date)
      AND ${queryFilterSql}
      AND ${abandonmentFilterSql}
      AND ${skinTestFilterSql}
    ORDER BY ${orderBy}
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `.execute(kysely);

  const series = seriesResult.rows;

  const items = (
    await Promise.all(series.map((item) => getClinicalSeriesSnapshotById(item.id)))
  ).filter((item): item is ClinicalSeriesSnapshot => item != null);

  return { items, page, pageSize, total };
}

export async function getClinicalSeriesInsuranceStats(
  filters?: ClinicalSeriesFilters
): Promise<ClinicalSeriesInsuranceStats> {
  const {
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
    phoneFilterSql,
    queryFilterSql,
    skinTestFilterSql,
    today,
  } = prepareClinicalSeriesFilters({
    ...filters,
    page: 1,
    pageSize: 100,
    view: "series",
  });

  const matchingSeries = await sql<{
    healthInsurance: HealthInsuranceType | null;
    id: number;
    isapreName: string | null;
  }>`
    WITH event_stats AS (
      SELECT
        e.clinical_series_id AS series_id,
        MAX(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS last_event_date,
        MIN(
          CASE
            WHEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
            THEN COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
            ELSE NULL
          END
        ) AS next_event_date
      FROM events e
      WHERE e.clinical_series_id IS NOT NULL
      GROUP BY e.clinical_series_id
    )
    SELECT
      cs.id,
      cs.health_insurance::text AS "healthInsurance",
      cs.isapre_name AS "isapreName"
    FROM clinical_series cs
    LEFT JOIN event_stats es ON es.series_id = cs.id
    WHERE (${normalizedBeneficiaryRut}::text IS NULL OR cs.beneficiary_rut = ${normalizedBeneficiaryRut})
      AND (${effectiveKind}::text IS NULL OR cs.kind::text = ${effectiveKind})
      AND (${effectiveStatus}::text IS NULL OR cs.status::text = ${effectiveStatus})
      AND (${effectiveHealthInsurance}::text IS NULL OR cs.health_insurance::text = ${effectiveHealthInsurance})
      AND ${isapreFilterSql}
      AND (${normalizedPatientName}::text IS NULL OR lower(coalesce(cs.patient_name, '')) LIKE ${normalizedPatientName})
      AND (${normalizedPatientRut}::text IS NULL OR cs.patient_rut = ${normalizedPatientRut})
      AND (${normalizedPatientPhone}::text IS NULL OR ${phoneFilterSql(normalizedPatientPhone)})
      AND (${lastVisitFrom}::date IS NULL OR es.last_event_date >= ${lastVisitFrom}::date)
      AND (${lastVisitTo}::date IS NULL OR es.last_event_date <= ${lastVisitTo}::date)
      AND (${nextVisitFrom}::date IS NULL OR es.next_event_date >= ${nextVisitFrom}::date)
      AND (${nextVisitTo}::date IS NULL OR es.next_event_date <= ${nextVisitTo}::date)
      AND ${queryFilterSql}
      AND ${abandonmentFilterSql}
      AND ${skinTestFilterSql}
  `.execute(kysely);

  const isapreProviders = new Map<string, number>();
  let fonasa = 0;
  let isapre = 0;
  let isapreUnidentified = 0;
  let particular = 0;
  let unidentified = 0;

  for (const row of matchingSeries.rows) {
    const storedHealthInsurance = row.healthInsurance ?? null;
    if (storedHealthInsurance === "FONASA") {
      fonasa += 1;
    } else if (storedHealthInsurance === "ISAPRE") {
      isapre += 1;
      if (row.isapreName) {
        isapreProviders.set(row.isapreName, (isapreProviders.get(row.isapreName) ?? 0) + 1);
      } else {
        isapreUnidentified += 1;
      }
    } else if (storedHealthInsurance === "PARTICULAR") {
      particular += 1;
    } else {
      unidentified += 1;
    }
  }

  return {
    fonasa,
    isapre,
    isapreProviders: [...isapreProviders.entries()]
      .map(([providerName, total]) => ({ providerName, total }))
      .sort((a, b) => b.total - a.total || a.providerName.localeCompare(b.providerName, "es")),
    isapreUnidentified,
    particular,
    total: matchingSeries.rows.length,
    unidentified,
  };
}

// ─── Duplicate Detection & Merge ─────────────────────────────────────────────

/**
 * Returns true only if the normalized name has at least 2 tokens that are NOT
 * in the clinical stopword list and are at least 3 characters long.
 * Prevents product/test names like "multitest aero" from matching as persons.
 */
function isLikelyPersonName(name: string): boolean {
  const normalized = normalizeName(name);
  const significantTokens = normalized
    .split(" ")
    .filter((t) => t.length >= 3 && !LOWERCASE_NAME_STOPWORDS.has(t));
  return significantTokens.length >= 2;
}

export interface ClinicalSeriesDuplicate {
  confidence: "high" | "medium";
  kind: ClinicalSeriesKind;
  patientName: null | string;
  reason: string;
  sourceEventCount: number;
  sourceId: number;
  sourcePatientName: null | string;
  sourcePatientRut: null | string;
  targetEventCount: number;
  targetId: number;
}

export async function detectDuplicateSeries(): Promise<ClinicalSeriesDuplicate[]> {
  // Fetch all series that have at least one event, ordered by id ASC so the
  // lower (older) id becomes the target and the higher (newer) becomes source.
  type SeriesRow = {
    beneficiaryName: null | string;
    beneficiaryPhones: unknown;
    beneficiaryRut: null | string;
    events?: Array<{ description: null | string; summary: null | string }>;
    id: number;
    kind: ClinicalSeriesKind;
    patientName: string | null;
    patientPhones: unknown;
    patientRut: string | null;
    _count: { events: number };
  };
  const allSeries: SeriesRow[] = await db.clinicalSeries.findMany({
    select: {
      beneficiaryName: true,
      beneficiaryPhones: true,
      beneficiaryRut: true,
      events: {
        select: {
          description: true,
          summary: true,
        },
      },
      id: true,
      kind: true,
      patientName: true,
      patientPhones: true,
      patientRut: true,
      _count: { select: { events: true } },
    },
    where: { events: { some: {} } },
    orderBy: { id: "asc" },
  });

  const results: ClinicalSeriesDuplicate[] = [];
  const usedAsSources = new Set<number>();

  const chooseCanonicalTarget = (group: SeriesRow[]): SeriesRow =>
    [...group].sort((a, b) => {
      const scoreDelta =
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: b.beneficiaryName,
          beneficiaryRut: b.beneficiaryRut,
          eventCount: b._count.events,
          patientName: b.patientName,
          patientRut: b.patientRut,
        }) -
        scoreClinicalSeriesIdentityQuality({
          beneficiaryName: a.beneficiaryName,
          beneficiaryRut: a.beneficiaryRut,
          eventCount: a._count.events,
          patientName: a.patientName,
          patientRut: a.patientRut,
        });
      if (scoreDelta !== 0) return scoreDelta;
      const eventDelta = b._count.events - a._count.events;
      if (eventDelta !== 0) return eventDelta;
      return a.id - b.id;
    })[0]!;

  // ── Pass 1: RUT-based grouping — O(n) ────────────────────────────────────
  // Group by (normalizedRut, beneficiaryRut, kind). Series with different
  // beneficiaryRuts serve different patients (e.g. family members under one
  // account) and must NOT be treated as duplicates.
  const rutGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientRut) continue;
    const key = `${normalizeRut(s.patientRut)}:${s.beneficiaryRut ?? ""}:${s.kind}`;
    const group = rutGroups.get(key);
    if (group) group.push(s);
    else rutGroups.set(key, [s]);
  }

  for (const group of rutGroups.values()) {
    if (group.length < 2) continue;
    const target = chooseCanonicalTarget(group);
    for (const src of group) {
      if (src.id === target.id) continue;
      results.push({
        confidence: "high",
        kind: target.kind,
        patientName: target.patientName,
        reason: `Mismo RUT de paciente (${target.patientRut})`,
        sourceEventCount: src._count.events,
        sourceId: src.id,
        sourcePatientName: src.patientName,
        sourcePatientRut: src.patientRut,
        targetEventCount: target._count.events,
        targetId: target.id,
      });
      usedAsSources.add(src.id);
    }
  }

  // ── Pass 2: name-based grouping — O(n) ───────────────────────────────────
  // Group by (normalizedName, kind), ignoring series already used as sources.
  // Only groups of exactly 2 are merged — 3+ with the same name are likely
  // different patients sharing a common name, so we leave them alone.
  const nameGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientName || usedAsSources.has(s.id)) continue;
    const normalized = normalizeName(s.patientName);
    if (!isLikelyPersonName(normalized)) continue;
    const key = `${normalized}:${s.kind}`;
    const group = nameGroups.get(key);
    if (group) group.push(s);
    else nameGroups.set(key, [s]);
  }

  for (const group of nameGroups.values()) {
    if (group.length !== 2) continue;
    const target = chooseCanonicalTarget(group);
    const src = group.find((series) => series.id !== target.id);
    if (!src) continue;
    if (hasHardPatientRutConflictForDuplicateDetection(target, src)) continue;
    if (hasConflictingPrimaryIdentity(target, src)) continue;
    results.push({
      confidence: "high",
      kind: target.kind,
      patientName: target.patientName,
      reason: `Mismo nombre de paciente (${target.patientName})`,
      sourceEventCount: src._count.events,
      sourceId: src.id,
      sourcePatientName: src.patientName,
      sourcePatientRut: src.patientRut,
      targetEventCount: target._count.events,
      targetId: target.id,
    });
    usedAsSources.add(src.id);
  }

  // ── Pass 3: phone + compatible-name grouping — O(n) over phone groups ────
  // This catches cases where one series is missing patient RUT and the name is
  // a subset/superset of the canonical name, but both series clearly share the
  // same patient phone and kind.
  const phoneGroups = new Map<string, SeriesRow[]>();
  for (const s of allSeries) {
    if (!s.patientName || usedAsSources.has(s.id)) continue;
    const phones = getSeriesPatientPhones(s);
    if (phones.length === 0) continue;
    for (const phone of phones) {
      const key = `${phone}:${s.kind}`;
      const group = phoneGroups.get(key);
      if (group) group.push(s);
      else phoneGroups.set(key, [s]);
    }
  }

  for (const group of phoneGroups.values()) {
    if (group.length !== 2) continue;
    const target = chooseCanonicalTarget(group);
    const src = group.find((series) => series.id !== target.id);
    if (!src) continue;
    if (usedAsSources.has(src.id)) continue;
    if (hasHardPatientRutConflictForDuplicateDetection(target, src)) continue;
    if (hasConflictingPrimaryIdentity(target, src)) continue;
    if (!haveCompatiblePatientNames(target.patientName, src.patientName)) continue;
    results.push({
      confidence: "medium",
      kind: target.kind,
      patientName: target.patientName,
      reason: `Mismo telefono de paciente y nombre compatible`,
      sourceEventCount: src._count.events,
      sourceId: src.id,
      sourcePatientName: src.patientName,
      sourcePatientRut: src.patientRut,
      targetEventCount: target._count.events,
      targetId: target.id,
    });
    usedAsSources.add(src.id);
  }

  return results;
}

export async function mergeClinicalSeries(params: {
  isAuto?: boolean;
  mergeReason?: string;
  mergedBy?: number;
  sourceId: number;
  targetId: number;
}): Promise<{ eventsMovedCount: number }> {
  const [source, target] = await Promise.all([
    db.clinicalSeries.findUnique({
      select: { id: true, kind: true },
      where: { id: params.sourceId },
    }),
    db.clinicalSeries.findUnique({
      select: { id: true, kind: true },
      where: { id: params.targetId },
    }),
  ]);

  if (!source) throw new Error(`Serie fuente #${params.sourceId} no encontrada`);
  if (!target) throw new Error(`Serie destino #${params.targetId} no encontrada`);
  if (source.kind !== target.kind) {
    throw new Error(
      `No se pueden fusionar series de distinto tipo (${source.kind} vs ${target.kind})`
    );
  }

  const eventsMovedCount = await db.$transaction(async (tx) => {
    const { count } = await tx.event.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });

    await tx.$executeRaw`
      INSERT INTO clinical_series_merge_log
        (source_id, target_id, events_moved, merged_by, merge_reason, is_auto)
      VALUES
        (${params.sourceId}, ${params.targetId}, ${count},
         ${params.mergedBy ?? null}, ${params.mergeReason ?? null}, ${params.isAuto ?? false})
    `;

    await tx.clinicalSeries.delete({ where: { id: params.sourceId } });

    return count;
  });

  await refreshClinicalSeriesMetadata(params.targetId);

  return { eventsMovedCount };
}

// ── Abandonment Contacts ────────────────────────────────────────────────────

export async function createAbandonmentContact(params: {
  seriesId: number;
  outcome: string;
  notes?: string;
  contactedById: number;
}) {
  const contact = await db.abandonmentContact.create({
    data: {
      seriesId: params.seriesId,
      outcome: params.outcome as never,
      notes: params.notes ?? null,
      contactedById: params.contactedById,
    },
    include: {
      contactedBy: {
        include: { person: { select: { names: true, fatherName: true } } },
      },
    },
  });

  const person = contact.contactedBy.person;
  return {
    id: Number(contact.id),
    seriesId: contact.seriesId,
    outcome: contact.outcome,
    notes: contact.notes,
    contactedById: contact.contactedById,
    contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
    contactedAt: contact.contactedAt.toISOString(),
  };
}

export async function listAbandonmentContacts(seriesId: number) {
  const contacts = await db.abandonmentContact.findMany({
    where: { seriesId },
    orderBy: { contactedAt: "desc" },
    include: {
      contactedBy: {
        include: { person: { select: { names: true, fatherName: true } } },
      },
    },
  });

  return {
    contacts: contacts.map((c) => {
      const person = c.contactedBy.person;
      return {
        id: Number(c.id),
        seriesId: c.seriesId,
        outcome: c.outcome,
        notes: c.notes,
        contactedById: c.contactedById,
        contactedByName: person ? `${person.names} ${person.fatherName ?? ""}`.trim() : null,
        contactedAt: c.contactedAt.toISOString(),
      };
    }),
  };
}
