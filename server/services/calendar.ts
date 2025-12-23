import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

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
    // Check if it's stale (> 15 minutes old) to avoid permanent lock
    const diff = new Date().getTime() - running.startedAt.getTime();
    const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    if (diff < STALE_TIMEOUT_MS) {
      throw new Error("Sincronización ya en curso");
    }
    // If stale (>15min), mark as ERROR and proceed
    console.warn(`⚠ Cleaning up stale sync log ${running.id} (${Math.round(diff / 1000 / 60)}min old)`);
    await prisma.syncLog.update({
      where: { id: running.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        errorMessage: `Sync timeout - marked as stale after ${Math.round(diff / 1000 / 60)} minutes`,
      },
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

type MissingFieldFilter = {
  category?: boolean;
  amountExpected?: boolean;
  amountPaid?: boolean;
  attended?: boolean;
  dosage?: boolean;
  treatmentStage?: boolean;
};

export async function listUnclassifiedCalendarEvents(limit: number, offset: number = 0, filters?: MissingFieldFilter) {
  // Build OR conditions based on filters
  const orConditions: Prisma.EventWhereInput[] = [];

  // If no specific filters, default to show events missing ANY classifiable field
  if (!filters || Object.keys(filters).length === 0) {
    orConditions.push({ category: null }, { category: "" }, { amountExpected: null }, { attended: null });
  } else {
    if (filters.category) {
      orConditions.push({ category: null }, { category: "" });
    }
    if (filters.amountExpected) {
      orConditions.push({ amountExpected: null });
    }
    if (filters.amountPaid) {
      orConditions.push({ amountPaid: null });
    }
    if (filters.attended) {
      orConditions.push({ attended: null });
    }
    // For dosage: events that are "Tratamiento subcutáneo" but missing dosage
    if (filters.dosage) {
      orConditions.push({
        category: "Tratamiento subcutáneo",
        OR: [{ dosage: null }, { dosage: "" }],
      });
    }
    // For treatmentStage: events that are "Tratamiento subcutáneo" but missing stage
    if (filters.treatmentStage) {
      orConditions.push({
        category: "Tratamiento subcutáneo",
        OR: [{ treatmentStage: null }, { treatmentStage: "" }],
      });
    }
  }

  const whereClause = {
    OR: orConditions.length > 0 ? orConditions : undefined,
  };

  const [events, totalCount] = await Promise.all([
    prisma.event.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { startDateTime: "desc" },
      include: {
        calendar: true,
      },
    }),
    prisma.event.count({
      where: whereClause,
    }),
  ]);

  return { events, totalCount };
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
