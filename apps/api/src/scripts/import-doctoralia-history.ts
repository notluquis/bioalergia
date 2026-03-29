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
 *     { "host": "imap.gmail.com", "user": "otro@bioalergia.cl", "pass": "yyy" }
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
const { htmlToText, parseDoctoraliaEmail } = await import(
  "../lib/whatsapp/email-parser.js"
);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const sinceArg = args[args.indexOf("--since") + 1];
const accountsArg = args[args.indexOf("--accounts") + 1];

const since: Date | null = sinceArg ? new Date(sinceArg) : null;

// ---------------------------------------------------------------------------
// Account config
// ---------------------------------------------------------------------------

interface AccountConfig {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  mailbox?: string;
  senderFilter?: string;
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
  const senderFilter = account.senderFilter ?? "doctoralia";
  const mailbox = account.mailbox ?? "INBOX";

  const client = new ImapFlow({
    auth: { pass: account.pass, user: account.user },
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
