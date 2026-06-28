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
    logError("doctoralia.abono.whatsapp_config_missing", new Error("Missing request WA setting"), {
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

  const firstName = token.patientName.split(" ")[0] ?? token.patientName;
  const fechaHora = formatChile(token.appointmentDate, "dddd D [de] MMMM [a las] HH:mm [hrs]");
  // Prices come from settings (single source of truth — same values the page
  // charges). Named params + dynamic URL button suffix (the token id; the
  // template URL base is static). The page handles previsión selection.
  const clp = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
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
        { name: "nombre_paciente", text: firstName },
        { name: "fecha_hora", text: fechaHora },
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

async function processUnseen(
  client: ImapFlow,
  config: ImapConfig,
  deps: ImapListenerDependencies
): Promise<void> {
  const uids = await client.search({ from: config.senderFilter, seen: false });
  if (uids === false || uids.length === 0) return;

  logEvent("doctoralia.imap.found", { count: uids.length });

  for (const uid of uids) {
    if (stopped) break;

    let messageId: string | undefined;
    try {
      const msg = await client.fetchOne(uid, {
        envelope: true,
        source: true,
      });
      if (!msg) continue;

      messageId = msg.envelope?.messageId;

      if (msg.source) {
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

      // Mark as seen so we don't process it again (if not already handled by IDLE)
      await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
      listenerStatus.lastProcessedAt = new Date().toISOString();
    } catch (dbErr) {
      listenerStatus.lastErrorAt = new Date().toISOString();
      listenerStatus.lastErrorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logError("doctoralia.imap.db_error", dbErr, { messageId });
    }
  }
}

async function connect(config: ImapConfig, deps: ImapListenerDependencies): Promise<void> {
  if (stopped) return;

  const client = new ImapFlow({
    auth: { pass: config.pass, user: config.user },
    host: config.host,
    logger: false,
    // Heartbeat: break+restart IDLE every 5 min so a half-open socket is
    // detected (next command throws → reconnect) instead of hanging silently,
    // and processUnseen runs at least every 5 min as a backstop.
    maxIdleTime: 5 * 60_000,
    port: config.port,
    secure: config.secure,
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

    const lock = await client.getMailboxLock(config.mailbox);
    try {
      // Drain mail that arrived while the listener was down — IDLE only fires
      // on NEW changes, so backlog would otherwise wait for an unrelated event.
      await processUnseen(client, config, deps);
      while (!stopped) {
        await client.idle();
        await processUnseen(client, config, deps);
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    listenerStatus.state = "error";
    listenerStatus.lastErrorAt = new Date().toISOString();
    listenerStatus.lastErrorMessage = err instanceof Error ? err.message : String(err);
    logError("doctoralia.imap.error", err, { host: config.host });
  } finally {
    await client.logout().catch(() => undefined);
  }

  if (!stopped) {
    listenerStatus.reconnectDelayMs = reconnectDelay;
    logEvent("doctoralia.imap.reconnect", { delayMs: reconnectDelay });
    setTimeout(() => connect(config, deps), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
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
}
