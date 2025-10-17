import { promises as fs } from "fs";
import path from "path";
import { google, calendar_v3 } from "googleapis";
import dayjs from "dayjs";

import { googleCalendarConfig, compileExcludePatterns } from "../config.js";
import { logEvent, logWarn } from "./logger.js";
import { upsertGoogleCalendarEvents, removeGoogleCalendarEvents } from "./google-calendar-store.js";
import { loadSettings } from "../db.js";

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
  excludedEvents: Array<{ calendarId: string; eventId: string }>;
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

  const auth = new google.auth.JWT({
    email: googleCalendarConfig.serviceAccountEmail,
    key: googleCalendarConfig.privateKey,
    scopes: CALENDAR_SCOPES,
    subject: googleCalendarConfig.impersonateUser ?? undefined,
  });

  await auth.authorize();
  cachedClient = google.calendar({ version: "v3", auth });
  return cachedClient;
}

type FetchRange = {
  timeMin: string;
  timeMax: string;
  timeZone: string;
};

async function getRuntimeCalendarConfig(): Promise<CalendarRuntimeConfig> {
  if (!googleCalendarConfig) {
    throw new Error("Google Calendar config not available. Check environment variables.");
  }

  try {
    const settings = await loadSettings();
    const timeZone = settings.calendarTimeZone?.trim() || googleCalendarConfig.timeZone;
    const syncStart = settings.calendarSyncStart?.trim() || googleCalendarConfig.syncStartDate;
    const lookAheadRaw = Number(settings.calendarSyncLookaheadDays ?? googleCalendarConfig.syncLookAheadDays);
    const syncLookAheadDays = Number.isFinite(lookAheadRaw) && lookAheadRaw > 0
      ? Math.min(Math.floor(lookAheadRaw), 1095)
      : googleCalendarConfig.syncLookAheadDays;
    const excludeSetting = (settings.calendarExcludeSummaries ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const sources = Array.from(new Set([...googleCalendarConfig.excludeSummarySources, ...excludeSetting]));
    const excludeSummaryPatterns = compileExcludePatterns(sources);
    return { timeZone, syncStartDate: syncStart, syncLookAheadDays, excludeSummaryPatterns };
  } catch {
    const excludeSummaryPatterns = compileExcludePatterns(googleCalendarConfig.excludeSummarySources);
    return {
      timeZone: googleCalendarConfig.timeZone,
      syncStartDate: googleCalendarConfig.syncStartDate,
      syncLookAheadDays: googleCalendarConfig.syncLookAheadDays,
      excludeSummaryPatterns,
    };
  }
}

function buildFetchRange(runtime: CalendarRuntimeConfig): FetchRange {
  const startDate = dayjs(runtime.syncStartDate);
  const effectiveStart = startDate.isValid() ? startDate.startOf("day") : dayjs("2000-01-01").startOf("day");
  const endDate = dayjs().add(runtime.syncLookAheadDays, "day").add(1, "day").startOf("day");

  return {
    timeMin: effectiveStart.toISOString(),
    timeMax: endDate.toISOString(),
    timeZone: runtime.timeZone,
  };
}

async function fetchCalendarEventsForId(
  client: CalendarClient,
  calendarId: string,
  range: FetchRange,
  patterns: RegExp[]
): Promise<{ events: CalendarEventRecord[]; excluded: Array<{ calendarId: string; eventId: string }> }> {
  const events: CalendarEventRecord[] = [];
  const excluded: Array<{ calendarId: string; eventId: string }> = [];
  let pageToken: string | undefined;

  do {
    const response = await client.events.list({
      calendarId,
      pageToken,
      timeMin: range.timeMin,
      timeMax: range.timeMax,
      timeZone: range.timeZone,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const items = response.data.items ?? [];

    for (const item of items) {
      if (!item.id) {
        continue;
      }

      if (isEventExcluded(item, patterns)) {
        excluded.push({ calendarId, eventId: item.id });
        continue;
      }

      events.push({
        calendarId,
        eventId: item.id,
        status: item.status,
        eventType: item.eventType,
        summary: item.summary,
        description: item.description,
        start: item.start ?? null,
        end: item.end ?? null,
        created: item.created,
        updated: item.updated,
        colorId: item.colorId,
        location: item.location,
        transparency: item.transparency,
        visibility: item.visibility,
        hangoutLink: item.hangoutLink,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { events, excluded };
}

export async function fetchGoogleCalendarData(): Promise<GoogleCalendarSyncPayload> {
  if (!googleCalendarConfig) {
    throw new Error("Google Calendar config not available. Check environment variables.");
  }

  const client = await getCalendarClient();
  const runtime = await getRuntimeCalendarConfig();
  const range = buildFetchRange(runtime);

  const events: CalendarEventRecord[] = [];
  const calendarsSummary: Array<{ calendarId: string; totalEvents: number }> = [];
  const excludedEvents: Array<{ calendarId: string; eventId: string }> = [];

  for (const calendarId of googleCalendarConfig.calendarIds) {
    try {
      logEvent("googleCalendar.fetch.start", { calendarId, timeMin: range.timeMin, timeMax: range.timeMax });
      const result = await fetchCalendarEventsForId(client, calendarId, range, runtime.excludeSummaryPatterns);
      events.push(...result.events);
      excludedEvents.push(...result.excluded);
      calendarsSummary.push({ calendarId, totalEvents: result.events.length });
      logEvent("googleCalendar.fetch.success", {
        calendarId,
        totalEvents: result.events.length,
        excluded: result.excluded.length,
      });
    } catch (error) {
      logWarn("googleCalendar.fetch.error", {
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
  const payload = await fetchGoogleCalendarData();
  const upsertResult = await upsertGoogleCalendarEvents(payload.events);
  if (payload.excludedEvents.length) {
    await removeGoogleCalendarEvents(payload.excludedEvents);
  }
  const paths = await persistGoogleCalendarSnapshot(payload);
  return { payload, upsertResult, ...paths };
}
