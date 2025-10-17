import { config } from "dotenv";
import type { CookieOptions } from "express";

// Cargar variables de entorno
config({ debug: false });

export const isProduction = process.env.NODE_ENV === "production";

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error("Debes definir JWT_SECRET en tu archivo .env");
}

export const JWT_SECRET = rawJwtSecret;
export const PORT = Number(process.env.PORT ?? 4000);
export const sessionCookieName = "mp_session";
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "lax" : "lax",
  maxAge: 2 * 24 * 60 * 60 * 1000,
  path: "/",
};

export type GoogleCalendarConfig = {
  serviceAccountEmail: string;
  privateKey: string;
  calendarIds: string[];
  timeZone: string;
  syncStartDate: string;
  syncLookAheadDays: number;
  impersonateUser?: string | null;
  excludeSummaryPatterns: RegExp[];
};

function normalizePrivateKey(raw?: string | null) {
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

function parseCalendarIds(raw?: string | null) {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

function parseExcludePatterns(raw?: string | null) {
  if (!raw) {
    return ["no disponible"]; // default placeholder blocker
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function compilePatterns(values: string[]): RegExp[] {
  const patterns = values.length ? values : ["no disponible"];
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return new RegExp(pattern.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i");
    }
  });
}

const googleCalendarEnvMissing: string[] = [];
const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
if (!googleServiceAccountEmail) {
  googleCalendarEnvMissing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
}

const googleServiceAccountPrivateKey = normalizePrivateKey(
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
);
if (!googleServiceAccountPrivateKey) {
  googleCalendarEnvMissing.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
}

const googleCalendarIds = parseCalendarIds(process.env.GOOGLE_CALENDAR_IDS);
if (!googleCalendarIds) {
  googleCalendarEnvMissing.push("GOOGLE_CALENDAR_IDS");
}

const syncStartDate = process.env.GOOGLE_CALENDAR_SYNC_START ?? "2000-01-01";
const syncLookAheadDaysParsed = Number(process.env.GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS ?? "365");
const syncLookAheadDays = Number.isFinite(syncLookAheadDaysParsed) && syncLookAheadDaysParsed > 0
  ? Math.floor(syncLookAheadDaysParsed)
  : 365;

const excludePatternsRaw = compilePatterns(parseExcludePatterns(process.env.GOOGLE_CALENDAR_EXCLUDE_SUMMARIES ?? null));

export const googleCalendarConfig: GoogleCalendarConfig | null =
  googleCalendarEnvMissing.length === 0
    ? {
        serviceAccountEmail: googleServiceAccountEmail!,
        privateKey: googleServiceAccountPrivateKey!,
        calendarIds: googleCalendarIds!,
        timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Santiago",
        syncStartDate,
        syncLookAheadDays,
        impersonateUser: process.env.GOOGLE_CALENDAR_IMPERSONATE_USER ?? null,
        excludeSummaryPatterns: excludePatternsRaw,
      }
    : null;

if (googleCalendarEnvMissing.length > 0) {
  console.warn(
    `[config] Google Calendar sync deshabilitado. Variables faltantes: ${googleCalendarEnvMissing.join(", ")}`
  );
}
