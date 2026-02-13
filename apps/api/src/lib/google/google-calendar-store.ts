import { db } from "@finanzas/db";

import type { CalendarEventRecord } from "./google-calendar";

// Cache para mapeo de googleId -> calendar.id (evita queries repetidas)
const calendarIdCache = new Map<string, number>();

async function getCalendarInternalId(googleId: string): Promise<number | null> {
  // Revisar cache primero
  if (calendarIdCache.has(googleId)) {
    const id = calendarIdCache.get(googleId);
    return id ?? null;
  }

  try {
    // Buscar o crear el calendario en la BD
    const calendar = await db.calendar.upsert({
      where: { googleId },
      update: {}, // No actualizamos nada si ya existe
      create: {
        googleId,
        name: googleId, // Por defecto usamos el googleId como nombre
      },
    });

    calendarIdCache.set(googleId, calendar.id);
    console.log(`✓ Calendar mapped: ${googleId} -> ID ${calendar.id}`);
    return calendar.id;
  } catch (error) {
    console.error(`✗ Failed to upsert calendar ${googleId}:`, error);
    return null;
  }
}

type UpsertStats = {
  inserted: number;
  insertedSummaries: string[];
  skipped: number;
  updated: number;
  updatedSummaries: Array<string | { summary: string; changes: string[] }>;
};

function buildEventUpsertData(event: CalendarEventRecord, calendarInternalId: number) {
  return {
    calendarId: calendarInternalId,
    externalEventId: event.eventId,
    eventStatus: event.status,
    eventType: event.eventType,
    summary: event.summary,
    description: event.description,
    startDate: event.start?.date ? new Date(event.start.date) : null,
    startDateTime: event.start?.dateTime ? new Date(event.start.dateTime) : null,
    startTimeZone: event.start?.timeZone,
    endDate: event.end?.date ? new Date(event.end.date) : null,
    endDateTime: event.end?.dateTime ? new Date(event.end.dateTime) : null,
    endTimeZone: event.end?.timeZone,
    eventCreatedAt: event.created ? new Date(event.created) : null,
    eventUpdatedAt: event.updated ? new Date(event.updated) : null,
    colorId: event.colorId,
    location: event.location,
    transparency: event.transparency,
    visibility: event.visibility,
    hangoutLink: event.hangoutLink,
    category: event.category,
    amountExpected: event.amountExpected,
    amountPaid: event.amountPaid,
    attended: event.attended,
    dosageValue: event.dosageValue,
    dosageUnit: event.dosageUnit,
    treatmentStage: event.treatmentStage,
    controlIncluded: event.controlIncluded ?? false,
    isDomicilio: event.isDomicilio ?? false,
    lastSyncedAt: new Date(),
  };
}

async function findExistingEvent(calendarInternalId: number, eventId: string) {
  return db.event.findUnique({
    where: {
      calendarId_externalEventId: {
        calendarId: calendarInternalId,
        externalEventId: eventId,
      },
    },
    select: {
      id: true,
      summary: true,
      description: true,
      location: true,
      eventStatus: true,
      startDateTime: true,
      startDate: true,
      endDateTime: true,
      endDate: true,
      transparency: true,
      visibility: true,
      category: true,
      amountExpected: true,
      amountPaid: true,
      attended: true,
      dosageValue: true,
      dosageUnit: true,
      treatmentStage: true,
      controlIncluded: true,
      isDomicilio: true,
    },
  });
}

async function processEventUpsert(
  event: CalendarEventRecord,
  calendarInternalId: number,
  stats: UpsertStats,
) {
  const data = buildEventUpsertData(event, calendarInternalId);

  try {
    const existing = await findExistingEvent(calendarInternalId, event.eventId);
    const summaryText = event.summary?.slice(0, 50) || "(sin título)";

    if (!existing) {
      await db.event.create({ data });
      stats.inserted += 1;
      if (stats.insertedSummaries.length < 20) {
        stats.insertedSummaries.push(summaryText);
      }
      return;
    }

    const changes = computeEventDiff(existing, data);
    if (changes.length === 0) {
      stats.skipped += 1;
      return;
    }

    await db.event.update({
      where: {
        calendarId_externalEventId: {
          calendarId: calendarInternalId,
          externalEventId: event.eventId,
        },
      },
      data,
    });
    stats.updated += 1;
    if (stats.updatedSummaries.length < 20) {
      stats.updatedSummaries.push({ summary: summaryText, changes });
    }
  } catch (error) {
    console.error(
      `Error upserting event ${event.eventId}:`,
      error instanceof Error ? error.message : String(error),
    );
    stats.skipped += 1;
  }
}

export async function upsertGoogleCalendarEvents(events: CalendarEventRecord[]) {
  if (events.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      details: { inserted: [], updated: [] },
    };
  }

  const stats: UpsertStats = {
    inserted: 0,
    insertedSummaries: [],
    skipped: 0,
    updated: 0,
    updatedSummaries: [],
  };

  // 1. Pre-resolve all calendars
  const distinctCalendarIds = Array.from(new Set(events.map((e) => e.calendarId)));

  // Ensure all calendars exist and cache their IDs
  for (const googleId of distinctCalendarIds) {
    if (!calendarIdCache.has(googleId)) {
      await getCalendarInternalId(googleId);
    }
  }

  // 2. Process in batches to avoid overwhelming the DB
  const BATCH_SIZE = 50;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    await Promise.all(
      batch.map(async (event) => {
        const calendarInternalId = calendarIdCache.get(event.calendarId);

        if (!calendarInternalId) {
          console.warn(
            `Skipping event ${event.eventId}: Could not resolve calendar ${event.calendarId}`,
          );
          stats.skipped += 1;
          return;
        }
        await processEventUpsert(event, calendarInternalId, stats);
      }),
    );
  }

  return {
    inserted: stats.inserted,
    updated: stats.updated,
    skipped: stats.skipped,
    details: {
      inserted: stats.insertedSummaries,
      updated: stats.updatedSummaries,
    },
  };
}

export async function removeGoogleCalendarEvents(
  events: { calendarId: string; eventId: string; summary?: string | null }[],
): Promise<string[]> {
  const deletedSummaries: string[] = [];
  if (events.length === 0) {
    return deletedSummaries;
  }

  for (const event of events) {
    const calendarInternalId = await getCalendarInternalId(event.calendarId);
    if (!calendarInternalId) {
      console.warn(
        `Cannot delete event ${event.eventId}: Could not resolve calendar ${event.calendarId}`,
      );
      continue;
    }

    // Try to get summary from event itself, or lookup in DB before deletion
    let summary = event.summary;
    if (!summary) {
      try {
        const existing = await db.event.findUnique({
          where: {
            calendarId_externalEventId: {
              calendarId: calendarInternalId,
              externalEventId: event.eventId,
            },
          },
          select: { summary: true },
        });
        summary = existing?.summary;
      } catch {
        // Ignore lookup errors
      }
    }

    try {
      await db.event.deleteMany({
        where: {
          calendarId: calendarInternalId,
          externalEventId: event.eventId,
        },
      });

      // Only add to list if we have space (limit 20 for logs)
      if (deletedSummaries.length < 20) {
        deletedSummaries.push(summary || "Evento eliminado (sin título)");
      }
    } catch (error) {
      console.error(`Error deleting event ${event.eventId}:`, error);
    }
  }

  return deletedSummaries;
}

/**
 * Helper to compute visible differences between existing and new event data.
 */
interface DiffableEvent {
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  eventStatus?: string | null;
  transparency?: string | null;
  visibility?: string | null;
  startDateTime?: Date | null;
  startDate?: Date | null;
  endDateTime?: Date | null;
  endDate?: Date | null;
  category?: string | null;
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  dosageValue?: number | null;
  dosageUnit?: string | null;
  treatmentStage?: string | null;
  controlIncluded?: boolean | null;
  isDomicilio?: boolean | null;
}

function computeEventDiff(existing: DiffableEvent, incoming: DiffableEvent): string[] {
  const changes: string[] = [];

  const normalize = (val: unknown) => (val === null || val === undefined ? "" : String(val).trim());

  const diff = (label: string, oldVal: unknown, newVal: unknown) => {
    const o = normalize(oldVal);
    const n = normalize(newVal);
    if (o !== n) {
      // Truncate long values for log readability
      const shortO = o.length > 30 ? `${o.slice(0, 30)}...` : o;
      const shortN = n.length > 30 ? `${n.slice(0, 30)}...` : n;
      // Only log if there is actual content to show
      if (shortO || shortN) {
        changes.push(`${label}: "${shortO}" -> "${shortN}"`);
      }
    }
  };

  const fmtDate = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 16).replace("T", " ") : "";

  // Google Calendar Fields
  diff("Título", existing.summary, incoming.summary);
  diff("Desc", existing.description, incoming.description);
  diff("Lugar", existing.location, incoming.location);
  diff("Estado", existing.eventStatus, incoming.eventStatus);
  diff("Transparencia", existing.transparency, incoming.transparency);
  diff("Visibilidad", existing.visibility, incoming.visibility);

  // Compare unified times
  const oldStart = fmtDate(existing.startDateTime || existing.startDate);
  const newStart = fmtDate(incoming.startDateTime || incoming.startDate);
  if (oldStart !== newStart) {
    changes.push(`Inicio: ${oldStart} -> ${newStart}`);
  }

  const oldEnd = fmtDate(existing.endDateTime || existing.endDate);
  const newEnd = fmtDate(incoming.endDateTime || incoming.endDate);
  if (oldEnd !== newEnd) {
    changes.push(`Fin: ${oldEnd} -> ${newEnd}`);
  }

  // Parsed/Classification Fields (really important to track!)
  diff("Categoría", existing.category, incoming.category);
  diff("Monto esperado", existing.amountExpected, incoming.amountExpected);
  diff("Monto pagado", existing.amountPaid, incoming.amountPaid);
  diff("Asistió", existing.attended, incoming.attended);
  diff("Dosis", existing.dosageValue, incoming.dosageValue);
  diff("Unidad dosis", existing.dosageUnit, incoming.dosageUnit);
  diff("Etapa tratamiento", existing.treatmentStage, incoming.treatmentStage);
  diff("Control incluido", existing.controlIncluded, incoming.controlIncluded);
  diff("Domicilio", existing.isDomicilio, incoming.isDomicilio);

  return changes;
}
