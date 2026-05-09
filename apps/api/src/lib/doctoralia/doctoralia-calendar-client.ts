/**
 * Doctoralia Calendar API Client
 *
 * HTTP client for Docplanner Calendar API (docplanner.doctoralia.cl).
 * Uses bearer token authentication from Doctoralia scraper cookie store (mkplAuth).
 */

import { db } from "@finanzas/db";
import { request } from "gaxios";
import type {
  DoctoraliaCalendarAlert,
  DoctoraliaCalendarRequest,
  DoctoraliaCalendarResponse,
} from "./doctoralia-calendar-types.ts";

const CALENDAR_API_BASE = "https://docplanner.doctoralia.cl/api";
const DEFAULT_COOKIES_LABEL = process.env.DOCTORALIA_SCRAPER_COOKIES_LABEL || "default";

type StoredCookie = {
  name: string;
  value: string;
};

let cachedBearer: null | { loadedAt: number; token: string } = null;
const TOKEN_CACHE_TTL_MS = 30_000;

function clearCachedCalendarToken() {
  cachedBearer = null;
}

function readStoredCookies(value: unknown): StoredCookie[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const name = candidate.name;
    const cookieValue = candidate.value;

    if (typeof name !== "string" || typeof cookieValue !== "string") {
      return [];
    }

    return [{ name, value: cookieValue }];
  });
}

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function extractBearerTokenFromMkplAuth(raw: string): null | string {
  const decoded = decodeCookieValue(raw).trim();
  const match = decoded.match(/^bearer\s+(.+)$/i);
  const token = (match ? match[1] : decoded).trim();
  return token.length > 0 ? token : null;
}

async function getCalendarToken(): Promise<string> {
  const now = Date.now();
  if (cachedBearer && now - cachedBearer.loadedAt < TOKEN_CACHE_TTL_MS) {
    return cachedBearer.token;
  }

  const store = await db.doctoraliaCookieStore.findUnique({
    where: { label: DEFAULT_COOKIES_LABEL },
    select: { cookiesJson: true },
  });

  const cookies = readStoredCookies(store?.cookiesJson);
  const mkplAuthCookie = cookies.find((cookie) => cookie.name === "mkplAuth");
  const token = mkplAuthCookie ? extractBearerTokenFromMkplAuth(mkplAuthCookie.value) : null;

  if (!token) {
    throw new Error(
      `Doctoralia scraper token not available (label=${DEFAULT_COOKIES_LABEL}). Update cookies in Doctoralia settings first.`,
    );
  }

  cachedBearer = { loadedAt: now, token };
  return token;
}

export async function hasCalendarApiToken(): Promise<boolean> {
  try {
    await getCalendarToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Make authenticated API request to calendar
 */
async function calendarApiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
): Promise<T> {
  const token = await getCalendarToken();

  try {
    const response = await request<T>({
      url: `${CALENDAR_API_BASE}${path}`,
      method,
      headers: {
        Authorization: `bearer ${token}`,
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      data,
    });

    return response.data;
  } catch (error) {
    // If 401, clear token cache and let caller retry
    if (error && typeof error === "object" && "response" in error) {
      const gaxError = error as { response?: { status?: number } };
      if (gaxError.response?.status === 401) {
        clearCachedCalendarToken();
      }
    }
    throw error;
  }
}

/**
 * Get calendar events for a date range
 *
 * @param from Start date (YYYY-MM-DD)
 * @param to End date (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD)
 * @param schedules Array of schedule IDs (empty = all schedules)
 */
export async function getCalendarEvents(
  from: string,
  to: string,
  schedules: number[] = [],
): Promise<DoctoraliaCalendarResponse> {
  const payload: DoctoraliaCalendarRequest = {
    from,
    to,
    schedules,
  };

  return calendarApiRequest<DoctoraliaCalendarResponse>(
    "POST",
    "/calendarevents",
    payload,
  );
}

/**
 * Get alerts feed (agenda notifications)
 *
 * alertType=3 corresponds to schedule/event alerts.
 */
export async function getCalendarAlerts(
  alertType = 3,
): Promise<DoctoraliaCalendarAlert[]> {
  const query = new URLSearchParams({ alertType: String(alertType) });
  return calendarApiRequest<DoctoraliaCalendarAlert[]>(
    "GET",
    `/alerts?${query.toString()}`,
    undefined,
  );
}

/**
 * Get calendar events for current week
 */
export async function getThisWeekEvents(
  schedules: number[] = [],
): Promise<DoctoraliaCalendarResponse> {
  // Get current week start (Monday) and end (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const from = monday.toISOString().split("T")[0];
  const to = sunday.toISOString();

  return getCalendarEvents(from, to, schedules);
}

/**
 * Get calendar events for a specific date range (days)
 */
export async function getEventsForDays(
  startDate: Date,
  days: number,
  schedules: number[] = [],
): Promise<DoctoraliaCalendarResponse> {
  const from = startDate.toISOString().split("T")[0];

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + days);
  endDate.setHours(23, 59, 59, 999);
  const to = endDate.toISOString();

  return getCalendarEvents(from, to, schedules);
}
