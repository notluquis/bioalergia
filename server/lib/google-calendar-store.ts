import { prisma } from "./prisma.js";
import { CalendarEventRecord } from "./google-calendar.js";

// Cache para mapeo de googleId -> calendar.id (evita queries repetidas)
const calendarIdCache = new Map<string, number>();

async function getCalendarInternalId(googleId: string): Promise<number | null> {
  // Revisar cache primero
  if (calendarIdCache.has(googleId)) {
    return calendarIdCache.get(googleId)!;
  }

  try {
    // Buscar o crear el calendario en la BD
    const calendar = await prisma.calendar.upsert({
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

export async function upsertGoogleCalendarEvents(events: CalendarEventRecord[]) {
  if (events.length === 0) return { inserted: 0, updated: 0, skipped: 0, details: { inserted: [], updated: [] } };

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const insertedSummaries: string[] = [];
  const updatedSummaries: (string | { summary: string; changes: string[] })[] = [];

  for (const event of events) {
    // Convertir googleId a ID interno de la BD
    const calendarInternalId = await getCalendarInternalId(event.calendarId);
    if (!calendarInternalId) {
      console.warn(`Skipping event ${event.eventId}: Could not resolve calendar ${event.calendarId}`);
      skipped++;
      continue;
    }

    // Check if event already exists to distinguish insert vs update
    const existing = await prisma.event.findUnique({
      where: {
        calendarId_externalEventId: {
          calendarId: calendarInternalId,
          externalEventId: event.eventId,
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
      },
    });

    const data = {
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
      dosage: event.dosage,
      treatmentStage: event.treatmentStage,
      lastSyncedAt: new Date(),
    };

    try {
      await prisma.event.upsert({
        where: {
          calendarId_externalEventId: {
            calendarId: calendarInternalId,
            externalEventId: event.eventId,
          },
        },
        update: data,
        create: data,
      });

      // Build summary string for tracking
      const summaryText = event.summary?.slice(0, 50) || "(sin título)";

      if (existing) {
        updated++;
        if (updatedSummaries.length < 20) {
          const changes = computeEventDiff(existing, data);

          // Always push object structure for consistency in new logs
          // If no visible changes, changes array will be empty
          updatedSummaries.push({ summary: summaryText, changes });
        }
      } else {
        inserted++;
        if (insertedSummaries.length < 20) {
          insertedSummaries.push(summaryText);
        }
      }
    } catch (error) {
      console.error(
        `Error upserting event ${event.eventId} (calendar: ${event.calendarId}, summary: "${event.summary?.slice(0, 50)}"):`,
        {
          amountExpected: event.amountExpected,
          amountPaid: event.amountPaid,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      skipped++;
    }
  }

  return {
    inserted,
    updated,
    skipped,
    details: {
      inserted: insertedSummaries,
      updated: updatedSummaries,
    },
  };
}

export async function removeGoogleCalendarEvents(events: { calendarId: string; eventId: string }[]) {
  if (events.length === 0) return;

  for (const event of events) {
    const calendarInternalId = await getCalendarInternalId(event.calendarId);
    if (!calendarInternalId) {
      console.warn(`Cannot delete event ${event.eventId}: Could not resolve calendar ${event.calendarId}`);
      continue;
    }

    await prisma.event.deleteMany({
      where: {
        calendarId: calendarInternalId,
        externalEventId: event.eventId,
      },
    });
  }
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
}

function computeEventDiff(existing: DiffableEvent, incoming: DiffableEvent): string[] {
  const changes: string[] = [];

  const normalize = (val: unknown) => (val === null || val === undefined ? "" : String(val).trim());

  const diff = (label: string, oldVal: unknown, newVal: unknown) => {
    const o = normalize(oldVal);
    const n = normalize(newVal);
    if (o !== n) {
      // Truncate long values for log readability
      const shortO = o.length > 30 ? o.slice(0, 30) + "..." : o;
      const shortN = n.length > 30 ? n.slice(0, 30) + "..." : n;
      // Only log if there is actual content to show
      if (shortO || shortN) changes.push(`${label}: "${shortO}" -> "${shortN}"`);
    }
  };

  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");

  diff("Título", existing.summary, incoming.summary);
  diff("Desc", existing.description, incoming.description);
  diff("Lugar", existing.location, incoming.location);
  diff("Estado", existing.eventStatus, incoming.eventStatus);
  diff("Transparencia", existing.transparency, incoming.transparency);
  diff("Visibilidad", existing.visibility, incoming.visibility);

  // Compare unified times
  const oldStart = fmtDate(existing.startDateTime || existing.startDate);
  const newStart = fmtDate(incoming.startDateTime || incoming.startDate);
  if (oldStart !== newStart) changes.push(`Inicio: ${oldStart} -> ${newStart}`);

  const oldEnd = fmtDate(existing.endDateTime || existing.endDate);
  const newEnd = fmtDate(incoming.endDateTime || incoming.endDate);
  if (oldEnd !== newEnd) changes.push(`Fin: ${oldEnd} -> ${newEnd}`);

  return changes;
}
