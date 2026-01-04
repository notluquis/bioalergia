import { db } from "@finanzas/db";

// Re-export db as prisma for compatibility
export const prisma = db;
export { db };

// Environment Variables
export const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
export const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
export const PORT = Number(process.env.PORT ?? 3000);

// Google Calendar Config
export type GoogleCalendarConfig = {
  serviceAccountEmail: string;
  privateKey: string;
  calendarIds: string[];
  timeZone: string;
  syncStartDate: string;
  syncLookAheadDays: number;
  excludeSummarySources: string[];
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

const EXCLUDE_PATTERNS_DEFAULT = [
  "no disponible",
  "cumpleaños",
  "almuerzo",
  "^\\s*$",
  "^\\d{1,2}\\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)",
];

export function compileExcludePatterns(values: string[]): RegExp[] {
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
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
);
if (!googleServiceAccountPrivateKey) {
  googleCalendarEnvMissing.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
}

const googleCalendarIds = parseCalendarIds(process.env.GOOGLE_CALENDAR_IDS);
if (!googleCalendarIds) {
  googleCalendarEnvMissing.push("GOOGLE_CALENDAR_IDS");
}

const syncStartDate = process.env.GOOGLE_CALENDAR_SYNC_START ?? "2000-01-01";
const syncLookAheadDaysParsed = Number(
  process.env.GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS ?? "365",
);
const syncLookAheadDays =
  Number.isFinite(syncLookAheadDaysParsed) && syncLookAheadDaysParsed > 0
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
        excludeSummarySources: EXCLUDE_PATTERNS_DEFAULT,
      }
    : null;

if (googleCalendarEnvMissing.length > 0) {
  console.warn(
    `[config] Google Calendar sync deshabilitado. Variables faltantes: ${googleCalendarEnvMissing.join(", ")}`,
  );
}
