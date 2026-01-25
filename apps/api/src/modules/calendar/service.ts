import { db } from "@finanzas/db";
import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { JWT } from "google-auth-library";
import { compileExcludePatterns, googleCalendarConfig } from "../../config";
import type { CalendarEventRecord } from "../../lib/google/google-calendar";
import {
  removeGoogleCalendarEvents,
  upsertGoogleCalendarEvents,
} from "../../lib/google/google-calendar-store";
import { parseCalendarMetadata } from "../../modules/calendar/parsers";

function isEventExcluded(
  summary: string | null | undefined,
  description: string | null | undefined,
  patterns: RegExp[],
): boolean {
  const text = `${summary ?? ""}\n${description ?? ""}`.toLowerCase();
  return patterns.some((regex) => regex.test(text));
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
    if (this.client) return this.client;

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
      // biome-ignore lint/suspicious/noExplicitAny: catch error
    } catch (error: any) {
      // Handle 410 Gone: Sync token is invalid -> Clear token and retry full sync
      if (error.code === 410 || error.message?.includes("410")) {
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy sync logic
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

    // Config for full sync (fallback)
    // Note: We ignore timeMin/timeMax if syncToken is present per Google API specs
    const timeZone = googleCalendarConfig?.timeZone ?? "America/Santiago";

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    let totalFetched = 0;
    const isFullSync = !syncToken;

    const details = {
      inserted: [] as string[],
      updated: [] as (string | { summary: string; changes: string[] })[],
      deleted: [] as string[],
    };

    do {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        pageToken,
        singleEvents: true, // Expand recurring events
        maxResults: 2500, // Maximize page size
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        // Full Sync Params if no token
        // Fallback to "syncStartDate" from config if doing full sync
        // NOTE: Incremental sync (with token) ignores these date ranges!
        params.timeMin = new Date(
          googleCalendarConfig?.syncStartDate ?? "2024-01-01",
        ).toISOString();
        // Lookahead
        const lookAheadDays = googleCalendarConfig?.syncLookAheadDays ?? 365;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + lookAheadDays);
        params.timeMax = endDate.toISOString();
        params.timeZone = timeZone;
      }

      const response = await client.events.list(params);
      const items = response.data.items ?? [];
      totalFetched += items.length;

      // Classify items into Upsert (Active) vs Delete (Cancelled)
      const toUpsert: CalendarEventRecord[] = [];
      const toDelete: { calendarId: string; eventId: string; summary?: string }[] = [];

      const excludePatterns = compileExcludePatterns(
        googleCalendarConfig?.excludeSummarySources ?? [],
      );

      for (const item of items) {
        if (!item.id) continue;

        // Check exclusion patterns
        if (isEventExcluded(item.summary, item.description, excludePatterns)) {
          // Treat excluded events as "to delete" if they exist in DB?
          // Legacy behavior: "excludedEvents" are passed to "removeGoogleCalendarEvents".
          toDelete.push({
            calendarId,
            eventId: item.id,
            summary: item.summary ?? undefined,
          });
          continue;
        }

        if (item.status === "cancelled") {
          toDelete.push({
            calendarId,
            eventId: item.id,
            summary: item.summary ?? undefined,
          });
        } else {
          // Parse metadata for parsed fields
          const metadata = parseCalendarMetadata({
            summary: item.summary ?? "",
            description: item.description ?? "",
          });

          // Fallback logic for amountExpected
          let { amountExpected, amountPaid } = metadata;
          if (amountPaid != null && amountExpected == null) {
            amountExpected = amountPaid;
          }

          toUpsert.push({
            calendarId,
            eventId: item.id,
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
            dosage: metadata.dosage,
            treatmentStage: metadata.treatmentStage,
            controlIncluded: metadata.controlIncluded,
          });
        }
      }

      // Execute DB Operations re-using Store Logic
      if (toUpsert.length > 0) {
        const result = await upsertGoogleCalendarEvents(toUpsert);
        totalInserted += result.inserted;
        totalUpdated += result.updated;

        // Aggregate details
        if (details.inserted.length < 50) {
          details.inserted.push(...result.details.inserted);
        }
        if (details.updated.length < 50) {
          details.updated.push(...result.details.updated);
        }
      }

      if (toDelete.length > 0) {
        const deletedSummaries = await removeGoogleCalendarEvents(toDelete);
        totalDeleted += toDelete.length;
        if (details.deleted.length < 50) {
          details.deleted.push(...deletedSummaries);
        }
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
      inserted: totalInserted,
      updated: totalUpdated,
      deleted: totalDeleted,
      eventsFetched: totalFetched,
      fullSync: isFullSync,
      details,
    };
  }
}
export const calendarSyncService = new CalendarSyncService();
