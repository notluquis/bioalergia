import { kysely } from "@finanzas/db";
import { sql } from "kysely";

import { TIMEZONE } from "../constants.ts";
import type { ClinicalSeriesFilters, ClinicalSeriesSnapshot } from "../types.ts";

import { getClinicalSeriesSnapshotById } from "./by-id.ts";
import { prepareClinicalSeriesFilters } from "./filters.ts";

export async function listClinicalSeriesSnapshots(filters?: ClinicalSeriesFilters): Promise<{
  items: ClinicalSeriesSnapshot[];
  page: number;
  pageSize: number;
  total: number;
}> {
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
