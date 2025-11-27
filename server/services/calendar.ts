import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export async function loadSettings() {
  const settings = await prisma.setting.findMany();
  return settings.reduce(
    (acc: Record<string, string>, curr: { key: string; value: string | null }) => {
      acc[curr.key] = curr.value || "";
      return acc;
    },
    {} as Record<string, string>
  );
}

export async function createCalendarSyncLogEntry(data: {
  triggerSource: string;
  triggerUserId?: number | null;
  triggerLabel?: string | null;
}) {
  // Check for existing running syncs
  const running = await prisma.syncLog.findFirst({
    where: { status: "RUNNING" },
  });

  if (running) {
    // Check if it's stale (e.g. > 10 minutes old) to avoid permanent lock
    const diff = new Date().getTime() - running.startedAt.getTime();
    if (diff < 10 * 60 * 1000) {
      throw new Error("Sincronización ya en curso");
    }
    // If stale, we could mark it as ERROR and proceed, or just proceed.
    // Let's mark it as ERROR to clean up.
    await prisma.syncLog.update({
      where: { id: running.id },
      data: { status: "ERROR", errorMessage: "Stale process detected and terminated" },
    });
  }

  const log = await prisma.syncLog.create({
    data: {
      triggerSource: data.triggerSource,
      triggerUserId: data.triggerUserId,
      triggerLabel: data.triggerLabel,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
  return Number(log.id);
}

export async function finalizeCalendarSyncLogEntry(
  id: number,
  data: {
    status: "SUCCESS" | "ERROR";
    fetchedAt?: Date;
    inserted?: number;
    updated?: number;
    skipped?: number;
    excluded?: number;
    errorMessage?: string;
  }
) {
  await prisma.syncLog.update({
    where: { id: BigInt(id) },
    data: {
      status: data.status,
      finishedAt: new Date(),
      fetchedAt: data.fetchedAt,
      inserted: data.inserted,
      updated: data.updated,
      skipped: data.skipped,
      excluded: data.excluded,
      errorMessage: data.errorMessage,
    },
  });
}

export async function listCalendarSyncLogs(limit: number) {
  const logs = await prisma.syncLog.findMany({
    take: limit,
    orderBy: { startedAt: "desc" },
  });
  return logs;
}

export type UnclassifiedEvent = Prisma.EventGetPayload<{
  include: {
    calendar: true;
  };
}>;

export async function listUnclassifiedCalendarEvents(limit: number) {
  // Unclassified: category is null or empty
  return await prisma.event.findMany({
    where: {
      OR: [{ category: null }, { category: "" }],
    },
    take: limit,
    orderBy: { startDateTime: "desc" },
    include: {
      calendar: true,
    },
  });
}

export async function updateCalendarEventClassification(
  calendarId: string, // Google Calendar ID (string)
  eventId: string, // Google Event ID
  data: {
    category?: string | null;
    amountExpected?: number | null;
    amountPaid?: number | null;
    attended?: boolean | null;
    dosage?: string | null;
    treatmentStage?: string | null;
  }
) {
  // We need to find the internal Calendar ID first
  const calendar = await prisma.calendar.findUnique({
    where: { googleId: calendarId },
  });

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarId}`);
  }

  // Now update the event
  // We use the composite unique key [calendarId, externalEventId]
  // But Prisma `update` requires a unique input.
  // Our schema has @@unique([calendarId, externalEventId])

  await prisma.event.update({
    where: {
      calendarId_externalEventId: {
        calendarId: calendar.id,
        externalEventId: eventId,
      },
    },
    data: {
      category: data.category,
      amountExpected: data.amountExpected,
      amountPaid: data.amountPaid,
      attended: data.attended,
      dosage: data.dosage,
      treatmentStage: data.treatmentStage,
    },
  });
}
