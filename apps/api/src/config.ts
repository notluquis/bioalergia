import { db } from "@finanzas/db";

export { db };

// Environment Variables
export const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
export const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
export const PORT = Number(process.env.PORT ?? 3000);

// Haulmer Config
export interface HaulmerEnvConfig {
  rut: string;
  email: string;
  password: string;
  workspaceId?: string;
}

const haulmerEnvMissing: string[] = [];
const haulmerRut = process.env.HAULMER_RUT;
if (!haulmerRut) {
  haulmerEnvMissing.push("HAULMER_RUT");
}

const haulmerEmail = process.env.HAULMER_EMAIL;
if (!haulmerEmail) {
  haulmerEnvMissing.push("HAULMER_EMAIL");
}

const haulmerPassword = process.env.HAULMER_PASSWORD;
if (!haulmerPassword) {
  haulmerEnvMissing.push("HAULMER_PASSWORD");
}

export const haulmerConfig: HaulmerEnvConfig | null =
  haulmerRut && haulmerEmail && haulmerPassword
    ? {
        rut: haulmerRut,
        email: haulmerEmail,
        password: haulmerPassword,
        workspaceId: process.env.HAULMER_WORKSPACE_ID,
      }
    : null;

if (haulmerEnvMissing.length > 0) {
  console.warn(
    `[config] Haulmer sync deshabilitado. Variables faltantes: ${haulmerEnvMissing.join(", ")}`,
  );
}

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
  if (!raw) {
    return null;
  }
  return raw.replace(/\\n/g, "\n");
}

function parseCalendarIds(raw?: string | null) {
  if (!raw) {
    return null;
  }
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
const syncLookAheadDaysParsed = Number(process.env.GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS ?? "365");
const syncLookAheadDays =
  Number.isFinite(syncLookAheadDaysParsed) && syncLookAheadDaysParsed > 0
    ? Math.floor(syncLookAheadDaysParsed)
    : 365;

export const googleCalendarConfig: GoogleCalendarConfig | null =
  googleServiceAccountEmail && googleServiceAccountPrivateKey && googleCalendarIds
    ? {
        serviceAccountEmail: googleServiceAccountEmail,
        privateKey: googleServiceAccountPrivateKey,
        calendarIds: googleCalendarIds,
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

// WhatsApp Config
export interface WhatsappConfig {
  accessToken: string;
  autoOptInOnInbound: boolean;
  phoneNumberId: string;
  graphApiVersion: string;
  templateName: string | null;
  templateLanguage: null | string;
  requireOptIn: boolean;
  appSecret: string | null;
  pollCron: string;
  imapHost: string | null;
  imapPort: number;
  imapUser: string | null;
  imapPass: string | null;
  imapMailbox: string;
  senderFilter: string;
}

const whatsappMissing: string[] = [];
const waAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
if (!waAccessToken) whatsappMissing.push("WHATSAPP_ACCESS_TOKEN");
const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
if (!waPhoneNumberId) whatsappMissing.push("WHATSAPP_PHONE_NUMBER_ID");

export const whatsappConfig: WhatsappConfig | null =
  waAccessToken && waPhoneNumberId
    ? {
        accessToken: waAccessToken,
        appSecret: process.env.WHATSAPP_APP_SECRET ?? null,
        autoOptInOnInbound: process.env.WHATSAPP_AUTO_OPT_IN_ON_INBOUND !== "false",
        graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0",
        imapHost: process.env.DOCTORALIA_IMAP_HOST ?? null,
        imapMailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
        imapPass: process.env.DOCTORALIA_IMAP_PASS ?? null,
        imapPort: parseInt(process.env.DOCTORALIA_IMAP_PORT ?? "993", 10),
        imapUser: process.env.DOCTORALIA_IMAP_USER ?? null,
        phoneNumberId: waPhoneNumberId,
        pollCron: process.env.WHATSAPP_POLL_CRON ?? "*/2 * * * *",
        requireOptIn: process.env.WHATSAPP_REQUIRE_OPT_IN !== "false",
        senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia",
        templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? null,
        templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? null,
      }
    : null;

if (whatsappMissing.length > 0) {
  console.warn(
    `[config] WhatsApp deshabilitado. Variables faltantes: ${whatsappMissing.join(", ")}`,
  );
}

// Doctoralia Scraper Config (bearer token compartido con el bot)
export const doctoraliaScraperApiToken: string | null =
  process.env.DOCTORALIA_SCRAPER_API_TOKEN?.trim() || null;

if (!doctoraliaScraperApiToken) {
  console.warn(
    "[config] Doctoralia scraper API deshabilitado. Variable faltante: DOCTORALIA_SCRAPER_API_TOKEN",
  );
}

// ChileExpress Config
export interface ChilexpressConfig {
  coverageApiKey: string;
  ratingApiKey: string;
  ordersApiKey: string;
  clientRut: string;
  originCoverageCode: string;
  sandbox: boolean;
}

const cxMissing: string[] = [];
const cxCoverageKey = process.env.CHILEXPRESS_API_KEY_COVERAGE;
if (!cxCoverageKey) cxMissing.push("CHILEXPRESS_API_KEY_COVERAGE");
const cxRatingKey = process.env.CHILEXPRESS_API_KEY_RATING;
if (!cxRatingKey) cxMissing.push("CHILEXPRESS_API_KEY_RATING");
const cxOrdersKey = process.env.CHILEXPRESS_API_KEY_ORDERS;
if (!cxOrdersKey) cxMissing.push("CHILEXPRESS_API_KEY_ORDERS");
const cxClientRut = process.env.CHILEXPRESS_TCC;
if (!cxClientRut) cxMissing.push("CHILEXPRESS_TCC");
const cxOriginCode = process.env.CHILEXPRESS_ORIGIN_COVERAGE_CODE;
if (!cxOriginCode) cxMissing.push("CHILEXPRESS_ORIGIN_COVERAGE_CODE");

export const chilexpressConfig: ChilexpressConfig | null =
  cxCoverageKey && cxRatingKey && cxOrdersKey && cxClientRut && cxOriginCode
    ? {
        coverageApiKey: cxCoverageKey,
        ratingApiKey: cxRatingKey,
        ordersApiKey: cxOrdersKey,
        clientRut: cxClientRut,
        originCoverageCode: cxOriginCode,
        sandbox: process.env.CHILEXPRESS_SANDBOX !== "false",
      }
    : null;

if (cxMissing.length > 0) {
  console.warn(
    `[config] ChileExpress deshabilitado. Variables faltantes: ${cxMissing.join(", ")}`,
  );
}
