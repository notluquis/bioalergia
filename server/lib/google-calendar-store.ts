import type { RowDataPacket } from "mysql2";

import { getPool } from "../db.js";
import { formatLocalDateForMySQL, normalizeTimestampForDb, normalizeTimestampString } from "./time.js";
import type { CalendarEventRecord } from "./google-calendar.js";

const LOOKUP_BATCH_SIZE = 200;
const INSERT_BATCH_SIZE = 100;

export type GoogleCalendarUpsertResult = {
  attempted: number;
  inserted: number;
  updated: number;
  skipped: number;
};

type ExistingEventRow = {
  event_id: string;
  event_updated_at: string | null;
};

type DateParts = {
  date: string | null;
  dateTime: string | null;
  timeZone: string | null;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function asDateParts(source?: CalendarEventRecord["start"]): DateParts {
  if (!source) {
    return { date: null, dateTime: null, timeZone: null };
  }

  const dateValue = source.date ?? null;
  const dateTimeNormalized = source.dateTime ? normalizeTimestampForDb(source.dateTime, null) : null;

  return {
    date: dateValue,
    dateTime: dateTimeNormalized || null,
    timeZone: source.timeZone ?? null,
  };
}

function normalizeIso(value?: string | null) {
  const normalized = normalizeTimestampString(value ?? null);
  return normalized || null;
}

export async function upsertGoogleCalendarEvents(
  events: CalendarEventRecord[]
): Promise<GoogleCalendarUpsertResult> {
  const result: GoogleCalendarUpsertResult = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  if (events.length === 0) {
    return result;
  }

  const pool = getPool();
  const nowDb = formatLocalDateForMySQL(new Date());

  const groupedByCalendar = new Map<string, CalendarEventRecord[]>();

  for (const event of events) {
    if (!event.eventId) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;
    const list = groupedByCalendar.get(event.calendarId);
    if (list) {
      list.push(event);
    } else {
      groupedByCalendar.set(event.calendarId, [event]);
    }
  }

  const insertSql = `
    INSERT INTO google_calendar_events (
      calendar_id,
      event_id,
      event_status,
      event_type,
      summary,
      description,
      start_date,
      start_date_time,
      start_time_zone,
      end_date,
      end_date_time,
      end_time_zone,
      event_created_at,
      event_updated_at,
      color_id,
      location,
      transparency,
      visibility,
      hangout_link,
      category,
      amount_expected,
      amount_paid,
      attended,
      dosage,
      treatment_stage,
      raw_event,
      last_synced_at
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      event_status = VALUES(event_status),
      event_type = VALUES(event_type),
      summary = VALUES(summary),
      description = VALUES(description),
      start_date = VALUES(start_date),
      start_date_time = VALUES(start_date_time),
      start_time_zone = VALUES(start_time_zone),
      end_date = VALUES(end_date),
      end_date_time = VALUES(end_date_time),
      end_time_zone = VALUES(end_time_zone),
      event_created_at = VALUES(event_created_at),
      event_updated_at = VALUES(event_updated_at),
      color_id = VALUES(color_id),
      location = VALUES(location),
      transparency = VALUES(transparency),
      visibility = VALUES(visibility),
      hangout_link = VALUES(hangout_link),
      category = VALUES(category),
      amount_expected = VALUES(amount_expected),
      amount_paid = VALUES(amount_paid),
      attended = VALUES(attended),
      dosage = VALUES(dosage),
      treatment_stage = VALUES(treatment_stage),
      raw_event = VALUES(raw_event),
      last_synced_at = VALUES(last_synced_at)
  `;

  for (const [calendarId, calendarEvents] of groupedByCalendar.entries()) {
    const lookupChunks = chunkArray(calendarEvents, LOOKUP_BATCH_SIZE);

    for (const chunk of lookupChunks) {
      const ids = Array.from(new Set(chunk.map((event) => event.eventId).filter(Boolean)));
      if (ids.length === 0) {
        continue;
      }

      const placeholders = ids.map(() => "?").join(", ");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT event_id, event_updated_at FROM google_calendar_events WHERE calendar_id = ? AND event_id IN (${placeholders})`,
        [calendarId, ...ids]
      );

      const existingMap = new Map<string, string | null>();
      for (const row of rows as ExistingEventRow[]) {
        const updatedIso = row.event_updated_at ? String(row.event_updated_at).replace(" ", "T") : null;
        existingMap.set(row.event_id, updatedIso);
      }

      const rowsToInsert: unknown[][] = [];

      for (const event of chunk) {
        const existingUpdatedIso = existingMap.get(event.eventId);
        const updatedIso = normalizeIso(event.updated ?? null) ?? normalizeIso(event.created ?? null);
        const createdIso = normalizeIso(event.created ?? null) ?? updatedIso;

        const isNew = existingUpdatedIso === undefined;
        const isModified = !isNew && (
          !existingUpdatedIso || (updatedIso != null && updatedIso > existingUpdatedIso)
        );

        if (!isNew && !isModified) {
          result.skipped += 1;
          continue;
        }

        const startParts = asDateParts(event.start ?? null);
        const endParts = asDateParts(event.end ?? null);

        const summary = event.summary ? event.summary.slice(0, 512) : null;
        const location = event.location ? event.location.slice(0, 512) : null;
        const hangoutLink = event.hangoutLink ? event.hangoutLink.slice(0, 512) : null;

        const eventCreatedDb = createdIso ? createdIso.replace("T", " ") : null;
        const eventUpdatedDb = updatedIso ? updatedIso.replace("T", " ") : null;

        rowsToInsert.push([
          calendarId,
          event.eventId,
          event.status ?? null,
          event.eventType ?? null,
          summary,
          event.description ?? null,
          startParts.date,
          startParts.dateTime,
          startParts.timeZone,
          endParts.date,
          endParts.dateTime,
          endParts.timeZone,
          eventCreatedDb,
          eventUpdatedDb,
          event.colorId ?? null,
          location,
          event.transparency ?? null,
          event.visibility ?? null,
          hangoutLink,
          event.category ?? null,
          event.amountExpected ?? null,
          event.amountPaid ?? null,
          event.attended == null ? null : event.attended ? 1 : 0,
          event.dosage ?? null,
          event.treatmentStage ?? null,
          JSON.stringify(event),
          nowDb,
        ]);

        if (isNew) {
          result.inserted += 1;
        } else {
          result.updated += 1;
        }
      }

      if (rowsToInsert.length === 0) {
        continue;
      }

      const insertChunks = chunkArray(rowsToInsert, INSERT_BATCH_SIZE);
      for (const insertChunk of insertChunks) {
        await pool.query(insertSql, [insertChunk]);
      }
    }
  }

  return result;
}

export async function removeGoogleCalendarEvents(entries: Array<{ calendarId: string; eventId: string }>) {
  if (!entries.length) return;
  const pool = getPool();
  const grouped = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.eventId) continue;
    const set = grouped.get(entry.calendarId) ?? new Set<string>();
    set.add(entry.eventId);
    grouped.set(entry.calendarId, set);
  }

  for (const [calendarId, ids] of grouped.entries()) {
    const idList = Array.from(ids);
    if (!idList.length) continue;
    const placeholders = idList.map(() => "?").join(", ");
    await pool.query(
      `DELETE FROM google_calendar_events WHERE calendar_id = ? AND event_id IN (${placeholders})`,
      [calendarId, ...idList]
    );
  }
}
