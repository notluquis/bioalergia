import { db } from "@finanzas/db";

import type { CalendarEventRecord } from "../lib/google/google-calendar";

export async function loadSettings() {
  const settings = await db.setting.findMany();
  return settings.reduce(
    (acc: Record<string, string>, curr: { key: string; value: string | null }) => {
      acc[curr.key] = curr.value || "";
      return acc;
    },
    {} as Record<string, string>,
  );
}

export async function cleanupStaleSyncLogs(forceAll = false) {
  const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const staleDate = new Date(Date.now() - STALE_TIMEOUT_MS);

  // Find logs that need cleanup
  const where: NonNullable<Parameters<typeof db.calendarSyncLog.findMany>[0]>["where"] = {
    status: "RUNNING",
  };

  if (!forceAll) {
    where.startedAt = { lt: staleDate };
  }

  const staleLogs = await db.calendarSyncLog.findMany({
    where,
    select: { id: true, startedAt: true },
  });

  if (staleLogs.length === 0) return 0;

  console.warn(
    `⚠ Cleaning up ${staleLogs.length} stale/interrupted sync logs (forceAll=${forceAll})`,
  );

  // Update each log individually to calculate correct endedAt (timeout time)
  // This prevents logs from showing "Duration: 5 days" if visited days later
  await Promise.all(
    staleLogs.map((log) => {
      // If forceAll (startup), assume they just died now/recently or use startedAt + timeout?
      // Use startedAt + timeout is mostly correct for "it definitely died by then"
      const timeoutDate = new Date(log.startedAt.getTime() + STALE_TIMEOUT_MS);
      // Ensure we don't set a future date if forceAll is used very early (unlikely but safe)
      const endedAt = timeoutDate > new Date() ? new Date() : timeoutDate;

      return db.calendarSyncLog.update({
        where: { id: log.id },
        data: {
          status: "ERROR",
          errorMessage: forceAll
            ? "System restarted while sync was in progress"
            : "Sync timeout - automatically marked as stale",
          endedAt: endedAt,
        },
      });
    }),
  );

  return staleLogs.length;
}

export async function createCalendarSyncLogEntry(data: {
  triggerSource: string;
  triggerUserId?: number | null;
  triggerLabel?: string | null;
}) {
  // Check for existing running syncs
  const running = await db.calendarSyncLog.findFirst({
    where: { status: "RUNNING" },
  });

  if (running) {
    // Check if it's stale (> 15 minutes old) to avoid permanent lock
    const diff = Date.now() - running.startedAt.getTime();
    const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (increased to support large syncs)
    if (diff < STALE_TIMEOUT_MS) {
      throw new Error("Sincronización ya en curso");
    }
    // If stale (>15min), clean it up specifically
    console.warn(
      `⚠ Cleaning up stale sync log ${running.id} (${Math.round(diff / 1000 / 60)}min old)`,
    );
    await db.calendarSyncLog.update({
      where: { id: running.id },
      data: {
        status: "ERROR",
        errorMessage: `Sync timeout - marked as stale after ${Math.round(diff / 1000 / 60)} minutes`,
        endedAt: new Date(),
      },
    });
  }

  const log = await db.calendarSyncLog.create({
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
    changeDetails?: {
      inserted?: string[];
      updated?: (string | { summary: string; changes: string[] })[];
      excluded?: string[];
    };
  },
) {
  await db.calendarSyncLog.update({
    where: { id: id },
    data: {
      status: data.status,
      endedAt: new Date(),
      fetchedAt: data.fetchedAt,
      eventsSynced: (data.inserted || 0) + (data.updated || 0),
      inserted: data.inserted,
      updated: data.updated,
      skipped: data.skipped,
      excluded: data.excluded,
      errorMessage: data.errorMessage,
      changeDetails: data.changeDetails,
    },
  });
}

export async function listCalendarSyncLogs(
  limitOrOptions?:
    | number
    | {
        start?: Date;
        end?: Date;
        limit?: number;
      },
) {
  const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const { start, end, limit = 50 } = options || {};

  const where: NonNullable<Parameters<typeof db.calendarSyncLog.findMany>[0]>["where"] = {};
  if (start) {
    where.startedAt = { gte: start };
  }
  if (end) {
    where.startedAt = { lte: end };
  }

  // Cleanup: mark stale RUNNING syncs as ERROR before querying
  await cleanupStaleSyncLogs(false);

  const logs = await db.calendarSyncLog.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return logs;
}

type MissingFieldFilter = {
  category?: boolean;
  amountExpected?: boolean;
  amountPaid?: boolean;
  attended?: boolean;
  dosageValue?: boolean;
  treatmentStage?: boolean;
  /** Filter mode: AND requires all conditions, OR matches any (default: OR) */
  filterMode?: "AND" | "OR";
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy logic
export async function listUnclassifiedCalendarEvents(
  limit: number,
  offset: number = 0,
  filters?: MissingFieldFilter,
) {
  const filterMode = filters?.filterMode || "OR";

  // Build conditions based on filters
  const conditions: Record<string, unknown>[] = [];

  // Check if any field filters are actually selected (not just undefined)
  const hasFieldFilters = filters
    ? [
        filters.category,
        filters.amountExpected,
        filters.amountPaid,
        filters.attended,
        filters.dosageValue,
        filters.treatmentStage,
      ].some(Boolean)
    : false;

  // If no specific filters, default to show events missing ANY classifiable field
  if (!hasFieldFilters) {
    conditions.push(
      { category: null },
      { category: "" },
      { amountExpected: null },
      { attended: null, startDateTime: { lte: new Date() } },
    );
  } else {
    if (filters.category) {
      conditions.push({ OR: [{ category: null }, { category: "" }] });
    }
    if (filters.amountExpected) {
      conditions.push({ amountExpected: null });
    }
    if (filters.amountPaid) {
      conditions.push({ amountPaid: null });
    }
    if (filters.attended) {
      conditions.push({ attended: null, startDateTime: { lte: new Date() } });
    }
    // For dosage: events that are "Tratamiento subcutáneo" but missing dosage
    if (filters.dosageValue) {
      conditions.push({
        category: "Tratamiento subcutáneo",
        dosageValue: null,
      });
    }
    // For treatmentStage: events that are "Tratamiento subcutáneo" but missing stage
    if (filters.treatmentStage) {
      conditions.push({
        category: "Tratamiento subcutáneo",
        OR: [{ treatmentStage: null }, { treatmentStage: "" }],
      });
    }
  }

  // Build where clause based on filter mode
  let whereClause: Record<string, unknown> = {};

  // Optimize: Exclude ignored events at DB level to prevent empty pages
  // This mirrors IGNORE_PATTERNS from parsers.ts roughly
  const ignoreConditions = [
    { summary: { contains: "feriado", mode: "insensitive" } },
    { summary: { contains: "vacaciones", mode: "insensitive" } },
    { summary: { startsWith: "recordar", mode: "insensitive" } }, // Starts with Recordar
    { summary: { startsWith: "reunión", mode: "insensitive" } },
    { summary: { startsWith: "reunion", mode: "insensitive" } },
    { summary: { contains: "publicidad", mode: "insensitive" } },
    { summary: { equals: "reservado", mode: "insensitive" } },
    { summary: { equals: "elecciones", mode: "insensitive" } },
  ];

  if (conditions.length > 0) {
    if (filterMode === "AND") {
      whereClause = {
        AND: [...conditions, { NOT: ignoreConditions }],
      };
    } else {
      // OR mode: match ANY condition, BUT MUST NOT be ignored
      whereClause = {
        AND: [{ OR: conditions }, { NOT: ignoreConditions }],
      };
    }
  } else {
    // No specific filters, just standard view
    whereClause = {
      NOT: ignoreConditions,
    };
  }

  // ALWAYS exclude events before September 2024 (2024-09-01)
  // These old events should not appear as pending classification
  const cutoffDate = new Date("2024-09-01T00:00:00.000Z");

  if (Object.keys(whereClause).length === 0) {
    whereClause = { startDateTime: { gte: cutoffDate } };
  } else {
    whereClause = {
      AND: [whereClause, { startDateTime: { gte: cutoffDate } }],
    };
  }

  const [events, totalCount] = await Promise.all([
    db.event.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { startDateTime: "desc" },
      include: {
        calendar: {
          select: {
            id: true,
            googleId: true,
            name: true,
            syncToken: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.event.count({
      where: whereClause,
    }),
  ]);

  return { events, totalCount };
}

export type UnclassifiedEvent = Awaited<
  ReturnType<typeof listUnclassifiedCalendarEvents>
>["events"][number];

export async function updateCalendarEventClassification(
  calendarId: string, // Google Calendar ID (string)
  eventId: string, // Google Event ID
  data: {
    category?: string | null;
    amountExpected?: number | null;
    amountPaid?: number | null;
    attended?: boolean | null;
    dosageValue?: number | null;
    dosageUnit?: string | null;
    treatmentStage?: string | null;
    controlIncluded?: boolean | null;
    isDomicilio?: boolean | null;
  },
) {
  // ... (function body of createCalendarEvent moved out)
  // We need to find the internal Calendar ID first
  const calendar = await db.calendar.findUnique({
    where: { googleId: calendarId },
  });

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarId}`);
  }

  await db.event.update({
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
      dosageValue: data.dosageValue,
      dosageUnit: data.dosageUnit,
      treatmentStage: data.treatmentStage,
      controlIncluded: data.controlIncluded ?? undefined,
      isDomicilio: data.isDomicilio ?? undefined,
    },
  });
}

import type { EventCreateInput } from "../lib/db-types";

export async function createCalendarEvent(data: CalendarEventRecord) {
  // Look up internal calendar ID
  const calendar = await db.calendar.findUnique({
    where: { googleId: data.calendarId },
  });

  if (!calendar) {
    throw new Error(`Calendar not found for googleId: ${data.calendarId}`);
  }

  const createData: EventCreateInput = {
    calendarId: calendar.id,
    externalEventId: data.eventId,
    eventStatus: data.status, // Mapped status -> eventStatus
    eventType: data.eventType,
    summary: data.summary,
    description: data.description,
    startDate: data.start?.date ? new Date(data.start.date) : undefined,
    startDateTime: data.start?.dateTime ? new Date(data.start.dateTime) : undefined,
    startTimeZone: data.start?.timeZone,
    endDate: data.end?.date ? new Date(data.end.date) : undefined,
    endDateTime: data.end?.dateTime ? new Date(data.end.dateTime) : undefined,
    endTimeZone: data.end?.timeZone,
    eventCreatedAt: data.created ? new Date(data.created) : undefined,
    eventUpdatedAt: data.updated ? new Date(data.updated) : undefined,
    colorId: data.colorId,
    location: data.location,
    transparency: data.transparency,
    visibility: data.visibility,
    hangoutLink: data.hangoutLink,
    category: data.category,
    amountPaid: data.amountPaid || 0,
    dosageValue: data.dosageValue,
    dosageUnit: data.dosageUnit,
    controlIncluded: data.controlIncluded ?? false,
    isDomicilio: data.isDomicilio || false,
    lastSyncedAt: new Date(),
  };

  return db.event.create({
    data: createData,
  });
}

export { calendarSyncService } from "../modules/calendar/service";
