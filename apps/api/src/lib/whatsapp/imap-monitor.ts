/**
 * IMAP inbox monitor for Doctoralia booking notification emails.
 * Polls the configured mailbox, parses new booking emails,
 * sends WhatsApp messages via Baileys, and logs results to the database.
 */
import { db } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import dayjs from "dayjs";
import { ImapFlow } from "imapflow";
import { logError, logEvent, logWarn } from "../logger";
import { sendText } from "./baileys-socket";
import { htmlToText, parseDoctoraliaEmail } from "./email-parser";
import { normalizePhone } from "./jid";

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  mailbox: string;
  senderFilter: string;
}

function getImapConfig(): ImapConfig | null {
  const user = process.env.DOCTORALIA_IMAP_USER;
  const pass = process.env.DOCTORALIA_IMAP_PASS;
  const host = process.env.DOCTORALIA_IMAP_HOST;

  if (!user || !pass || !host) {
    return null;
  }

  return {
    host,
    mailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
    pass,
    port: parseInt(process.env.DOCTORALIA_IMAP_PORT ?? "993", 10),
    secure: process.env.DOCTORALIA_IMAP_SECURE !== "0",
    senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia.com",
    user,
  };
}

function buildDoctoraliaMessage(booking: NonNullable<ReturnType<typeof parseDoctoraliaEmail>>) {
  const template = process.env.WHATSAPP_FREEFORM_MESSAGE?.trim();
  const appointmentDate = booking.appointmentDate
    ? dayjs(booking.appointmentDate).format("DD/MM/YYYY HH:mm")
    : "";
  const replacements: Record<string, string> = {
    appointmentDate,
    appointmentDoctor: booking.appointmentDoctor ?? "",
    appointmentService: booking.appointmentService ?? "",
    clinicAddress: booking.clinicAddress ?? "",
    patientName: booking.patientName,
  };

  if (template) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => replacements[key] ?? "");
  }

  const details = [
    booking.appointmentService ? `Servicio: ${booking.appointmentService}` : null,
    booking.appointmentDoctor ? `Profesional: ${booking.appointmentDoctor}` : null,
    appointmentDate ? `Fecha: ${appointmentDate}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Hola ${booking.patientName}, te escribimos de Bioalergia.`,
    "Vimos tu reserva en Doctoralia.",
    details,
    "Si necesitas ajustar o confirmar algo, responde este mensaje.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface PollResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runImapPoll(): Promise<PollResult> {
  const config = getImapConfig();
  if (!config) {
    logWarn("whatsapp.imap.skip", { reason: "missing_imap_config" });
    return { checked: 0, failed: 0, sent: 0, skipped: 0 };
  }

  const result: PollResult = { checked: 0, failed: 0, sent: 0, skipped: 0 };

  const client = new ImapFlow({
    auth: { pass: config.pass, user: config.user },
    host: config.host,
    logger: false,
    port: config.port,
    secure: config.secure,
  });

  try {
    await client.connect();
    await client.mailboxOpen(config.mailbox);

    // Search for unseen emails from Doctoralia
    const searchResult = await client.search({
      from: config.senderFilter,
      seen: false,
    });
    const uids = Array.isArray(searchResult) ? searchResult : [];

    result.checked = uids.length;

    if (uids.length === 0) {
      return result;
    }

    logEvent("whatsapp.imap.found", { count: uids.length });

    for await (const msg of client.fetch(uids, {
      bodyParts: ["TEXT", "1"],
      envelope: true,
      source: true,
    })) {
      const messageId = msg.envelope?.messageId ?? `imap-${msg.uid}`;

      // Check for dedup - already processed this email
      try {
        const existing = await db.$qb
          .selectFrom("WhatsappNotification")
          .select(["id"])
          .where("emailMessageId", "=", messageId)
          .executeTakeFirst();

        if (existing) {
          result.skipped++;
          // Mark as seen so we don't keep re-fetching
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
          continue;
        }
      } catch {
        // If DB check fails, skip this email to be safe
        result.skipped++;
        continue;
      }

      // Parse the email body
      let emailText = "";
      try {
        const rawBuffer = msg.source;
        if (rawBuffer) {
          const rawText = rawBuffer.toString("utf-8");
          // Try to extract plain text from HTML
          if (rawText.includes("<html") || rawText.includes("<HTML")) {
            emailText = htmlToText(rawText);
          } else {
            emailText = rawText;
          }
        }
      } catch (err) {
        logError("whatsapp.imap.parse_error", err, { messageId });
      }

      const booking = emailText ? parseDoctoraliaEmail(emailText) : null;

      if (!booking) {
        logWarn("whatsapp.imap.no_booking", { messageId, subject: msg.envelope?.subject });
        // Mark as seen so we don't re-process indefinitely
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        result.skipped++;
        continue;
      }

      if (!booking.patientPhone) {
        logWarn("whatsapp.imap.no_phone", {
          messageId,
          patientName: booking.patientName,
        });
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        result.skipped++;
        continue;
      }

      // Send WhatsApp message via Baileys
      const normalizedPhone = normalizePhone(booking.patientPhone);
      const message = buildDoctoraliaMessage(booking);
      let waMessageId: string | null = null;
      let status: "SENT" | "FAILED" = "SENT";
      let errorMessage: string | null = null;
      let sentAt: Date | null = null;

      try {
        const sendResult = await sendText(normalizedPhone, message);
        waMessageId = sendResult.messageId;
        sentAt = new Date();
        result.sent++;

        logEvent("whatsapp.message.sent", {
          messageId,
          patientName: booking.patientName,
          phone: normalizedPhone,
          waMessageId,
        });
      } catch (err) {
        status = "FAILED";
        errorMessage = err instanceof Error ? err.message : String(err);
        result.failed++;
        logError("whatsapp.message.failed", err, {
          messageId,
          patientName: booking.patientName,
          phone: normalizedPhone,
        });
      }

      // Log to DB
      const now = new Date().toISOString();
      try {
        await db.$qb
          .insertInto("WhatsappNotification")
          .values({
            appointmentDate: booking.appointmentDate?.toISOString() ?? null,
            appointmentDoctor: booking.appointmentDoctor ?? null,
            appointmentService: booking.appointmentService ?? null,
            createdAt: now,
            emailMessageId: messageId,
            errorMessage: errorMessage ?? null,
            id: createId(),
            messagePacingStatus: null,
            patientEmail: booking.patientEmail ?? null,
            patientName: booking.patientName,
            patientPhone: booking.patientPhone,
            recipientWaId: null,
            sentAt: sentAt?.toISOString() ?? null,
            status,
            updatedAt: now,
            waMessageId: waMessageId ?? null,
          })
          .execute();
      } catch (dbErr) {
        logError("whatsapp.db.insert_error", dbErr, { messageId });
      }

      // Mark email as seen
      await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  logEvent("whatsapp.imap.poll_done", { ...result });
  return result;
}
