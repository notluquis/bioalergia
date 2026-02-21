import { db } from "@finanzas/db";
import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { JWT } from "google-auth-library";
import { compileExcludePatterns, googleCalendarConfig } from "../../config";
import type { CalendarEventRecord } from "../../lib/google/google-calendar";
import {
  removeGoogleCalendarEvents,
  upsertGoogleCalendarEvents,
} from "../../lib/google/google-calendar-store";
import { parseCalendarMetadata } from "../../lib/parsers";

function isEventExcluded(
  summary: string | null | undefined,
  description: string | null | undefined,
  patterns: RegExp[],
): boolean {
  const text = `${summary ?? ""}\n${description ?? ""}`.toLowerCase();
  return patterns.some((regex) => regex.test(text));
}

type CalendarSyncDetails = {
  inserted: string[];
  updated: (string | { summary: string; changes: string[] })[];
  deleted: string[];
};

type CalendarSyncAccumulator = {
  details: CalendarSyncDetails;
  eventsFetched: number;
  fullSync: boolean;
  inserted: number;
  deleted: number;
  updated: number;
};

type ClassifiedCalendarItems = {
  toDelete: Array<{ calendarId: string; eventId: string; summary?: string }>;
  toUpsert: CalendarEventRecord[];
};

const createSyncAccumulator = (fullSync: boolean): CalendarSyncAccumulator => ({
  details: {
    inserted: [],
    updated: [],
    deleted: [],
  },
  eventsFetched: 0,
  fullSync,
  inserted: 0,
  deleted: 0,
  updated: 0,
});

function buildEventsListParams(args: {
  calendarId: string;
  pageToken: string | undefined;
  syncToken: string | null | undefined;
}) {
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: args.calendarId,
    pageToken: args.pageToken,
    singleEvents: true,
    maxResults: 2500,
  };

  if (args.syncToken) {
    params.syncToken = args.syncToken;
    return params;
  }

  params.timeMin = new Date(googleCalendarConfig?.syncStartDate ?? "2024-01-01").toISOString();
  const lookAheadDays = googleCalendarConfig?.syncLookAheadDays ?? 365;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + lookAheadDays);
  params.timeMax = endDate.toISOString();
  params.timeZone = googleCalendarConfig?.timeZone ?? "America/Santiago";
  return params;
}

function mapEventToUpsertRecord(
  calendarId: string,
  item: calendar_v3.Schema$Event,
): CalendarEventRecord {
  const metadata = parseCalendarMetadata({
    summary: item.summary ?? "",
    description: item.description ?? "",
  });

  let { amountExpected, amountPaid } = metadata;
  if (amountPaid != null && amountExpected == null) {
    amountExpected = amountPaid;
  }

  return {
    calendarId,
    eventId: item.id as string,
    status: item.status,
    eventType: item.eventType,
    summary: item.summary,
    description: item.description,
    start: item.start,
    end: item.end,
    created: item.created,
    updated: item.updated,
    colorId: item.colorId,
    location: item.location,
    transparency: item.transparency,
    visibility: item.visibility,
    hangoutLink: item.hangoutLink,
    category: metadata.category,
    amountExpected,
    amountPaid,
    attended: metadata.attended,
    dosageValue: metadata.dosageValue,
    dosageUnit: metadata.dosageUnit,
    treatmentStage: metadata.treatmentStage,
    controlIncluded: metadata.controlIncluded,
    isDomicilio: metadata.isDomicilio,
  };
}

function classifyCalendarItems(args: {
  calendarId: string;
  excludePatterns: RegExp[];
  items: calendar_v3.Schema$Event[];
}): ClassifiedCalendarItems {
  const toUpsert: CalendarEventRecord[] = [];
  const toDelete: Array<{ calendarId: string; eventId: string; summary?: string }> = [];

  for (const item of args.items) {
    if (!item.id) {
      continue;
    }

    if (isEventExcluded(item.summary, item.description, args.excludePatterns)) {
      toDelete.push({
        calendarId: args.calendarId,
        eventId: item.id,
        summary: item.summary ?? undefined,
      });
      continue;
    }

    if (item.status === "cancelled") {
      toDelete.push({
        calendarId: args.calendarId,
        eventId: item.id,
        summary: item.summary ?? undefined,
      });
      continue;
    }

    toUpsert.push(mapEventToUpsertRecord(args.calendarId, item));
  }

  return { toDelete, toUpsert };
}

function addDetailEntries<T>(target: T[], entries: T[]) {
  if (target.length >= 50 || entries.length === 0) {
    return;
  }
  const remaining = Math.max(50 - target.length, 0);
  target.push(...entries.slice(0, remaining));
}

/**
 * Service to handle Google Calendar synchronization
 * Uses syncToken for incremental updates and falls back to full sync on 410 errors.
 */
export class CalendarSyncService {
  private client: calendar_v3.Calendar | null = null;

  /**
   * Initialize authenticated Google Calendar client
   */
  private async getClient(): Promise<calendar_v3.Calendar> {
    if (this.client) {
      return this.client;
    }

    if (!googleCalendarConfig) {
      throw new Error("Google Calendar configuration is missing");
    }

    const auth = new JWT({
      email: googleCalendarConfig.serviceAccountEmail,
      key: googleCalendarConfig.privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });

    await auth.authorize();
    this.client = calendar({ version: "v3", auth });
    return this.client;
  }

  /**
   * Sync all calendars defined in config.
   * Aggregates results from all calendars.
   */
  async syncAll(): Promise<{
    inserted: number;
    updated: number;
    deleted: number;
    eventsFetched: number;
    details: {
      inserted: string[];
      updated: (string | { summary: string; changes: string[] })[];
      deleted: string[];
    };
  }> {
    if (!googleCalendarConfig) {
      throw new Error("Google Calendar configuration is missing");
    }

    const results = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      eventsFetched: 0,
      details: {
        inserted: [] as string[],
        updated: [] as (string | { summary: string; changes: string[] })[],
        deleted: [] as string[],
      },
    };

    for (const calendarId of googleCalendarConfig.calendarIds) {
      try {
        console.log(`[CalendarSync] Starting sync for ${calendarId}`);
        const result = await this.syncCalendar(calendarId);

        results.inserted += result.inserted;
        results.updated += result.updated;
        results.deleted += result.deleted;
        results.eventsFetched += result.eventsFetched;

        results.details.inserted.push(...result.details.inserted);
        results.details.updated.push(...result.details.updated);
        results.details.deleted.push(...result.details.deleted);
      } catch (error) {
        console.error(`[CalendarSync] Failed to sync calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    return results;
  }

  /**
   * Sync a specific calendar by Google ID.
   * Handles 410 Gone (invalid sync token) by clearing token and retrying fully.
   */
  async syncCalendar(calendarId: string): Promise<{
    inserted: number;
    updated: number;
    deleted: number;
    eventsFetched: number;
    fullSync: boolean;
    details: {
      inserted: string[];
      updated: (string | { summary: string; changes: string[] })[];
      deleted: string[];
    };
  }> {
    // 1. Get stored syncToken
    const storedCalendar = await db.calendar.findUnique({
      where: { googleId: calendarId },
      select: { syncToken: true },
    });

    const currentSyncToken = storedCalendar?.syncToken;

    try {
      return await this.performSync(calendarId, currentSyncToken);
    } catch (error: unknown) {
      // Handle 410 Gone: Sync token is invalid -> Clear token and retry full sync
      const errorCode =
        error instanceof Object && "code" in error ? (error as Record<string, unknown>).code : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorCode === 410 || errorMessage?.includes("410")) {
        console.warn(
          `[CalendarSync] 410 Gone for ${calendarId}. Clearing syncToken and retrying full sync.`,
        );
        await db.calendar.update({
          where: { googleId: calendarId },
          data: { syncToken: null },
        });
        // Recursive retry with null token
        return await this.performSync(calendarId, null);
      }
      throw error;
    }
  }

  /**
   * Internal sync execution loop handling pagination and syncToken
   */
  private async performSync(
    calendarId: string,
    syncToken: string | null | undefined,
  ): Promise<{
    inserted: number;
    updated: number;
    deleted: number;
    eventsFetched: number;
    fullSync: boolean;
    details: {
      inserted: string[];
      updated: (string | { summary: string; changes: string[] })[];
      deleted: string[];
    };
  }> {
    const client = await this.getClient();
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    const accumulator = createSyncAccumulator(!syncToken);
    const excludePatterns = compileExcludePatterns(
      googleCalendarConfig?.excludeSummarySources ?? [],
    );

    do {
      const params = buildEventsListParams({ calendarId, pageToken, syncToken });

      const response = await client.events.list(params);
      const items = response.data.items ?? [];
      accumulator.eventsFetched += items.length;

      const { toDelete, toUpsert } = classifyCalendarItems({
        calendarId,
        excludePatterns,
        items,
      });

      if (toUpsert.length > 0) {
        const result = await upsertGoogleCalendarEvents(toUpsert);
        accumulator.inserted += result.inserted;
        accumulator.updated += result.updated;
        addDetailEntries(accumulator.details.inserted, result.details.inserted);
        addDetailEntries(accumulator.details.updated, result.details.updated);
      }

      if (toDelete.length > 0) {
        const deletedSummaries = await removeGoogleCalendarEvents(toDelete);
        accumulator.deleted += toDelete.length;
        addDetailEntries(accumulator.details.deleted, deletedSummaries);
      }

      // Pagination
      pageToken = response.data.nextPageToken ?? undefined;

      // Capture next sync token from the LAST page
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (pageToken);

    // Save the new syncToken if we got one
    if (nextSyncToken) {
      await db.calendar.upsert({
        where: { googleId: calendarId },
        update: { syncToken: nextSyncToken },
        create: { googleId: calendarId, name: calendarId, syncToken: nextSyncToken },
      });
    }

    return {
      inserted: accumulator.inserted,
      updated: accumulator.updated,
      deleted: accumulator.deleted,
      eventsFetched: accumulator.eventsFetched,
      fullSync: accumulator.fullSync,
      details: accumulator.details,
    };
  }
}
export const calendarSyncService = new CalendarSyncService();
