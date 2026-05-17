import dayjs from "dayjs";
import { sql } from "kysely";

import { normalizeRut } from "../../../lib/rut.ts";

import { TIMEZONE } from "../constants.ts";
import { normalizeName } from "../normalization/names.ts";
import { normalizePhoneSearch } from "../normalization/phones.ts";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  HealthInsuranceType,
} from "../types.ts";

export type PreparedClinicalSeriesFilters = {
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

export function resolveClinicalSeriesOrderBy(
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

export function prepareClinicalSeriesFilters(
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

  // skinTest filter: EXISTS / NOT EXISTS correlated subquery on
  // clinical_skin_tests. Uses the indexed clinical_series_id FK —
  // no sequential scan.
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
