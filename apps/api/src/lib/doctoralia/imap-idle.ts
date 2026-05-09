/**
 * Doctoralia IMAP IDLE listener.
 *
 * Maintains a persistent IMAP connection using the IDLE command so the server
 * pushes notifications instead of us polling. When new mail arrives the
 * connection wakes up, we fetch & parse any unseen Doctoralia emails, and
 * immediately save them to doctoralia_email_notifications. For future bookings
 * we also mark the patient as OPTED_IN and attempt the WhatsApp notification.
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
import { type FetchMessageObject, ImapFlow } from "imapflow";
import { logError, logEvent, logWarn } from "../logger.ts";
import { resolveDoctoraliaSenderSearchTerms } from "./imap-search.ts";
import {
  DOCTORALIA_STATUS_CANCELLED_BY_PATIENT,
  buildDoctoraliaMatchWindow,
  normalizePatientNameForMatch,
} from "./name-match.ts";
import { sendText } from "../whatsapp/baileys-socket.ts";
import {
  getWhatsappConversationState,
  setWhatsappContactConsent,
} from "../whatsapp/conversation-state.ts";
import { buildDoctoraliaMessage } from "../whatsapp/doctoralia-message.ts";
import {
  decodeEmailBody,
  htmlToText,
  isLikelyDoctoraliaEmail,
  parseDoctoraliaEmail,
} from "../whatsapp/email-parser.ts";
import { normalizePhone, phoneToJid } from "../whatsapp/jid.ts";

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

async function findMatchingCalendarAppointmentId(
  patientName: string,
  appointmentDate: Date,
): Promise<number | null> {
  const { windowStart, windowEnd } = buildDoctoraliaMatchWindow(appointmentDate);
  const target = normalizePatientNameForMatch(patientName);

  const candidates = await db.doctoraliaCalendarAppointment.findMany({
    where: {
      startAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, startAt: true, title: true },
  });

  for (const candidate of candidates) {
    if (normalizePatientNameForMatch(candidate.title) === target) {
      return candidate.id;
    }
  }
  return null;
}

interface ProcessMessagesOptions {
  checked: number;
  matchedSenderTermsByUid?: Map<number, Set<string>>;
  uidValidity: bigint | null;
}

async function logWhatsappNotification(args: {
  booking: NonNullable<ReturnType<typeof parseDoctoraliaEmail>>;
  errorMessage?: null | string;
  messageId: string;
  status: "FAILED" | "SENT";
  waMessageId?: null | string;
}) {
  const now = new Date().toISOString();

  try {
    await db.$qb
      .insertInto("WhatsappNotification")
      .values({
        appointmentDate: args.booking.appointmentDate?.toISOString() ?? null,
        appointmentDoctor: args.booking.appointmentDoctor ?? null,
        appointmentService: args.booking.appointmentService ?? null,
        createdAt: now,
        emailMessageId: args.messageId,
        errorMessage: args.errorMessage ?? null,
        id: createId(),
        messagePacingStatus: null,
        patientEmail: args.booking.patientEmail ?? null,
        patientName: args.booking.patientName,
        patientPhone: args.booking.patientPhone ?? "",
        recipientWaId: args.booking.patientPhone ? phoneToJid(args.booking.patientPhone) : null,
        sentAt: args.status === "SENT" ? now : null,
        status: args.status,
        updatedAt: now,
        waMessageId: args.waMessageId ?? null,
      })
      .execute();
  } catch (dbErr) {
    logError("whatsapp.db.insert_error", dbErr, {
      emailMessageId: args.messageId,
      patientName: args.booking.patientName,
      status: args.status,
    });
  }
}

async function sendDoctoraliaWhatsapp(args: {
  booking: NonNullable<ReturnType<typeof parseDoctoraliaEmail>>;
  messageContext: {
    matchedSenderTerms: string[];
    messageId: string;
    subject: null | string;
    uid: number;
  };
}) {
  const appointmentDate = args.booking.appointmentDate;
  const now = new Date();

  if (args.booking.eventType === "CANCELLATION") {
    logEvent("whatsapp.imap.skip_event_type", {
      ...args.messageContext,
      eventType: args.booking.eventType,
      patientName: args.booking.patientName,
    });
    return;
  }

  if (!appointmentDate || appointmentDate.getTime() <= now.getTime()) {
    logEvent("whatsapp.imap.skip_past_appointment", {
      ...args.messageContext,
      appointmentDate: appointmentDate?.toISOString() ?? null,
      eventType: args.booking.eventType,
      patientName: args.booking.patientName,
    });
    return;
  }

  if (!args.booking.patientPhone) {
    logWarn("whatsapp.imap.no_phone", {
      ...args.messageContext,
      patientName: args.booking.patientName,
    });
    return;
  }

  const normalizedPhone = normalizePhone(args.booking.patientPhone);
  const message = await buildDoctoraliaMessage(args.booking);

  try {
    const sendResult = await sendText(normalizedPhone, message);

    logEvent("whatsapp.message.sent", {
      ...args.messageContext,
      patientName: args.booking.patientName,
      phone: normalizedPhone,
      waMessageId: sendResult.messageId,
    });

    await logWhatsappNotification({
      booking: args.booking,
      messageId: args.messageContext.messageId,
      status: "SENT",
      waMessageId: sendResult.messageId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    logError("whatsapp.message.failed", err, {
      ...args.messageContext,
      patientName: args.booking.patientName,
      phone: normalizedPhone,
    });

    await logWhatsappNotification({
      booking: args.booking,
      errorMessage,
      messageId: args.messageContext.messageId,
      status: "FAILED",
    });
  }
}

async function markDoctoraliaOptIn(args: {
  booking: NonNullable<ReturnType<typeof parseDoctoraliaEmail>>;
  messageContext: {
    matchedSenderTerms: string[];
    messageId: string;
    subject: null | string;
    uid: number;
  };
}): Promise<boolean> {
  if (!args.booking.patientPhone) {
    return true;
  }

  try {
    const existingState = await getWhatsappConversationState(args.booking.patientPhone);
    if (existingState?.optInStatus === "OPTED_OUT") {
      logEvent("whatsapp.imap.opt_in_skipped_opted_out", {
        ...args.messageContext,
        patientName: args.booking.patientName,
        phone: normalizePhone(args.booking.patientPhone),
      });
      return false;
    }

    await setWhatsappContactConsent({
      phone: args.booking.patientPhone,
      source: "doctoralia_imap",
      status: "OPTED_IN",
      waId: phoneToJid(args.booking.patientPhone),
    });

    logEvent("whatsapp.imap.opt_in_set", {
      ...args.messageContext,
      patientName: args.booking.patientName,
      phone: normalizePhone(args.booking.patientPhone),
    });
    return true;
  } catch (err) {
    logError("whatsapp.imap.opt_in_failed", err, {
      ...args.messageContext,
      patientName: args.booking.patientName,
      phone: normalizePhone(args.booking.patientPhone),
    });
    return true;
  }
}

async function getLastRecordedDoctoraliaEmailDate(): Promise<Date | null> {
  const latest = await db.$qb
    .selectFrom("DoctoraliaEmailNotification")
    .select(["createdAt"])
    .orderBy("createdAt", "desc")
    .executeTakeFirst();

  if (!latest?.createdAt) return null;

  const raw: unknown = latest.createdAt;
  const parsed =
    raw instanceof Date ? raw : new Date(raw as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildMailboxSearchStart(lastRecordedAt: Date | null): Date | null {
  if (!lastRecordedAt) return null;

  // IMAP `SINCE` is day-granular and inclusive, so go one day back and rely on
  // message-id deduplication to avoid missing messages around restarts/timezones.
  const start = new Date(lastRecordedAt);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
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
let activeClient: ImapFlow | null = null;
const activeWaiters = new Set<() => void>();
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

function buildStoredMessageId(messageId: null | string | undefined, uidValidity: bigint | null, uid: number): string {
  if (messageId) return messageId;
  return `imap-${uidValidity?.toString() ?? "unknown"}-${uid}`;
}

function createEmptyIngestResult(checked: number): DoctoraliaImapIngestResult {
  return {
    alreadyProcessed: 0,
    checked,
    failed: 0,
    saved: 0,
    skipped: 0,
  };
}

async function processFetchedMessages(
  messages: FetchMessageObject[],
  options: ProcessMessagesOptions,
): Promise<DoctoraliaImapIngestResult> {
  const result: DoctoraliaImapIngestResult = {
    ...createEmptyIngestResult(options.checked),
    alreadyProcessed: 0,
    failed: 0,
    saved: 0,
    skipped: 0,
  };

  for (const msg of messages) {
    const messageId = buildStoredMessageId(msg.envelope?.messageId, options.uidValidity, msg.uid);
    const subject = msg.envelope?.subject ?? null;
    const matchedSenderTerms = [...(options.matchedSenderTermsByUid?.get(msg.uid) ?? new Set<string>())];
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

    if (!isLikelyDoctoraliaEmail(emailText, { subject })) {
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
      const matchedAppointmentId = booking.appointmentDate
        ? await findMatchingCalendarAppointmentId(booking.patientName, booking.appointmentDate)
        : null;

      if (matchedAppointmentId !== null && booking.eventType === "CANCELLATION") {
        try {
          await db.doctoraliaCalendarAppointment.update({
            where: { id: matchedAppointmentId },
            data: { status: DOCTORALIA_STATUS_CANCELLED_BY_PATIENT },
          });
          logEvent("doctoralia.imap.appointment_cancelled_from_email", {
            ...messageContext,
            appointmentId: matchedAppointmentId,
            patientName: booking.patientName,
          });
        } catch (statusErr) {
          logError("doctoralia.imap.appointment_status_update_failed", statusErr, {
            ...messageContext,
            appointmentId: matchedAppointmentId,
          });
        }
      }

      await db.$qb
        .insertInto("DoctoraliaEmailNotification")
        .values({
          appointmentDate: booking.appointmentDate?.toISOString() ?? null,
          appointmentDoctor: booking.appointmentDoctor ?? null,
          appointmentService: booking.appointmentService ?? null,
          calendarAppointmentId: matchedAppointmentId,
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

      const canSendWhatsapp = await markDoctoraliaOptIn({
        booking,
        messageContext,
      });

      if (canSendWhatsapp) {
        await sendDoctoraliaWhatsapp({
          booking,
          messageContext,
        });
      }
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

async function ingestMailbox(client: ImapFlow, config: ImapConfig): Promise<DoctoraliaImapIngestResult> {
  const lastRecordedAt = await getLastRecordedDoctoraliaEmailDate();
  const searchStart = buildMailboxSearchStart(lastRecordedAt);
  const senderTerms = resolveDoctoraliaSenderSearchTerms(config.senderFilter);
  const matchedSenderTermsByUid = new Map<number, Set<string>>();

  const uids: number[] = searchStart
    ? (await client.search({ since: searchStart }, { uid: true })) || []
    : [];

  if (!uids.length && !searchStart) {
    for (const senderTerm of senderTerms) {
      const matchingUids = (await client.search({ from: senderTerm }, { uid: true })) || [];
      for (const uid of matchingUids) {
        const matchedTerms = matchedSenderTermsByUid.get(uid) ?? new Set<string>();
        matchedTerms.add(senderTerm);
        matchedSenderTermsByUid.set(uid, matchedTerms);
      }
    }
  }

  const candidateUids: number[] = (
    searchStart
      ? uids
      : [...matchedSenderTermsByUid.keys()]
  ).sort((a: number, b: number) => a - b);

  if (!candidateUids.length) return createEmptyIngestResult(0);

  logEvent("doctoralia.imap.found", {
    count: candidateUids.length,
    lastRecordedAt: lastRecordedAt?.toISOString() ?? null,
    searchStart: searchStart?.toISOString() ?? null,
    senderTerms: searchStart ? [] : senderTerms,
  });

  const messages = await client.fetchAll(candidateUids, {
    // bodyParts gives us QP/base64-decoded bytes; bodyStructure gives charset
    bodyParts: ["1", "TEXT"],
    bodyStructure: true,
    envelope: true,
  }, {
    uid: true,
  });

  const mailbox = client.mailbox && typeof client.mailbox === "object" ? client.mailbox : null;
  return processFetchedMessages(messages, {
    checked: candidateUids.length,
    matchedSenderTermsByUid,
    uidValidity: mailbox?.uidValidity ?? null,
  });
}

async function ingestNewMessagesSinceCount(
  client: ImapFlow,
  previousCount: number,
): Promise<DoctoraliaImapIngestResult> {
  const mailbox = client.mailbox && typeof client.mailbox === "object" ? client.mailbox : null;
  const currentCount = mailbox?.exists ?? 0;
  if (currentCount <= previousCount) return createEmptyIngestResult(0);

  const range = `${previousCount + 1}:*`;
  const messages = await client.fetchAll(range, {
    bodyParts: ["1", "TEXT"],
    bodyStructure: true,
    envelope: true,
  });

  return processFetchedMessages(messages, {
    checked: currentCount - previousCount,
    uidValidity: mailbox?.uidValidity ?? null,
  });
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
    activeClient = client;
    let ingestInFlight = false;
    let deferredTrigger: null | { previousCount?: number; reason: string } = null;
    const runIngest = async (reason: string, previousCount?: number) => {
      if (stopped) return;

      if (ingestInFlight) {
        if (!deferredTrigger) {
          deferredTrigger = { previousCount, reason };
        } else if (
          deferredTrigger.reason === "exists_event" &&
          reason === "exists_event" &&
          previousCount !== undefined
        ) {
          deferredTrigger.previousCount = deferredTrigger.previousCount === undefined
            ? previousCount
            : Math.min(deferredTrigger.previousCount, previousCount);
        }

        logEvent("doctoralia.imap.ingest_deferred", { previousCount: previousCount ?? null, reason });
        return;
      }

      ingestInFlight = true;
      try {
        const result = previousCount === undefined
          ? await ingestMailbox(client, config)
          : await ingestNewMessagesSinceCount(client, previousCount);
        logEvent("doctoralia.imap.ingest_complete", { phase: reason, result });
      } catch (err) {
        logError("doctoralia.imap.ingest_error", err, { phase: reason });
      } finally {
        ingestInFlight = false;

        if (deferredTrigger) {
          const nextTrigger = deferredTrigger;
          deferredTrigger = null;
          queueMicrotask(() => {
            void runIngest(`deferred:${nextTrigger.reason}`, nextTrigger.previousCount);
          });
        }
      }
    };

    const existsHandler = (data: { count: number; path: string; prevCount: number }) => {
      if (data.path !== config.mailbox || data.count <= data.prevCount) return;
      void runIngest("exists_event", data.prevCount);
    };

    client.on("exists", existsHandler);

    try {
      await runIngest("initial");

      logEvent("doctoralia.imap.idle_wait", {
        mailbox: config.mailbox,
        maxIdleTimeMs: IMAP_MAX_IDLE_TIME_MS,
      });

      await new Promise<void>((resolve) => {
        const finish = () => {
          activeWaiters.delete(finish);
          client.off("close", finish);
          resolve();
        };

        activeWaiters.add(finish);
        client.once("close", finish);

        if (stopped) {
          finish();
        }
      });
    } finally {
      client.off("exists", existsHandler);
      if (activeClient === client) activeClient = null;
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
  for (const waiter of [...activeWaiters]) waiter();
  activeClient?.close();
  activeClient = null;
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
