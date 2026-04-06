/**
 * Import historical Doctoralia booking emails from one or more IMAP accounts.
 *
 * Usage:
 *   tsx src/scripts/import-doctoralia-history.ts
 *   tsx src/scripts/import-doctoralia-history.ts --since 2025-01-01
 *   tsx src/scripts/import-doctoralia-history.ts --accounts ./accounts.json
 *   tsx src/scripts/import-doctoralia-history.ts --dry-run
 *
 * --accounts  Path to a JSON file with an array of IMAP account configs.
 *             If omitted, reads from DOCTORALIA_IMAP_* env vars (single account).
 *
 * accounts.json format:
 *   [
 *     { "host": "imap.gmail.com", "user": "clinica@bioalergia.cl", "pass": "xxx" },
 *     {
 *       "host": "outlook.office365.com",
 *       "user": "persona@hotmail.com",
 *       "authType": "oauth-device-code",
 *       "oauth": { "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
 *     }
 *   ]
 *
 * Dedup strategy (two layers):
 *   1. emailMessageId — exact same email (same Message-ID header)
 *   2. content key    — same patient + same appointment date + same doctor,
 *                       even if Doctoralia sent the notification twice with
 *                       different Message-IDs or from different accounts
 */

import fs from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";
import { ImapFlow } from "imapflow";

config({ path: path.resolve(process.cwd(), ".env") });

// Dynamic import after env is loaded
const { db } = await import("@finanzas/db");
const { htmlToText, isLikelyDoctoraliaEmail, parseDoctoraliaEmail } = await import(
  "../lib/whatsapp/email-parser.js"
);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const sinceIndex = args.indexOf("--since");
const accountsIndex = args.indexOf("--accounts");
const sinceArg = sinceIndex >= 0 ? args[sinceIndex + 1] : undefined;
const accountsArg = accountsIndex >= 0 ? args[accountsIndex + 1] : undefined;

const since: Date | null = sinceArg ? new Date(sinceArg) : null;
if (sinceArg && Number.isNaN(since.getTime())) {
  console.error(`Error: invalid --since value "${sinceArg}". Expected YYYY-MM-DD.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Account config
// ---------------------------------------------------------------------------

type AuthType = "oauth-device-code" | "password";

interface OAuthConfig {
  clientId?: string;
  scope?: string;
  tenant?: string;
  tokenCacheFile?: string;
}

interface AccountConfig {
  authType?: AuthType;
  host: string;
  mailbox?: string;
  oauth?: OAuthConfig;
  pass?: string;
  port?: number;
  secure?: boolean;
  senderFilter?: string;
  user: string;
}

function loadAccounts(): AccountConfig[] {
  if (accountsArg) {
    const raw = fs.readFileSync(path.resolve(accountsArg), "utf-8");
    return JSON.parse(raw) as AccountConfig[];
  }

  const user = process.env.DOCTORALIA_IMAP_USER;
  const pass = process.env.DOCTORALIA_IMAP_PASS;
  const host = process.env.DOCTORALIA_IMAP_HOST;

  if (!user || !pass || !host) {
    console.error(
      "Error: set DOCTORALIA_IMAP_HOST, DOCTORALIA_IMAP_USER, DOCTORALIA_IMAP_PASS " +
        "or pass --accounts <file>",
    );
    process.exit(1);
  }

  return [{ host, pass, user }];
}

// ---------------------------------------------------------------------------
// Microsoft OAuth device code for Outlook/Hotmail IMAP
// ---------------------------------------------------------------------------

interface TokenCache {
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
  scope: string;
}

const DEFAULT_MICROSOFT_SCOPE = "offline_access https://outlook.office.com/IMAP.AccessAsUser.All";
const DEFAULT_MICROSOFT_TENANT = "consumers";

function getOAuthConfig(account: AccountConfig): OAuthConfig {
  return account.oauth ?? {};
}

function getMicrosoftClientId(account: AccountConfig): null | string {
  return (
    getOAuthConfig(account).clientId ??
    process.env.DOCTORALIA_IMAP_MICROSOFT_CLIENT_ID ??
    process.env.MICROSOFT_OAUTH_CLIENT_ID ??
    null
  );
}

function getMicrosoftScope(account: AccountConfig): string {
  return getOAuthConfig(account).scope ?? DEFAULT_MICROSOFT_SCOPE;
}

function getMicrosoftTenant(account: AccountConfig): string {
  return getOAuthConfig(account).tenant ?? DEFAULT_MICROSOFT_TENANT;
}

function getTokenCachePath(account: AccountConfig): string {
  const configured = getOAuthConfig(account).tokenCacheFile;
  if (configured) {
    return path.resolve(configured);
  }

  const safeAccountId = `${account.user}-${account.host}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return path.resolve(process.cwd(), ".doctoralia-oauth", `${safeAccountId}.json`);
}

function loadTokenCache(filePath: string): null | TokenCache {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TokenCache;
  } catch {
    return null;
  }
}

function saveTokenCache(filePath: string, cache: TokenCache): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf-8");
}

async function requestMicrosoftToken(params: {
  clientId: string;
  deviceCode?: string;
  grantType: string;
  refreshToken?: string;
  scope: string;
  tenant: string;
}): Promise<Record<string, unknown>> {
  const tokenEndpoint = `https://login.microsoftonline.com/${params.tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: params.clientId,
    grant_type: params.grantType,
  });

  if (params.deviceCode) body.set("device_code", params.deviceCode);
  if (params.refreshToken) body.set("refresh_token", params.refreshToken);
  if (params.scope) body.set("scope", params.scope);

  const response = await fetch(tokenEndpoint, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  return await response.json() as Record<string, unknown>;
}

async function getDeviceCode(params: {
  clientId: string;
  scope: string;
  tenant: string;
}): Promise<{
  deviceCode: string;
  expiresIn: number;
  interval: number;
  message: string;
}> {
  const endpoint = `https://login.microsoftonline.com/${params.tenant}/oauth2/v2.0/devicecode`;
  const response = await fetch(endpoint, {
    body: new URLSearchParams({
      client_id: params.clientId,
      scope: params.scope,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `Microsoft device code failed: ${String(data.error ?? response.status)} ${String(data.error_description ?? "")}`.trim(),
    );
  }

  return {
    deviceCode: String(data.device_code),
    expiresIn: Number(data.expires_in ?? 900),
    interval: Number(data.interval ?? 5),
    message: String(data.message ?? ""),
  };
}

async function getMicrosoftAccessToken(account: AccountConfig): Promise<string> {
  const clientId = getMicrosoftClientId(account);
  if (!clientId) {
    throw new Error(
      `Missing Microsoft OAuth client ID for ${account.user}. Set oauth.clientId in accounts JSON or DOCTORALIA_IMAP_MICROSOFT_CLIENT_ID.`,
    );
  }

  const scope = getMicrosoftScope(account);
  const tenant = getMicrosoftTenant(account);
  const cachePath = getTokenCachePath(account);
  const cached = loadTokenCache(cachePath);
  const now = Date.now();

  if (cached?.accessToken && cached.expiresAt) {
    const expiresAtMs = new Date(cached.expiresAt).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs - now > 60_000) {
      return cached.accessToken;
    }
  }

  if (cached?.refreshToken) {
    const refreshed = await requestMicrosoftToken({
      clientId,
      grantType: "refresh_token",
      refreshToken: cached.refreshToken,
      scope,
      tenant,
    });

    if (typeof refreshed.access_token === "string") {
      const nextCache: TokenCache = {
        accessToken: refreshed.access_token,
        expiresAt: new Date(now + Number(refreshed.expires_in ?? 3600) * 1000).toISOString(),
        refreshToken:
          typeof refreshed.refresh_token === "string" ? refreshed.refresh_token : cached.refreshToken,
        scope,
      };
      saveTokenCache(cachePath, nextCache);
      return nextCache.accessToken;
    }
  }

  const device = await getDeviceCode({ clientId, scope, tenant });
  console.log("");
  console.log("Microsoft OAuth requerido para IMAP.");
  console.log(device.message || "Abre la URL indicada por Microsoft y autentica la cuenta.");
  console.log("");

  const deadline = now + device.expiresIn * 1000;
  let intervalMs = Math.max(device.interval, 5) * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const tokenResponse = await requestMicrosoftToken({
      clientId,
      deviceCode: device.deviceCode,
      grantType: "urn:ietf:params:oauth:grant-type:device_code",
      scope,
      tenant,
    });

    if (typeof tokenResponse.access_token === "string") {
      const nextCache: TokenCache = {
        accessToken: tokenResponse.access_token,
        expiresAt: new Date(Date.now() + Number(tokenResponse.expires_in ?? 3600) * 1000).toISOString(),
        refreshToken:
          typeof tokenResponse.refresh_token === "string" ? tokenResponse.refresh_token : undefined,
        scope,
      };
      saveTokenCache(cachePath, nextCache);
      return nextCache.accessToken;
    }

    const errorCode = String(tokenResponse.error ?? "");
    if (errorCode === "authorization_pending") continue;
    if (errorCode === "slow_down") {
      intervalMs += 5_000;
      continue;
    }
    if (errorCode === "authorization_declined") {
      throw new Error(`Microsoft OAuth declined for ${account.user}.`);
    }
    if (errorCode === "expired_token") {
      throw new Error(`Microsoft device code expired for ${account.user}. Retry the command.`);
    }

    throw new Error(
      `Microsoft token exchange failed for ${account.user}: ${errorCode} ${String(tokenResponse.error_description ?? "")}`.trim(),
    );
  }

  throw new Error(`Microsoft device code timed out for ${account.user}. Retry the command.`);
}

// ---------------------------------------------------------------------------
// Normalize for content-based dedup
// ---------------------------------------------------------------------------

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentKey(
  patientName: string,
  appointmentDate: Date | null,
  appointmentDoctor: string | null,
): string {
  return [
    normalize(patientName),
    appointmentDate ? appointmentDate.toISOString() : "no-date",
    normalize(appointmentDoctor),
  ].join("|");
}

// ---------------------------------------------------------------------------
// Fetch emails from one IMAP account
// ---------------------------------------------------------------------------

interface RawEmail {
  messageId: string;
  subject: string;
  body: string;
  account: string;
}

async function fetchFromAccount(account: AccountConfig): Promise<RawEmail[]> {
  const senderFilter = account.senderFilter ?? "doctoralia.com";
  const mailbox = account.mailbox ?? "INBOX";
  const authType: AuthType = account.authType ?? "password";

  if (authType === "password" && !account.pass) {
    throw new Error(`Missing pass for IMAP account ${account.user}.`);
  }

  const auth =
    authType === "oauth-device-code"
      ? {
          accessToken: await getMicrosoftAccessToken(account),
          user: account.user,
        }
      : {
          pass: account.pass!,
          user: account.user,
        };

  const client = new ImapFlow({
    auth,
    host: account.host,
    logger: false,
    port: account.port ?? 993,
    secure: account.secure !== false,
  });

  const emails: RawEmail[] = [];

  try {
    await client.connect();
    console.log(`  Connected: ${account.user}@${account.host}`);

    const lock = await client.getMailboxLock(mailbox);

    try {
      const searchCriteria: Parameters<typeof client.search>[0] = {
        from: senderFilter,
      };
      if (since) {
        searchCriteria.since = since;
      }

      const uids = await client.search(searchCriteria);
      console.log(`  Found ${uids.length} emails from ${senderFilter}`);

      if (uids.length === 0) return emails;

      for await (const msg of client.fetch(uids, {
        bodyParts: ["1", "TEXT"],
        bodyStructure: true,
        envelope: true,
      })) {
        const messageId = msg.envelope?.messageId ?? `imap-${account.user}-${msg.uid}`;
        const subject = msg.envelope?.subject ?? "";

        // Detect charset — old template uses iso-8859-1, new uses utf-8
        const charset =
          msg.bodyStructure?.parameters?.charset ??
          msg.bodyStructure?.childNodes?.[0]?.parameters?.charset ??
          "utf-8";
        const bodyBuffer = msg.bodyParts?.get("1") ?? msg.bodyParts?.get("TEXT");
        const rawBody = bodyBuffer ? new TextDecoder(charset).decode(bodyBuffer) : "";

        const body =
          rawBody.includes("<html") || rawBody.includes("<HTML")
            ? htmlToText(rawBody)
            : rawBody;

        emails.push({ account: account.user, body, messageId, subject });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return emails;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const accounts = loadAccounts();

console.log(`\nDoctoralia history import${DRY_RUN ? " (DRY RUN)" : ""}`);
console.log(`Accounts : ${accounts.length}`);
if (since) console.log(`Since    : ${since.toISOString()}`);
console.log("");

// Step 1: fetch raw emails from all accounts
const allRaw: RawEmail[] = [];
for (const account of accounts) {
  console.log(`Fetching from ${account.user}...`);
  const emails = await fetchFromAccount(account);
  allRaw.push(...emails);
}

console.log(`\nTotal emails fetched: ${allRaw.length}`);

// Step 2: parse and dedup in memory
interface ParsedBooking {
  messageId: string;
  account: string;
  subject: string;
  eventType: "BOOKING" | "MODIFICATION" | "CANCELLATION";
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  isFirstAppointment: boolean;
  appointmentDate: Date | null;
  previousAppointmentDate: Date | null;
  appointmentService: string | null;
  appointmentDoctor: string | null;
  clinicAddress: string | null;
}

const seenMessageIds = new Set<string>();
const seenContentKeys = new Set<string>();
const parsed: ParsedBooking[] = [];
let skippedUnparseable = 0;
let dedupMessageId = 0;
let dedupContent = 0;

for (const raw of allRaw) {
  // Dedup by messageId across all accounts
  if (seenMessageIds.has(raw.messageId)) {
    dedupMessageId++;
    continue;
  }
  seenMessageIds.add(raw.messageId);

  if (!isLikelyDoctoraliaEmail(raw.body)) {
    skippedUnparseable++;
    console.warn(`  Skipped non-Doctoralia email: ${raw.subject} (${raw.account})`);
    continue;
  }

  const booking = parseDoctoraliaEmail(raw.body);
  if (!booking) {
    skippedUnparseable++;
    console.warn(`  Could not parse: ${raw.subject} (${raw.account})`);
    continue;
  }

  // Dedup by content (same patient + date + doctor, different Message-ID)
  const key = contentKey(booking.patientName, booking.appointmentDate, booking.appointmentDoctor);
  if (seenContentKeys.has(key)) {
    dedupContent++;
    continue;
  }
  seenContentKeys.add(key);

  parsed.push({
    account: raw.account,
    appointmentDate: booking.appointmentDate,
    appointmentDoctor: booking.appointmentDoctor,
    appointmentService: booking.appointmentService,
    clinicAddress: booking.clinicAddress,
    eventType: booking.eventType,
    isFirstAppointment: booking.isFirstAppointment,
    messageId: raw.messageId,
    patientEmail: booking.patientEmail,
    patientName: booking.patientName,
    patientPhone: booking.patientPhone,
    previousAppointmentDate: booking.previousAppointmentDate,
    subject: raw.subject,
  });
}

console.log(`Parsed           : ${parsed.length}`);
console.log(`Dedup messageId  : ${dedupMessageId}`);
console.log(`Dedup content    : ${dedupContent}`);
console.log(`Unparseable      : ${skippedUnparseable}`);

if (parsed.length === 0) {
  console.log("\nNothing to import.");
  process.exit(0);
}

// Step 3: check which are already in DB
const existingIds = new Set<string>();
const existingRows = await db.$qb
  .selectFrom("DoctoraliaEmailNotification")
  .select(["emailMessageId"])
  .execute();
for (const row of existingRows) {
  existingIds.add(row.emailMessageId);
}

const toInsert = parsed.filter((b) => !existingIds.has(b.messageId));
const alreadyInDb = parsed.length - toInsert.length;

console.log(`Already in DB    : ${alreadyInDb}`);
console.log(`To insert        : ${toInsert.length}`);

if (toInsert.length === 0) {
  console.log("\nAll up to date.");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("\n--- DRY RUN: would insert ---");
  for (const b of toInsert) {
    console.log(
      `  [${b.eventType}] ${b.patientName} | ${b.appointmentDate?.toISOString() ?? "no date"} | ${b.appointmentDoctor ?? "no doctor"} (${b.account})`,
    );
  }
  process.exit(0);
}

// Step 4: insert
let inserted = 0;
let failed = 0;

for (const b of toInsert) {
  const now = new Date().toISOString();
  try {
    await db.$qb
      .insertInto("DoctoraliaEmailNotification")
      .values({
        appointmentDate: b.appointmentDate?.toISOString() ?? null,
        appointmentDoctor: b.appointmentDoctor ?? null,
        appointmentService: b.appointmentService ?? null,
        clinicAddress: b.clinicAddress ?? null,
        createdAt: now,
        emailMessageId: b.messageId,
        eventType: b.eventType,
        id: createId(),
        isFirstAppointment: b.isFirstAppointment,
        patientEmail: b.patientEmail ?? null,
        patientName: b.patientName,
        patientPhone: b.patientPhone ?? null,
        previousAppointmentDate: b.previousAppointmentDate?.toISOString() ?? null,
        updatedAt: now,
      })
      .execute();
    inserted++;
  } catch (err) {
    failed++;
    console.error(`  Insert failed for ${b.patientName}: ${err}`);
  }
}

console.log(`\nInserted : ${inserted}`);
if (failed > 0) console.log(`Failed   : ${failed}`);
console.log("Done.");
process.exit(0);
