import { prisma } from "./prisma.js";
import { CalendarEventRecord } from "./google-calendar.js";

export async function upsertGoogleCalendarEvents(events: CalendarEventRecord[]) {
  if (events.length === 0) return { inserted: 0, updated: 0, skipped: 0 };

  let inserted = 0;
  let updated = 0;

  for (const event of events) {
    const data = {
      calendarId: event.calendarId,
      eventId: event.eventId,
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
    };

    // Using upsert. Note: We assume a unique compound key on [calendarId, eventId] or similar.
    // If not, we might need findFirst then update/create.
    // Given the schema is not fully visible, we'll try upsert with calendarId_eventId if it exists,
    // or just use deleteMany + create if we want to be lazy but safe (though less efficient).
    // Let's try findFirst then update/create to be safe against unknown unique constraints.

    const existing = await prisma.event.findFirst({
      where: {
        calendarId: parseInt(event.calendarId),
        externalEventId: event.eventId,
      },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      });
      updated++;
    } else {
      await prisma.event.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      });
      inserted++;
    }
  }

  return { inserted, updated, skipped: 0 };
}

export async function removeGoogleCalendarEvents(events: { calendarId: string; eventId: string }[]) {
  if (events.length === 0) return;

  for (const event of events) {
    await prisma.event.deleteMany({
      where: {
        calendarId: parseInt(event.calendarId),
        externalEventId: event.eventId,
      },
    });
  }
}
