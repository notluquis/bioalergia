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
  if (events.length === 0) return { inserted: 0, updated: 0, skipped: 0 };

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    // Convertir googleId a ID interno de la BD
    const calendarInternalId = await getCalendarInternalId(event.calendarId);
    if (!calendarInternalId) {
      console.warn(`Skipping event ${event.eventId}: Could not resolve calendar ${event.calendarId}`);
      skipped++;
      continue;
    }

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
      // Usar upsert con la clave única compuesta [calendarId, externalEventId]
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

      // Para saber si fue insert o update, podríamos hacer un check previo,
      // pero por eficiencia asumimos que es update si ya existe
      // Por ahora incrementamos "updated" ya que upsert no nos dice cuál fue
      updated++;
    } catch (error) {
      console.error(`Error upserting event ${event.eventId}:`, error);
      skipped++;
    }
  }

  return { inserted, updated, skipped };
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
