import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
// Removed self-import
// import { CalendarEventRecord } from "./google-calendar";
import { db } from "@finanzas/db";
import { calendar, type calendar_v3 } from "@googleapis/calendar";
import dayjs from "dayjs";
import { JWT } from "google-auth-library";
import { compileExcludePatterns, googleCalendarConfig } from "../../config";
import { parseCalendarMetadata } from "../../modules/calendar/parsers";
import { loadSettings } from "../../services/settings";
import { logEvent, logWarn } from "../logger";
import { retryGoogleCall } from "./google-errors";
import { removeGoogleCalendarEvents, upsertGoogleCalendarEvents } from "./google-calendar-store";

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "google-calendar");

type CalendarClient = calendar_v3.Calendar;

export type CalendarEventRecord = {
  calendarId: string;
  eventId: string;
  status?: string | null;
  eventType?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: calendar_v3.Schema$EventDateTime | null;
  end?: calendar_v3.Schema$EventDateTime | null;
  created?: string | null;
  updated?: string | null;
  colorId?: string | null;
  location?: string | null;
  transparency?: string | null;
  visibility?: string | null;
  hangoutLink?: string | null;
  category?: string | null;
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  dosageValue?: number | null;
  dosageUnit?: string | null;
  treatmentStage?: string | null;
  controlIncluded?: boolean | null;
  isDomicilio?: boolean | null;
};

type CalendarRuntimeConfig = {
  timeZone: string;
  syncStartDate: string;
  syncLookAheadDays: number;
  excludeSummaryPatterns: RegExp[];
};

export type GoogleCalendarSyncPayload = {
  fetchedAt: string;
  timeMin: string;
  timeMax: string;
  timeZone: string;
  calendars: Array<{ calendarId: string; totalEvents: number }>;
  events: CalendarEventRecord[];
  excludedEvents: Array<{
    calendarId: string;
    eventId: string;
    summary?: string | null;
  }>;
};

export type SyncMetrics = {
  fetchDurationMs: number;
  upsertDurationMs: number;
  removeDurationMs: number;
  snapshotDurationMs: number;
  totalDurationMs: number;
};

// Google Calendar API request parameters for events.list()
type GoogleCalendarListParams = {
  calendarId: string;
  pageToken?: string;
  singleEvents: boolean;
  showDeleted: boolean;
  maxResults: number;
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  orderBy?: string;
  updatedMin?: string;
};

let cachedClient: CalendarClient | null = null;

function isEventExcluded(item: calendar_v3.Schema$Event, patterns: RegExp[]): boolean {
  const text = `${item.summary ?? ""}\n${item.description ?? ""}`.toLowerCase();
  return patterns.some((regex) => regex.test(text));
}

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

async function getCalendarClient(): Promise<CalendarClient> {
  if (!googleCalendarConfig) {
    throw new Error("Google Calendar config not available. Check environment variables.");
  }
  if (cachedClient) {
    return cachedClient;
  }

  const auth = new JWT({
    email: googleCalendarConfig.serviceAccountEmail,
    key: googleCalendarConfig.privateKey,
    scopes: CALENDAR_SCOPES,
  });

  await auth.authorize();
  cachedClient = calendar({ version: "v3", auth });
  return cachedClient;
}

type FetchRange = {
  timeMin: string;
  timeMax: string;
  timeZone: string;
  updatedMin?: string;
};

async function getRuntimeCalendarConfig(): Promise<CalendarRuntimeConfig> {
  if (!googleCalendarConfig) {
    throw new Error("Google Calendar config not available. Check environment variables.");
  }

  try {
    const settings = await loadSettings();
    const timeZone = settings.calendarTimeZone?.trim() || googleCalendarConfig.timeZone;
    const syncStart = settings.calendarSyncStart?.trim() || googleCalendarConfig.syncStartDate;
    const lookAheadRaw = Number(
      settings.calendarSyncLookaheadDays ?? googleCalendarConfig.syncLookAheadDays,
    );
    const syncLookAheadDays =
      Number.isFinite(lookAheadRaw) && lookAheadRaw > 0
        ? Math.min(Math.floor(lookAheadRaw), 1095)
        : googleCalendarConfig.syncLookAheadDays;
    const excludeSetting = (settings.calendarExcludeSummaries ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const sources = Array.from(
      new Set([...googleCalendarConfig.excludeSummarySources, ...excludeSetting]),
    );
    const excludeSummaryPatterns = compileExcludePatterns(sources);
    return {
      timeZone,
      syncStartDate: syncStart,
      syncLookAheadDays,
      excludeSummaryPatterns,
    };
  } catch {
    const excludeSummaryPatterns = compileExcludePatterns(
      googleCalendarConfig.excludeSummarySources,
    );
    return {
      timeZone: googleCalendarConfig.timeZone,
      syncStartDate: googleCalendarConfig.syncStartDate,
      syncLookAheadDays: googleCalendarConfig.syncLookAheadDays,
      excludeSummaryPatterns,
    };
  }
}

async function getLastSuccessfulSyncTime(): Promise<Date | null> {
  try {
    const last = await db.syncLog.findFirst({
      where: { status: "SUCCESS", fetchedAt: { not: null } },
      select: { fetchedAt: true },
      orderBy: { startedAt: "desc" },
    });
    return last?.fetchedAt ?? null;
  } catch (error) {
    logWarn("googleCalendar.lastSync.load_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function buildFetchRange(runtime: CalendarRuntimeConfig, lastFetchedAt: Date | null): FetchRange {
  const startDate = dayjs(runtime.syncStartDate);
  const configuredStart = startDate.isValid()
    ? startDate.startOf("day")
    : dayjs("2000-01-01").startOf("day");
  const safetyStart = lastFetchedAt ? dayjs(lastFetchedAt).subtract(5, "minute") : null;
  const effectiveStart = safetyStart?.isAfter(configuredStart)
    ? safetyStart.startOf("minute")
    : configuredStart;
  const endDate = dayjs().add(runtime.syncLookAheadDays, "day").add(1, "day").startOf("day");

  return {
    timeMin: effectiveStart.toISOString(),
    timeMax: endDate.toISOString(),
    timeZone: runtime.timeZone,
    updatedMin: safetyStart?.isAfter(configuredStart)
      ? safetyStart.startOf("minute").toISOString()
      : undefined,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy pagination logic
async function fetchCalendarEventsForId(
  client: CalendarClient,
  calendarId: string,
  range: FetchRange,
  patterns: RegExp[],
  syncToken?: string | null,
): Promise<{
  events: CalendarEventRecord[];
  excluded: Array<{
    calendarId: string;
    eventId: string;
    summary?: string | null;
  }>;
  nextSyncToken?: string;
}> {
  const events: CalendarEventRecord[] = [];
  const excluded: Array<{
    calendarId: string;
    eventId: string;
    summary?: string | null;
  }> = [];
  let pageToken: string | undefined;
  const MAX_PAGES = 100; // Safety guard to prevent infinite loop
  let pageCount = 0;
  let nextSyncToken: string | undefined;

  do {
    const requestParams: GoogleCalendarListParams = {
      calendarId,
      pageToken,
      singleEvents: true,
      showDeleted: true,
      maxResults: 2500,
    };

    // If we have a syncToken, use incremental sync (ignores timeMin/timeMax)
    if (syncToken) {
      requestParams.syncToken = syncToken;
    } else {
      // Full sync with time range
      requestParams.timeMin = range.timeMin;
      requestParams.timeMax = range.timeMax;
      requestParams.timeZone = range.timeZone;
      requestParams.orderBy = "startTime";
      if (range.updatedMin) {
        requestParams.updatedMin = range.updatedMin;
      }
    }

    const response = await retryGoogleCall(
      () => client.events.list(requestParams),
      { context: "calendar.events.list" },
    );

    const items = response.data.items ?? [];

    for (const item of items) {
      if (!item.id) {
        continue;
      }

      if (item.status === "cancelled") {
        excluded.push({ calendarId, eventId: item.id, summary: item.summary });
        continue;
      }

      if (isEventExcluded(item, patterns)) {
        excluded.push({ calendarId, eventId: item.id, summary: item.summary });
        continue;
      }

      const summary = item.summary ?? "";
      const description = item.description ?? "";
      const metadata = parseCalendarMetadata({ summary, description });
      let { amountExpected, amountPaid } = metadata;
      if (amountPaid != null && amountExpected == null) {
        amountExpected = amountPaid;
      }

      events.push({
        calendarId,
        eventId: item.id,
        status: item.status,
        eventType: item.eventType,
        summary: summary,
        description: description,
        start: item.start ?? null,
        end: item.end ?? null,
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
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;

    // Capture syncToken on last page
    if (!pageToken && response.data.nextSyncToken) {
      nextSyncToken = response.data.nextSyncToken;
    }

    pageCount++;

    // Safety guard: prevent infinite loop if API returns same pageToken
    if (pageCount >= MAX_PAGES) {
      logWarn("googleCalendar.fetch.maxPages", {
        calendarId,
        pageCount,
        message: "Reached maximum page limit, stopping pagination",
      });
      break;
    }
  } while (pageToken);

  return { events, excluded, nextSyncToken };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy sync logic
export async function fetchGoogleCalendarData(): Promise<GoogleCalendarSyncPayload> {
  if (!googleCalendarConfig) {
    throw new Error("Google Calendar config not available. Check environment variables.");
  }

  const client = await getCalendarClient();
  const runtime = await getRuntimeCalendarConfig();
  const lastFetchedAt = await getLastSuccessfulSyncTime();
  const range = buildFetchRange(runtime, lastFetchedAt);

  logEvent("googleCalendar.fetch.window", {
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    updatedMin: range.updatedMin ?? null,
    lastFetchedAt: lastFetchedAt?.toISOString() ?? null,
  });

  const events: CalendarEventRecord[] = [];
  const calendarsSummary: Array<{ calendarId: string; totalEvents: number }> = [];
  const excludedEvents: Array<{
    calendarId: string;
    eventId: string;
    summary?: string | null;
  }> = [];
  const syncTokensToSave: Record<string, string> = {};

  for (const calendarId of googleCalendarConfig.calendarIds) {
    try {
      // Get saved syncToken for this calendar
      const calendar = await db.calendar.findUnique({
        where: { googleId: calendarId },
        select: { syncToken: true },
      });
      const savedSyncToken = calendar?.syncToken;

      logEvent("googleCalendar.fetch.start", {
        calendarId,
        usingSyncToken: !!savedSyncToken,
        timeMin: savedSyncToken ? undefined : range.timeMin,
        timeMax: savedSyncToken ? undefined : range.timeMax,
      });

      const result = await fetchCalendarEventsForId(
        client,
        calendarId,
        range,
        runtime.excludeSummaryPatterns,
        savedSyncToken,
      );

      events.push(...result.events);
      excludedEvents.push(...result.excluded);
      calendarsSummary.push({ calendarId, totalEvents: result.events.length });

      // Save the new syncToken for next time
      if (result.nextSyncToken) {
        syncTokensToSave[calendarId] = result.nextSyncToken;
      }

      logEvent("googleCalendar.fetch.success", {
        calendarId,
        totalEvents: result.events.length,
        excluded: result.excluded.length,
        gotNewSyncToken: !!result.nextSyncToken,
      });
    } catch (error) {
      // TODO: Parse GaxiosError and retry 429/503 using retryAfterSeconds + exponential backoff.
      // If syncToken is invalid (e.g., expired), reset and do full sync
      if (error instanceof Error && error.message.includes("410")) {
        logWarn("googleCalendar.fetch.syncTokenExpired", {
          calendarId,
          message: "Sync token expired, performing full sync",
        });

        // Retry without syncToken
        try {
          const result = await fetchCalendarEventsForId(
            client,
            calendarId,
            range,
            runtime.excludeSummaryPatterns,
            null,
          );
          events.push(...result.events);
          excludedEvents.push(...result.excluded);
          calendarsSummary.push({
            calendarId,
            totalEvents: result.events.length,
          });
          if (result.nextSyncToken) {
            syncTokensToSave[calendarId] = result.nextSyncToken;
          }
        } catch (retryError) {
          logWarn("googleCalendar.fetch.error", {
            calendarId,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
        }
      } else {
        logWarn("googleCalendar.fetch.error", {
          calendarId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Save all new syncTokens
  for (const [calendarId, syncToken] of Object.entries(syncTokensToSave)) {
    try {
      await db.calendar.upsert({
        where: { googleId: calendarId },
        update: { syncToken },
        create: { googleId: calendarId, syncToken },
      });
    } catch (error) {
      logWarn("googleCalendar.syncToken.saveFailed", {
        calendarId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    timeZone: runtime.timeZone,
    calendars: calendarsSummary,
    events,
    excludedEvents,
  };
}

export async function persistGoogleCalendarSnapshot(payload: GoogleCalendarSyncPayload) {
  await ensureStorageDir();

  const timestamp = payload.fetchedAt.replace(/[:.]/g, "-");
  const snapshotPath = path.join(STORAGE_ROOT, `events-${timestamp}.json`);
  const latestPath = path.join(STORAGE_ROOT, "latest.json");

  const serialized = JSON.stringify(payload, null, 2);

  await fs.writeFile(snapshotPath, serialized, "utf8");
  await fs.writeFile(latestPath, serialized, "utf8");

  return { snapshotPath, latestPath };
}

export async function syncGoogleCalendarOnce() {
  const syncStart = performance.now();

  const fetchStart = performance.now();
  const payload = await fetchGoogleCalendarData();
  const fetchDurationMs = performance.now() - fetchStart;

  const upsertStart = performance.now();
  const upsertResult = await upsertGoogleCalendarEvents(payload.events);
  const upsertDurationMs = performance.now() - upsertStart;

  let removeDurationMs = 0;
  let deletedDetails: string[] = [];
  if (payload.excludedEvents.length) {
    const removeStart = performance.now();
    deletedDetails = await removeGoogleCalendarEvents(payload.excludedEvents);
    removeDurationMs = performance.now() - removeStart;
  }

  const snapshotStart = performance.now();
  const paths = await persistGoogleCalendarSnapshot(payload);
  const snapshotDurationMs = performance.now() - snapshotStart;

  const totalDurationMs = performance.now() - syncStart;

  return {
    payload,
    upsertResult,
    deletedDetails,
    ...paths,
    metrics: {
      fetchDurationMs,
      upsertDurationMs,
      removeDurationMs,
      snapshotDurationMs,
      totalDurationMs,
    } satisfies SyncMetrics,
  };
}
