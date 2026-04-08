/**
 * IMAP inbox monitor for Doctoralia booking notification emails.
 * Polls the configured mailbox, parses new booking emails,
 * sends WhatsApp messages via Baileys, and logs results to the database.
 */
import { db } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import dayjs from "dayjs";
import { ImapFlow } from "imapflow";
import { resolveDoctoraliaSenderSearchTerms } from "../doctoralia/imap-search";
import { logError, logEvent, logWarn } from "../logger";
import { sendText } from "./baileys-socket";
import { decodeEmailBody, htmlToText, isLikelyDoctoraliaEmail, parseDoctoraliaEmail } from "./email-parser";
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
    senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia",
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
    disableAutoIdle: true,
    host: config.host,
    logger: false,
    missingIdleCommand: "NOOP",
    port: config.port,
    secure: config.secure,
    socketTimeout: 10 * 60_000,
  });

  client.on("error", (err) => {
    logError("whatsapp.imap.client_error", err, { host: config.host });
  });

  try {
    await client.connect();
    await client.mailboxOpen(config.mailbox);

    // Search for unseen emails from Doctoralia
    const uidSet = new Set<number>();
    const matchedSenderTermsByUid = new Map<number, Set<string>>();
    for (const senderTerm of resolveDoctoraliaSenderSearchTerms(config.senderFilter)) {
      const searchResult = await client.search({
        from: senderTerm,
        seen: false,
      });
      const matchingUids = Array.isArray(searchResult) ? searchResult : [];
      for (const uid of matchingUids) {
        uidSet.add(uid);
        const matchedTerms = matchedSenderTermsByUid.get(uid) ?? new Set<string>();
        matchedTerms.add(senderTerm);
        matchedSenderTermsByUid.set(uid, matchedTerms);
      }
    }
    const uids = [...uidSet].sort((a, b) => a - b);

    result.checked = uids.length;

    if (uids.length === 0) {
      return result;
    }

    logEvent("whatsapp.imap.found", {
      count: uids.length,
      senderTerms: resolveDoctoraliaSenderSearchTerms(config.senderFilter),
    });

    for await (const msg of client.fetch(uids, {
      bodyParts: ["TEXT", "1"],
      bodyStructure: true,
      envelope: true,
      source: true,
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

      logEvent("whatsapp.imap.message_seen", messageContext);

      // Check for dedup - already processed this email
      try {
        const existing = await db.$qb
          .selectFrom("WhatsappNotification")
          .select(["id"])
          .where("emailMessageId", "=", messageId)
          .executeTakeFirst();

        if (existing) {
          result.skipped++;
          logEvent("whatsapp.imap.message_dedup_skip", messageContext);
          // Mark as seen so we don't keep re-fetching
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
          continue;
        }
      } catch {
        // If DB check fails, skip this email to be safe
        result.skipped++;
        logWarn("whatsapp.imap.message_dedup_failed", messageContext);
        continue;
      }

      // Parse the email body
      let emailText = "";
      try {
        const charset =
          msg.bodyStructure?.parameters?.charset ??
          msg.bodyStructure?.childNodes?.[0]?.parameters?.charset ??
          "utf-8";
        const encoding =
          msg.bodyStructure?.encoding ?? msg.bodyStructure?.childNodes?.[0]?.encoding ?? null;
        const rawBuffer = msg.bodyParts?.get("1") ?? msg.bodyParts?.get("TEXT");

        if (rawBuffer) {
          const rawText = decodeEmailBody({ bodyBuffer: rawBuffer, charset, encoding });
          // Try to extract plain text from HTML
          if (rawText.includes("<html") || rawText.includes("<HTML")) {
            emailText = htmlToText(rawText);
          } else {
            emailText = rawText;
          }
        }
      } catch (err) {
        logError("whatsapp.imap.parse_error", err, messageContext);
      }

      if (emailText && !isLikelyDoctoraliaEmail(emailText, { subject })) {
        logWarn("whatsapp.imap.skip_non_doctoralia", {
          ...messageContext,
          extractedTextLength: emailText.length,
        });
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        result.skipped++;
        continue;
      }

      const booking = emailText ? parseDoctoraliaEmail(emailText) : null;

      if (!booking) {
        logWarn("whatsapp.imap.no_booking", {
          ...messageContext,
          extractedTextLength: emailText.length,
        });
        // Mark as seen so we don't re-process indefinitely
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        result.skipped++;
        continue;
      }

      logEvent("whatsapp.imap.parse_ok", {
        ...messageContext,
        appointmentDate: booking.appointmentDate?.toISOString() ?? null,
        eventType: booking.eventType,
        patientName: booking.patientName,
        patientPhone: booking.patientPhone ?? null,
        service: booking.appointmentService ?? null,
      });

      if (!booking.patientPhone) {
        logWarn("whatsapp.imap.no_phone", {
          ...messageContext,
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
          ...messageContext,
          patientName: booking.patientName,
          phone: normalizedPhone,
          waMessageId,
        });
      } catch (err) {
        status = "FAILED";
        errorMessage = err instanceof Error ? err.message : String(err);
        result.failed++;
        logError("whatsapp.message.failed", err, {
          ...messageContext,
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
        logError("whatsapp.db.insert_error", dbErr, {
          ...messageContext,
          patientName: booking.patientName,
          status,
        });
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
