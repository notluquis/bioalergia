import { dbClinicalSeries as db } from "@finanzas/db/slices";
import dayjs from "dayjs";

import { TIMEZONE } from "./constants.ts";

/**
 * Computes and persists the derived status for all clinical series
 * based on event schedule and series kind. Preserves CANCELLED status.
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
