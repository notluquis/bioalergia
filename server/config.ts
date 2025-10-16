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
  maxAge: 7 * 24 * 60 * 60 * 1000,
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
      }
    : null;

if (googleCalendarEnvMissing.length > 0) {
  console.warn(
    `[config] Google Calendar sync deshabilitado. Variables faltantes: ${googleCalendarEnvMissing.join(", ")}`
  );
}
