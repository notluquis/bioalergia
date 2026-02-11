/**
 * Doctoralia Calendar API Client
 *
 * HTTP client for Docplanner Calendar API (docplanner.doctoralia.cl).
 * Uses bearer token authentication from login flow.
 */

import { request } from "gaxios";
import { getCalendarToken } from "./doctoralia-calendar-auth.js";
import type {
  DoctoraliaCalendarRequest,
  DoctoraliaCalendarResponse,
} from "./doctoralia-calendar-types.js";

const CALENDAR_API_BASE = "https://docplanner.doctoralia.cl/api";

/**
 * Make authenticated API request to calendar
 */
async function calendarApiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
  twoFactorCode?: string,
): Promise<T> {
  const token = await getCalendarToken(twoFactorCode);

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
        const { clearCalendarTokenCache } = await import("./doctoralia-calendar-auth.js");
        clearCalendarTokenCache();
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
 * @param twoFactorCode Optional 2FA code if required
 */
export async function getCalendarEvents(
  from: string,
  to: string,
  schedules: number[] = [],
  twoFactorCode?: string,
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
    twoFactorCode,
  );
}

/**
 * Get calendar events for current week
 */
export async function getThisWeekEvents(
  schedules: number[] = [],
  twoFactorCode?: string,
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

  return getCalendarEvents(from, to, schedules, twoFactorCode);
}

/**
 * Get calendar events for a specific date range (days)
 */
export async function getEventsForDays(
  startDate: Date,
  days: number,
  schedules: number[] = [],
  twoFactorCode?: string,
): Promise<DoctoraliaCalendarResponse> {
  const from = startDate.toISOString().split("T")[0];

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + days);
  endDate.setHours(23, 59, 59, 999);
  const to = endDate.toISOString();

  return getCalendarEvents(from, to, schedules, twoFactorCode);
}
