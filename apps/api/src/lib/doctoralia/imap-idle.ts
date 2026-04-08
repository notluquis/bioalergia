/**
 * Doctoralia IMAP IDLE listener.
 *
 * Maintains a persistent IMAP connection using the IDLE command so the server
 * pushes notifications instead of us polling. When new mail arrives the
 * connection wakes up, we fetch & parse any unseen Doctoralia emails, and
 * immediately save them to doctoralia_email_notifications.
 *
 * No WhatsApp logic here — that is intentionally separate.
 *
 * Required env vars:
 *   DOCTORALIA_IMAP_HOST
 *   DOCTORALIA_IMAP_USER
 *   DOCTORALIA_IMAP_PASS
 *
 * Optional:
 *   DOCTORALIA_IMAP_PORT              (default 993)
 *   DOCTORALIA_IMAP_SECURE            (default "1" = true, set "0" to disable)
 *   DOCTORALIA_IMAP_MAILBOX           (default "INBOX")
 *   DOCTORALIA_EMAIL_SENDER_FILTER    (default "doctoralia.com")
 */

import { db } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import { ImapFlow } from "imapflow";
import { logError, logEvent, logWarn } from "../logger";
import { resolveDoctoraliaSenderSearchTerms } from "./imap-search";
import {
  decodeEmailBody,
  htmlToText,
  isLikelyDoctoraliaEmail,
  parseDoctoraliaEmail,
} from "../whatsapp/email-parser";

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  mailbox: string;
  senderFilter: string;
}

type DoctoraliaImapListenerState =
  | "stopped"
  | "missing_config"
  | "connecting"
  | "connected"
  | "error";

interface DoctoraliaImapListenerStatus {
  enabled: boolean;
  host: null | string;
  lastConnectedAt: null | string;
  lastErrorAt: null | string;
  lastErrorMessage: null | string;
  lastProcessedAt: null | string;
  lastStartedAt: null | string;
  mailbox: null | string;
  reconnectDelayMs: null | number;
  state: DoctoraliaImapListenerState;
  user: null | string;
}

export interface DoctoraliaImapIngestResult {
  alreadyProcessed: number;
  checked: number;
  failed: number;
  saved: number;
  skipped: number;
}

function getImapConfig(): ImapConfig | null {
  const user = process.env.DOCTORALIA_IMAP_USER;
  const pass = process.env.DOCTORALIA_IMAP_PASS;
  const host = process.env.DOCTORALIA_IMAP_HOST;

  if (!user || !pass || !host) return null;

  return {
    host,
    mailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
    pass,
    port: parseInt(process.env.DOCTORALIA_IMAP_PORT ?? "993", 10),
    secure: process.env.DOCTORALIA_IMAP_SECURE !== "0",
    senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia",
    user,
  };
}

// Minimum delay before reconnecting after an error
const RECONNECT_DELAY_MS = 10_000;
// Maximum backoff delay
const MAX_RECONNECT_DELAY_MS = 5 * 60_000;
const IMAP_MAX_IDLE_TIME_MS = 4 * 60_000;
const IMAP_SOCKET_TIMEOUT_MS = 10 * 60_000;

let reconnectDelay = RECONNECT_DELAY_MS;
let stopped = false;
const listenerStatus: DoctoraliaImapListenerStatus = {
  enabled: false,
  host: null,
  lastConnectedAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastProcessedAt: null,
  lastStartedAt: null,
  mailbox: null,
  reconnectDelayMs: null,
  state: "stopped",
  user: null,
};

function markStatus(
  patch: Partial<DoctoraliaImapListenerStatus>,
): void {
  Object.assign(listenerStatus, patch);
}

export function getDoctoraliaImapListenerStatus(): DoctoraliaImapListenerStatus {
  return { ...listenerStatus };
}

function createImapClient(config: ImapConfig): ImapFlow {
  const client = new ImapFlow({
    auth: { pass: config.pass, user: config.user },
    disableAutoIdle: true,
    host: config.host,
    logger: false,
    maxIdleTime: IMAP_MAX_IDLE_TIME_MS,
    missingIdleCommand: "NOOP",
    port: config.port,
    secure: config.secure,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
  });

  client.on("error", (err) => {
    markStatus({
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: err instanceof Error ? err.message : String(err),
      reconnectDelayMs: reconnectDelay,
      state: "error",
    });
    logError("doctoralia.imap.client_error", err, { host: config.host });
  });

  client.on("close", () => {
    logWarn("doctoralia.imap.client_closed", { host: config.host, user: config.user });
  });

  client.on("mailboxOpen", (mailbox) => {
    logEvent("doctoralia.imap.mailbox_open", {
      exists: mailbox.exists,
      path: mailbox.path,
      uidNext: mailbox.uidNext,
      uidValidity: mailbox.uidValidity,
    });
  });

  client.on("mailboxClose", (mailbox) => {
    logEvent("doctoralia.imap.mailbox_close", {
      path: mailbox.path,
    });
  });

  client.on("exists", (data) => {
    logEvent("doctoralia.imap.exists", {
      count: data.count,
      path: data.path,
      prevCount: data.prevCount,
    });
  });

  return client;
}

async function ingestMailbox(client: ImapFlow, config: ImapConfig): Promise<DoctoraliaImapIngestResult> {
  const senderTerms = resolveDoctoraliaSenderSearchTerms(config.senderFilter);
  const uidSet = new Set<number>();
  const matchedSenderTermsByUid = new Map<number, Set<string>>();

  for (const senderTerm of senderTerms) {
    const matchingUids = await client.search({ from: senderTerm });
    for (const uid of matchingUids) {
      uidSet.add(uid);
      const matchedTerms = matchedSenderTermsByUid.get(uid) ?? new Set<string>();
      matchedTerms.add(senderTerm);
      matchedSenderTermsByUid.set(uid, matchedTerms);
    }
  }

  const uids = [...uidSet].sort((a, b) => a - b);
  const result: DoctoraliaImapIngestResult = {
    alreadyProcessed: 0,
    checked: uids.length,
    failed: 0,
    saved: 0,
    skipped: 0,
  };
  if (!uids.length) return result;

  logEvent("doctoralia.imap.found", { count: uids.length, senderTerms });

  for await (const msg of client.fetch(uids, {
    // bodyParts gives us QP/base64-decoded bytes; bodyStructure gives charset
    bodyParts: ["1", "TEXT"],
    bodyStructure: true,
    envelope: true,
  })) {
    const messageId = msg.envelope?.messageId ?? `imap-${msg.uid}`;
    const subject = msg.envelope?.subject ?? null;
    const matchedSenderTerms = [...(matchedSenderTermsByUid.get(msg.uid) ?? new Set<string>())];
    const messageContext = {
      matchedSenderTerms,
      messageId,
      subject,
      uid: msg.uid,
    };

    logEvent("doctoralia.imap.message_seen", messageContext);

    // Dedup check
    try {
      const existing = await db.$qb
        .selectFrom("DoctoraliaEmailNotification")
        .select(["id"])
        .where("emailMessageId", "=", messageId)
        .executeTakeFirst();

      if (existing) {
        result.alreadyProcessed++;
        logEvent("doctoralia.imap.message_dedup_skip", messageContext);
        continue;
      }
    } catch (err) {
      result.failed++;
      logError("doctoralia.imap.dedup_error", err, messageContext);
      continue;
    }

    // Detect charset from bodyStructure (old template uses iso-8859-1, new uses utf-8)
    const charset =
      msg.bodyStructure?.parameters?.charset ??
      msg.bodyStructure?.childNodes?.[0]?.parameters?.charset ??
      "utf-8";
    const encoding =
      msg.bodyStructure?.encoding ?? msg.bodyStructure?.childNodes?.[0]?.encoding ?? null;
    const bodyBuffer = msg.bodyParts?.get("1") ?? msg.bodyParts?.get("TEXT");
    const rawBody = decodeEmailBody({ bodyBuffer, charset, encoding });

    const emailText = rawBody.includes("<html") || rawBody.includes("<HTML")
      ? htmlToText(rawBody)
      : rawBody;

    if (!isLikelyDoctoraliaEmail(emailText)) {
      result.skipped++;
      logWarn("doctoralia.imap.skip_non_doctoralia", {
        ...messageContext,
        extractedTextLength: emailText.length,
      });
      continue;
    }

    const booking = emailText ? parseDoctoraliaEmail(emailText) : null;

    if (!booking) {
      result.skipped++;
      logWarn("doctoralia.imap.no_booking", {
        ...messageContext,
        extractedTextLength: emailText.length,
      });
      continue;
    }

    logEvent("doctoralia.imap.parse_ok", {
      ...messageContext,
      appointmentDate: booking.appointmentDate?.toISOString() ?? null,
      eventType: booking.eventType,
      patientName: booking.patientName,
      patientPhone: booking.patientPhone ?? null,
      service: booking.appointmentService ?? null,
    });

    const now = new Date().toISOString();
    try {
      await db.$qb
        .insertInto("DoctoraliaEmailNotification")
        .values({
          appointmentDate: booking.appointmentDate?.toISOString() ?? null,
          appointmentDoctor: booking.appointmentDoctor ?? null,
          appointmentService: booking.appointmentService ?? null,
          clinicAddress: booking.clinicAddress ?? null,
          createdAt: now,
          emailMessageId: messageId,
          eventType: booking.eventType,
          id: createId(),
          patientEmail: booking.patientEmail ?? null,
          patientName: booking.patientName,
          patientPhone: booking.patientPhone ?? null,
          previousAppointmentDate: booking.previousAppointmentDate?.toISOString() ?? null,
          updatedAt: now,
        })
        .execute();

      result.saved++;
      markStatus({ lastProcessedAt: now });

      logEvent("doctoralia.imap.saved", {
        ...messageContext,
        appointmentDate: booking.appointmentDate?.toISOString() ?? null,
        eventType: booking.eventType,
        patientName: booking.patientName,
      });
    } catch (dbErr) {
      result.failed++;
      logError("doctoralia.imap.db_error", dbErr, {
        ...messageContext,
        eventType: booking.eventType,
        patientName: booking.patientName,
      });
    }

  }

  return result;
}

async function connect(config: ImapConfig): Promise<void> {
  if (stopped) return;

  markStatus({
    host: config.host,
    lastErrorMessage: null,
    mailbox: config.mailbox,
    reconnectDelayMs: reconnectDelay,
    state: "connecting",
    user: config.user,
  });

  const client = createImapClient(config);

  try {
    await client.connect();
    markStatus({
      lastConnectedAt: new Date().toISOString(),
      reconnectDelayMs: RECONNECT_DELAY_MS,
      state: "connected",
    });
    logEvent("doctoralia.imap.connected", { host: config.host, user: config.user });
    reconnectDelay = RECONNECT_DELAY_MS; // reset backoff on successful connect

    const lock = await client.getMailboxLock(config.mailbox);

    try {
      const initialResult = await ingestMailbox(client, config);
      logEvent("doctoralia.imap.ingest_complete", {
        phase: "initial",
        result: initialResult,
      });

      // IDLE loop: idle() blocks until the server interrupts it (new mail or
      // ~30 min keepalive timeout). On interruption we check for new mail and
      // re-enter IDLE immediately.
      while (!stopped) {
        logEvent("doctoralia.imap.idle_wait", {
          mailbox: config.mailbox,
          maxIdleTimeMs: IMAP_MAX_IDLE_TIME_MS,
        });
        const idled = await client.idle();
        logEvent("doctoralia.imap.idle_wakeup", {
          idled,
          mailbox: config.mailbox,
        });
        const loopResult = await ingestMailbox(client, config);
        logEvent("doctoralia.imap.ingest_complete", {
          phase: "idle_wakeup",
          result: loopResult,
        });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    markStatus({
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: err instanceof Error ? err.message : String(err),
      reconnectDelayMs: reconnectDelay,
      state: "error",
    });
    logError("doctoralia.imap.error", err, { host: config.host });
  } finally {
    await client.logout().catch(() => undefined);
  }

  if (!stopped) {
    markStatus({ reconnectDelayMs: reconnectDelay });
    logEvent("doctoralia.imap.reconnect", { delayMs: reconnectDelay });
    setTimeout(() => connect(config), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}

export function startDoctoraliaImapListener(): void {
  const config = getImapConfig();
  stopped = false;
  markStatus({
    enabled: true,
    host: config?.host ?? null,
    lastStartedAt: new Date().toISOString(),
    mailbox: config?.mailbox ?? null,
    reconnectDelayMs: null,
    state: config ? "connecting" : "missing_config",
    user: config?.user ?? null,
  });
  if (!config) {
    logWarn("doctoralia.imap.skip", { reason: "missing_imap_config" });
    return;
  }

  logEvent("doctoralia.imap.start", { host: config.host, mailbox: config.mailbox });
  connect(config);
}

export function stopDoctoraliaImapListener(): void {
  stopped = true;
  markStatus({
    enabled: false,
    reconnectDelayMs: null,
    state: "stopped",
  });
}

export async function runDoctoraliaImapIngestOnce(): Promise<DoctoraliaImapIngestResult> {
  const config = getImapConfig();
  if (!config) {
    throw new Error("Missing Doctoralia IMAP config.");
  }

  const client = createImapClient(config);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      return await ingestMailbox(client, config);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}
