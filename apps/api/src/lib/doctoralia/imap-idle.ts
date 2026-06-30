/**
 * Doctoralia IMAP IDLE listener.
 *
 * Maintains a persistent IMAP connection using the IDLE command so the server
 * pushes notifications instead of us polling. When new mail arrives the
 * connection wakes up, we fetch & parse any unseen Doctoralia emails, and
 * immediately save them to doctoralia_email_notifications.
 *
 * It also immediately sends a WhatsApp prepayment template if the patient
 * is a new patient and self-scheduled (auto-appointment).
 */

import { db } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import { ImapFlow } from "imapflow";
import { logError, logEvent, logWarn } from "../logger.ts";
import { htmlToText, parseDoctoraliaEmail } from "./email-parser.ts";
import { simpleParser } from "mailparser";
import { formatChile } from "../time.ts";
import {
  findAbonoWhatsappPhone,
  loadAbonoPaymentSettings,
  loadAbonoWhatsappConfig,
  loadClinicAddress,
} from "./abono-whatsapp-settings.ts";
import { appendAbonoFlowHistory } from "./abono-flow-history.ts";

type PaymentTokenForWhatsapp = Awaited<ReturnType<typeof db.appointmentPaymentToken.findFirst>>;

export interface ImapListenerDependencies {
  ensureContactAndConversation: (
    patientPhone: string,
    patientName: string,
    waPhoneId: number
  ) => Promise<{ conversationId: number }>;
  sendTemplate: (
    params: {
      conversationId: number;
      phoneNumberId: number;
      templateName: string;
      language: string;
      bodyParams?: string[];
      bodyNamedParams?: Array<{ name: string; text: string }>;
      urlButtonSuffix?: string;
      locationHeader?: { latitude: string; longitude: string; name: string; address: string };
    },
    sentByUserId: null
  ) => Promise<unknown>;
}

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
  | "connected"
  | "connecting"
  | "error"
  | "missing_config"
  | "stopped";

export interface DoctoraliaImapListenerStatus {
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

function getImapConfig(): ImapConfig | null {
  const user = process.env.DOCTORALIA_IMAP_USER;
  const pass = process.env.DOCTORALIA_IMAP_PASS;
  const host = process.env.DOCTORALIA_IMAP_HOST;
  const senderFilter = process.env.DOCTORALIA_EMAIL_SENDER_FILTER?.trim();

  if (!user || !pass || !host || !senderFilter) return null;

  return {
    host,
    mailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
    pass,
    port: parseInt(process.env.DOCTORALIA_IMAP_PORT ?? "993", 10),
    secure: process.env.DOCTORALIA_IMAP_SECURE !== "0",
    senderFilter,
    user,
  };
}

const RECONNECT_DELAY_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 5 * 60_000;

let reconnectDelay = RECONNECT_DELAY_MS;
let stopped = false;
// Resolvers for the per-connection keep-alive promises, so stopDoctoraliaImap-
// Listener() can release a connection that's parked waiting on 'close'.
const stopResolvers = new Set<() => void>();
const listenerStatus: DoctoraliaImapListenerStatus = {
  enabled: process.env.ENABLE_DOCTORALIA_IMAP === "true",
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

export function getDoctoraliaImapListenerStatus(): DoctoraliaImapListenerStatus {
  return { ...listenerStatus };
}

function missingTokenField(field: string, tokenId: string): void {
  logError("doctoralia.abono.whatsapp_token_invalid", new Error(`Missing ${field}`), {
    tokenId,
  });
}

export async function sendAbonoRequestWhatsapp(
  token: NonNullable<PaymentTokenForWhatsapp>,
  deps: ImapListenerDependencies
): Promise<"disabled" | "invalid_token" | "missing_config" | "sent" | "already_sent"> {
  if (token.waSentAt) return "already_sent";
  if (!token.patientPhone) {
    missingTokenField("patientPhone", token.id);
    await appendAbonoFlowHistory(token.id, "wa_request_invalid_token", { field: "patientPhone" });
    return "invalid_token";
  }
  if (!token.patientName.trim()) {
    missingTokenField("patientName", token.id);
    await appendAbonoFlowHistory(token.id, "wa_request_invalid_token", { field: "patientName" });
    return "invalid_token";
  }
  if (!token.appointmentDate) {
    missingTokenField("appointmentDate", token.id);
    await appendAbonoFlowHistory(token.id, "wa_request_invalid_token", {
      field: "appointmentDate",
    });
    return "invalid_token";
  }

  let paymentSettings: Awaited<ReturnType<typeof loadAbonoPaymentSettings>>;
  let waConfig: Awaited<ReturnType<typeof loadAbonoWhatsappConfig>>;
  try {
    [paymentSettings, waConfig] = await Promise.all([
      loadAbonoPaymentSettings(),
      loadAbonoWhatsappConfig("request"),
    ]);
  } catch (error) {
    await appendAbonoFlowHistory(token.id, "wa_request_settings_error", {}, error);
    throw error;
  }
  if (!waConfig.enabled) {
    await appendAbonoFlowHistory(token.id, "wa_request_disabled");
    return "disabled";
  }
  if (!waConfig.templateName || !waConfig.language || !waConfig.phoneNumberId) {
    // warn, not error: the request template being unset is an incomplete
    // (optional) config, not a runtime failure — don't page Sentry every tick.
    logWarn("doctoralia.abono.whatsapp_config_missing", {
      hasLanguage: Boolean(waConfig.language),
      hasPhoneNumberId: Boolean(waConfig.phoneNumberId),
      hasTemplateName: Boolean(waConfig.templateName),
      tokenId: token.id,
    });
    await appendAbonoFlowHistory(token.id, "wa_request_missing_config", {
      hasLanguage: Boolean(waConfig.language),
      hasPhoneNumberId: Boolean(waConfig.phoneNumberId),
      hasTemplateName: Boolean(waConfig.templateName),
    });
    return "missing_config";
  }

  const waPhone = await findAbonoWhatsappPhone(waConfig);
  if (!waPhone) {
    logError("doctoralia.abono.whatsapp_config_missing", new Error("No active WA phone"), {
      configuredPhoneNumberId: waConfig.phoneNumberId,
      tokenId: token.id,
    });
    await appendAbonoFlowHistory(token.id, "wa_request_missing_phone", {
      configuredPhoneNumberId: waConfig.phoneNumberId,
    });
    return "missing_config";
  }

  // Full patient name as Doctoralia sent it. Date like "Lunes 6 de marzo a las
  // 16:00" — capitalize the weekday (dayjs es gives it lowercase).
  const fechaRaw = formatChile(token.appointmentDate, "dddd D [de] MMMM [a las] HH:mm");
  const fechaHora = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);
  const clp = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
  // Fully personalized named body params + dynamic URL button. Prices from
  // settings (no drift). Address as a {{direccion}} body var from the DB
  // (single source) — this template has no location header. The button URL is
  // the per-token /abono page (template base + {{1}} = token id) — REQUIRED for
  // the webhook to attribute the payment (a static MP link can't be confirmed).
  const direccion = await loadClinicAddress();
  const { conversationId } = await deps.ensureContactAndConversation(
    token.patientPhone,
    token.patientName,
    waPhone.id
  );

  await deps.sendTemplate(
    {
      conversationId,
      phoneNumberId: waPhone.id,
      templateName: waConfig.templateName,
      language: waConfig.language,
      bodyNamedParams: [
        { name: "nombre_paciente", text: token.patientName },
        { name: "fecha_hora", text: fechaHora },
        { name: "direccion", text: direccion },
        { name: "fonasa_total", text: clp(paymentSettings.fonasaFullAmountClp) },
        { name: "particular_total", text: clp(paymentSettings.particularFullAmountClp) },
      ],
      urlButtonSuffix: token.id,
    },
    null
  );

  await db.appointmentPaymentToken.update({
    where: { id: token.id },
    data: { waSentAt: new Date() },
  });
  await appendAbonoFlowHistory(token.id, "wa_request_sent", {
    phoneNumberId: waPhone.id,
    templateName: waConfig.templateName,
  });
  return "sent";
}

export async function retryPendingAbonoWhatsapp(
  deps: ImapListenerDependencies
): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
  const tokens = await db.appointmentPaymentToken.findMany({
    where: {
      status: "PENDING",
      waSentAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const result = { checked: tokens.length, sent: 0, skipped: 0, failed: 0 };
  for (const token of tokens) {
    try {
      const status = await sendAbonoRequestWhatsapp(token, deps);
      if (status === "sent") result.sent++;
      else result.skipped++;
    } catch (error) {
      result.failed++;
      await appendAbonoFlowHistory(token.id, "wa_request_retry_failed", {}, error);
      logError("doctoralia.abono.whatsapp_retry_error", error, { tokenId: token.id });
    }
  }
  return result;
}

// High-water mark by IMAP UID (persisted in settings). We can't rely on the
// \Seen flag for "already processed" because a human mail client reading
// clinica@bioalergia.cl marks every Doctoralia email \Seen before the listener
// runs — which silently blinded the listener. UID is monotonic per mailbox;
// we process only UIDs above the mark and never touch flags. Message-ID dedup
// (below) remains the idempotency backstop.
const IMAP_LAST_UID_KEY = "doctoralia:imap:lastUid";
const IMAP_UIDVALIDITY_KEY = "doctoralia:imap:uidValidity";

async function getImapHighWater(): Promise<{ lastUid: number; uidValidity: number } | null> {
  const [uidRow, validityRow] = await Promise.all([
    db.setting.findUnique({ where: { key: IMAP_LAST_UID_KEY } }),
    db.setting.findUnique({ where: { key: IMAP_UIDVALIDITY_KEY } }),
  ]);
  if (!uidRow?.value || !validityRow?.value) return null;
  const lastUid = Number(uidRow.value);
  const uidValidity = Number(validityRow.value);
  if (!Number.isFinite(lastUid) || !Number.isFinite(uidValidity)) return null;
  return { lastUid, uidValidity };
}

async function setImapHighWater(lastUid: number, uidValidity: number): Promise<void> {
  await db.setting.upsert({
    where: { key: IMAP_LAST_UID_KEY },
    create: { key: IMAP_LAST_UID_KEY, value: String(lastUid) },
    update: { value: String(lastUid) },
  });
  await db.setting.upsert({
    where: { key: IMAP_UIDVALIDITY_KEY },
    create: { key: IMAP_UIDVALIDITY_KEY, value: String(uidValidity) },
    update: { value: String(uidValidity) },
  });
}

async function processUnseen(
  client: ImapFlow,
  config: ImapConfig,
  deps: ImapListenerDependencies
): Promise<void> {
  const uidValidity = Number(
    client.mailbox && typeof client.mailbox === "object" ? client.mailbox.uidValidity : 0
  );
  // uid:true — search/fetch by UID, not sequence number. Sequence numbers
  // shift on expunge and would corrupt the high-water mark; UIDs are stable.
  const allUids = await client.search({ from: config.senderFilter }, { uid: true });
  if (allUids === false) return;
  const maxUid = allUids.length > 0 ? Math.max(...allUids) : 0;

  const highWater = await getImapHighWater();
  // First run ever, or mailbox UIDVALIDITY rotated (rare; mailbox recreated):
  // anchor the mark at the current max and skip the backlog. We only want to
  // act on bookings that arrive AFTER the listener is healthy — never blast
  // weeks of already-handled appointments with payment requests.
  if (!highWater || highWater.uidValidity !== uidValidity) {
    await setImapHighWater(maxUid, uidValidity);
    logEvent("doctoralia.imap.highwater_init", { maxUid, uidValidity });
    return;
  }

  const freshUids = allUids.filter((uid) => uid > highWater.lastUid).sort((a, b) => a - b);
  if (freshUids.length === 0) return;

  logEvent("doctoralia.imap.found", { count: freshUids.length, sinceUid: highWater.lastUid });

  let newLastUid = highWater.lastUid;
  let blocked = false;
  for (const uid of freshUids) {
    if (stopped) break;

    let ok = false;
    let messageId: string | undefined;
    try {
      const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
      messageId = msg ? msg.envelope?.messageId : undefined;

      if (msg && msg.source) {
        const raw = msg.source.toString("utf-8");
        const parsed = await simpleParser(raw);
        const textContent = parsed.text ?? htmlToText(parsed.html || "");

        const booking = parseDoctoraliaEmail(textContent);
        if (booking) {
          logEvent("doctoralia.imap.parsed", {
            type: booking.eventType,
            date: booking.appointmentDate?.toISOString(),
            patientPhone: booking.patientPhone,
          });

          // Prevent duplication if the same Message-ID is processed twice
          const existing = messageId
            ? await db.doctoraliaEmailNotification.findUnique({
                where: { emailMessageId: messageId },
              })
            : null;

          let savedNotifId = existing?.id;
          if (!existing) {
            const created = await db.doctoraliaEmailNotification.create({
              data: {
                emailMessageId: messageId ?? `msg_${createId()}`,
                eventType: booking.eventType,
                patientName: booking.patientName,
                patientPhone: booking.patientPhone,
                patientEmail: booking.patientEmail,
                appointmentDate: booking.appointmentDate,
                previousAppointmentDate: booking.previousAppointmentDate,
                appointmentService: booking.appointmentService,
                appointmentDoctor: booking.appointmentDoctor,
                clinicAddress: booking.clinicAddress,
              },
            });
            savedNotifId = created.id;
          }

          logEvent("doctoralia.imap.db_saved", {
            notificationId: savedNotifId,
            patientName: booking.patientName,
          });

          // WA NOTIFICATION — primera cita auto-agendada → link de pago dinámico
          if (
            booking.eventType === "BOOKING" &&
            booking.isFirstAppointment &&
            booking.isAutoAppointment &&
            booking.patientPhone &&
            booking.appointmentDate
          ) {
            // Crear token de pago idempotente (si ya existe para este email, lo reutiliza).
            if (!booking.appointmentDoctor || !booking.appointmentService) {
              logError(
                "doctoralia.imap.payment_token_invalid",
                new Error("Missing doctor/service in Doctoralia email"),
                {
                  hasDoctor: Boolean(booking.appointmentDoctor),
                  hasService: Boolean(booking.appointmentService),
                  notificationId: savedNotifId,
                }
              );
            } else {
              const appointmentDoctor = booking.appointmentDoctor;
              const appointmentService = booking.appointmentService;
              const existingToken = await db.appointmentPaymentToken.findFirst({
                where: { emailNotificationId: savedNotifId },
              });
              const paymentSettings = await loadAbonoPaymentSettings();

              const paymentToken =
                existingToken ??
                (await db.appointmentPaymentToken.create({
                  data: {
                    id: createId(),
                    emailNotificationId: savedNotifId,
                    patientName: booking.patientName,
                    patientPhone: booking.patientPhone,
                    patientEmail: booking.patientEmail ?? null,
                    appointmentDate: booking.appointmentDate,
                    doctorName: appointmentDoctor,
                    serviceName: appointmentService,
                    isFonasa: false,
                    fullAmountClp: paymentSettings.particularFullAmountClp,
                    halfAmountClp: Math.round(paymentSettings.particularFullAmountClp / 2),
                    expiresAt: new Date(
                      Date.now() + paymentSettings.expirationDays * 24 * 60 * 60 * 1000
                      ),
                    },
                  }));
              await appendAbonoFlowHistory(paymentToken.id, existingToken ? "token_reused" : "token_created", {
                emailNotificationId: savedNotifId,
              });

              try {
                const sent = await sendAbonoRequestWhatsapp(paymentToken, deps);
                logEvent("doctoralia.imap.whatsapp_result", {
                  result: sent,
                  tokenId: paymentToken.id,
                });
              } catch (waErr) {
                await appendAbonoFlowHistory(paymentToken.id, "wa_request_failed", {}, waErr);
                logError("doctoralia.imap.whatsapp_err", waErr, {
                  phone: booking.patientPhone,
                  tokenId: paymentToken.id,
                });
              }
            }
          }
        }
      }

      ok = true;
      listenerStatus.lastProcessedAt = new Date().toISOString();
    } catch (dbErr) {
      listenerStatus.lastErrorAt = new Date().toISOString();
      listenerStatus.lastErrorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logError("doctoralia.imap.db_error", dbErr, { messageId });
    }

    // Advance the high-water mark only across the contiguous run of
    // successfully-processed UIDs. The first failure (transient DB/IMAP error)
    // freezes the mark so that UID — and everything after it — stays retryable
    // on the next scan; a booking that hit a transient error is never skipped.
    // Parse misses don't throw (they fall through as success), so a non-booking
    // email still advances the mark and can't wedge the queue.
    if (ok && !blocked) {
      newLastUid = uid;
    } else if (!ok) {
      blocked = true;
    }
  }

  if (newLastUid > highWater.lastUid) {
    await setImapHighWater(newLastUid, uidValidity).catch((err) =>
      logError("doctoralia.imap.highwater_persist_error", err, { lastUid: newLastUid })
    );
  }
}

async function connect(config: ImapConfig, deps: ImapListenerDependencies): Promise<void> {
  if (stopped) return;

  const client = new ImapFlow({
    auth: { pass: config.pass, user: config.user },
    host: config.host,
    logger: false,
    // Break+restart IDLE every 5 min so a half-open socket surfaces (next
    // command throws → 'error'/'close' → reconnect) instead of hanging silent.
    maxIdleTime: 5 * 60_000,
    port: config.port,
    secure: config.secure,
  });

  // Serialize processUnseen so overlapping triggers (the initial drain + rapid
  // 'exists' events) never run concurrently. If a trigger lands mid-scan, queue
  // a single re-run so a late email isn't missed. State is scoped to THIS
  // connection (closure, not module-global) so a slow scan on a dead connection
  // can't swallow a fresh connection's drain after reconnect, nor run a queued
  // rerun against the wrong client. Returns false if a scan threw, so the caller
  // (initial drain) can force a reconnect instead of proceeding to IDLE.
  let scanRunning = false;
  let scanQueued = false;
  const runScan = async (): Promise<boolean> => {
    if (scanRunning) {
      scanQueued = true;
      return true;
    }
    scanRunning = true;
    let ok = true;
    try {
      do {
        scanQueued = false;
        await processUnseen(client, config, deps);
      } while (scanQueued && !stopped);
    } catch (err) {
      ok = false;
      logError("doctoralia.imap.process_error", err, { host: config.host });
    } finally {
      scanRunning = false;
    }
    return ok;
  };

  let reconnectScheduled = false;
  const scheduleReconnect = (): void => {
    if (reconnectScheduled || stopped) return;
    reconnectScheduled = true;
    const delay = reconnectDelay;
    listenerStatus.reconnectDelayMs = delay;
    logEvent("doctoralia.imap.reconnect", { delayMs: delay });
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    setTimeout(() => connect(config, deps), delay);
  };

  // Real-time: imapflow auto-IDLEs and emits 'exists' the instant the server
  // pushes new mail. This is the golden pattern (imapflow docs) — react to the
  // EVENT, not to idle() resolving. The old `while { idle(); scan() }` loop only
  // processed when idle() returned, so a server push (which fires 'exists' but
  // does NOT resolve idle()) left fresh bookings unprocessed until reconnect.
  client.on("exists", () => {
    void runScan();
  });
  client.on("error", (err: unknown) => {
    listenerStatus.state = "error";
    listenerStatus.lastErrorAt = new Date().toISOString();
    listenerStatus.lastErrorMessage = err instanceof Error ? err.message : String(err);
    logError("doctoralia.imap.error", err, { host: config.host });
  });
  client.on("close", () => {
    scheduleReconnect();
  });

  try {
    listenerStatus.state = "connecting";
    listenerStatus.reconnectDelayMs = reconnectDelay;
    await client.connect();
    listenerStatus.state = "connected";
    listenerStatus.lastConnectedAt = new Date().toISOString();
    listenerStatus.reconnectDelayMs = null;
    logEvent("doctoralia.imap.connected", { host: config.host, user: config.user });
    reconnectDelay = RECONNECT_DELAY_MS;

    // Keep the mailbox open for the life of the connection (NOT getMailboxLock,
    // which is for short ops) so imapflow auto-IDLEs and surfaces 'exists'.
    await client.mailboxOpen(config.mailbox);
    // Drain mail that arrived while the listener was down (IDLE only fires on
    // NEW changes; backlog would otherwise wait for an unrelated event). If the
    // drain throws (transient DB/IMAP error), reconnect to retry — proceeding to
    // IDLE would leave that backlog stuck until the next unrelated reconnect.
    const drained = await runScan();
    if (!drained) throw new Error("initial inbox drain failed");
    // Kick IDLE now (imapflow also auto-IDLEs after a short delay); it
    // auto-restarts. Then hold this function open until the socket closes or the
    // listener is stopped — processing is driven entirely by the 'exists'
    // handler, never by idle() resolving.
    void client.idle().catch((idleErr: unknown) => {
      logError("doctoralia.imap.idle_error", idleErr, { host: config.host });
    });
    await new Promise<void>((resolve) => {
      if (stopped) {
        resolve();
        return;
      }
      const done = (): void => {
        stopResolvers.delete(done);
        resolve();
      };
      stopResolvers.add(done);
      client.once("close", done);
    });
  } catch (err) {
    listenerStatus.state = "error";
    listenerStatus.lastErrorAt = new Date().toISOString();
    listenerStatus.lastErrorMessage = err instanceof Error ? err.message : String(err);
    logError("doctoralia.imap.error", err, { host: config.host });
    scheduleReconnect();
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export function startDoctoraliaImapListener(deps: ImapListenerDependencies): void {
  const config = getImapConfig();
  listenerStatus.enabled = process.env.ENABLE_DOCTORALIA_IMAP === "true";
  if (!config) {
    listenerStatus.host = process.env.DOCTORALIA_IMAP_HOST ?? null;
    listenerStatus.mailbox = process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX";
    listenerStatus.state = "missing_config";
    listenerStatus.user = process.env.DOCTORALIA_IMAP_USER ?? null;
    logWarn("doctoralia.imap.skip", { reason: "missing_imap_config" });
    return;
  }
  stopped = false;
  listenerStatus.host = config.host;
  listenerStatus.lastStartedAt = new Date().toISOString();
  listenerStatus.mailbox = config.mailbox;
  listenerStatus.state = "connecting";
  listenerStatus.user = config.user;
  logEvent("doctoralia.imap.start", { host: config.host, mailbox: config.mailbox });
  connect(config, deps);
}

export function stopDoctoraliaImapListener(): void {
  stopped = true;
  listenerStatus.state = "stopped";
  for (const resolve of stopResolvers) resolve();
  stopResolvers.clear();
}
