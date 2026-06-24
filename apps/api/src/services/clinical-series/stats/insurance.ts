import { kysely } from "@finanzas/db";
import { sql } from "kysely";

import { TIMEZONE } from "../constants.ts";
import { prepareClinicalSeriesFilters } from "../snapshot/filters.ts";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesInsuranceStats,
  HealthInsuranceType,
} from "../types.ts";

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
