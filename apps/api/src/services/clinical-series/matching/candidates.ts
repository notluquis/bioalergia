import { db } from "@finanzas/db";

import { TIMEZONE } from "../constants.ts";
import type { EventSeriesCandidate } from "../types.ts";

export async function loadEventSeriesCandidateByInternalId(
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

export async function loadEventSeriesCandidateByExternalIds(
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

export async function loadEventSeriesCandidatesByIds(
  eventIds: number[]
): Promise<EventSeriesCandidate[]> {
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
