import { dbClinicalSeries as db } from "@finanzas/db/slices";
import { sql } from "kysely";

import { TIMEZONE } from "../constants.ts";
import type { EventSeriesCandidate } from "../types.ts";

// Local Chile calendar date/time of the event. @db.Date start_date arrives as a
// bare day; @db.Timestamptz start_date_time is UTC and must be converted via
// AT TIME ZONE. These mirror the original raw SELECT exactly (snake_case
// physical columns inside the sql fragment).
const EVENT_DATE_SQL = sql<string>`
  COALESCE(
    to_char(e.start_date, 'YYYY-MM-DD'),
    to_char((e.start_date_time AT TIME ZONE ${sql.lit(TIMEZONE)})::date, 'YYYY-MM-DD')
  )
`;
const EVENT_TIME_SQL = sql<string | null>`
  to_char(e.start_date_time AT TIME ZONE ${sql.lit(TIMEZONE)}, 'HH24:MI')
`;

type CandidateTestMetadata = EventSeriesCandidate["testMetadata"];

const buildCandidateQuery = () =>
  db.$qb
    .selectFrom("Event as e")
    .innerJoin("Calendar as c", "c.id", "e.calendarId")
    .select([
      "e.id as eventId",
      "c.googleId as calendarGoogleId",
      "e.externalEventId as externalEventId",
      "e.patientName as patientName",
      "e.patientRut as patientRut",
      "e.beneficiaryName as beneficiaryName",
      "e.beneficiaryRut as beneficiaryRut",
      EVENT_DATE_SQL.as("eventDate"),
      EVENT_TIME_SQL.as("eventTime"),
      "e.summary as summary",
      "e.description as description",
      "e.category as category",
      "e.clinicalSeriesId as clinicalSeriesId",
      "e.seriesStageKind as seriesStageKind",
      "e.seriesStageLabel as seriesStageLabel",
      "e.seriesStageNumber as seriesStageNumber",
      "e.treatmentStage as treatmentStage",
      sql<CandidateTestMetadata>`e.test_metadata`.as("testMetadata"),
      "e.amountExpected as amountExpected",
      "e.amountPaid as amountPaid",
    ]);

export async function loadEventSeriesCandidateByInternalId(
  eventId: number
): Promise<EventSeriesCandidate | null> {
  const row = await buildCandidateQuery().where("e.id", "=", eventId).limit(1).executeTakeFirst();

  return (row as EventSeriesCandidate | undefined) ?? null;
}

export async function loadEventSeriesCandidateByExternalIds(
  calendarGoogleId: string,
  externalEventId: string
): Promise<EventSeriesCandidate | null> {
  const row = await buildCandidateQuery()
    .where("c.googleId", "=", calendarGoogleId)
    .where("e.externalEventId", "=", externalEventId)
    .limit(1)
    .executeTakeFirst();

  return (row as EventSeriesCandidate | undefined) ?? null;
}

export async function loadEventSeriesCandidatesByIds(
  eventIds: number[]
): Promise<EventSeriesCandidate[]> {
  if (eventIds.length === 0) return [];
  const rows = await buildCandidateQuery()
    .where("e.id", "in", eventIds)
    .orderBy("e.id", "asc")
    .execute();

  return rows as EventSeriesCandidate[];
}
