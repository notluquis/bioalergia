// Notify the clinic receptionists ("las chiquillas") on their WhatsApp phones
// when an abono payment lands — they work from WhatsApp, not the intranet, and
// need to annotate the deposit in Doctoralia by hand. We send a UTILITY template
// from the Cloud number to each configured staff phone (Cloud API has no group
// send). Card = text; transfer = the receipt image as a dynamic IMAGE header.
//
// Best-effort: a failure here never breaks the payment flow.

import { db } from "@finanzas/db";
import {
  type AbonoStaffNotifyConfig,
  loadAbonoStaffNotifyConfig,
} from "../lib/doctoralia/abono-whatsapp-settings.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";
import { formatChile } from "../lib/time.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { downloadMediaBytes, uploadMedia } from "../modules/wa-cloud/graph-client.ts";
import { ensureContactAndConversation } from "./wa-contacts.ts";
import { sendTemplate } from "./wa-messages.ts";

const clp = (n: number): string =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

function fechaCita(date: Date): string {
  const raw = formatChile(date, "dddd D [de] MMMM [a las] HH:mm");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Send one template to every configured staff phone (best-effort per phone).
async function fanout(
  cfg: AbonoStaffNotifyConfig,
  templateName: string,
  bodyNamedParams: Array<{ name: string; text: string }>,
  imageHeaderMediaId?: string
): Promise<number> {
  if (cfg.phoneNumberId == null || !cfg.language) return 0;
  let sent = 0;
  for (const phone of cfg.phones) {
    try {
      const { conversationId } = await ensureContactAndConversation(
        phone,
        "Recepción Bioalergia",
        cfg.phoneNumberId
      );
      await sendTemplate(
        {
          conversationId,
          phoneNumberId: cfg.phoneNumberId,
          templateName,
          language: cfg.language,
          bodyNamedParams,
          ...(imageHeaderMediaId ? { imageHeaderMediaId } : {}),
        },
        null
      );
      sent++;
    } catch (err) {
      logError("abono.staff_notify.send_error", err, { phone, templateName });
    }
  }
  return sent;
}

/** Card payment cleared (MercadoPago) → text notice to staff. */
export async function notifyStaffCardPayment(tokenId: string): Promise<void> {
  const cfg = await loadAbonoStaffNotifyConfig();
  if (!cfg.enabled || cfg.phones.length === 0 || !cfg.cardTemplateName) return;
  const token = await db.appointmentPaymentToken.findUnique({ where: { id: tokenId } });
  if (!token) return;
  const sent = await fanout(cfg, cfg.cardTemplateName, [
    { name: "paciente", text: token.patientName },
    { name: "fecha", text: fechaCita(token.appointmentDate) },
    { name: "monto", text: clp(token.paidAmountClp ?? 0) },
  ]);
  await appendAbonoFlowHistory(token.id, "staff_notified_card", {
    phones: cfg.phones.length,
    sent,
  });
  logEvent("abono.staff_notify.card", { tokenId, sent });
}

/**
 * Patient sent a transfer receipt (IMAGE) into an abono conversation → forward
 * it to staff as the IMAGE header of the comprobante template. Re-downloads the
 * inbound media from Meta and re-uploads it (the durable R2 copy may not exist
 * yet at webhook time, and a Meta media id is scoped to the receiving number).
 */
export async function notifyStaffComprobante(waMessageId: number): Promise<void> {
  const cfg = await loadAbonoStaffNotifyConfig();
  if (
    !cfg.enabled ||
    cfg.phones.length === 0 ||
    !cfg.comprobanteTemplateName ||
    cfg.phoneNumberId == null
  ) {
    return;
  }

  const msg = await db.waMessage.findUnique({
    where: { id: waMessageId },
    select: {
      phoneNumberId: true,
      mediaMimeType: true,
      payload: true,
      contact: { select: { phoneE164: true } },
    },
  });
  if (!msg?.contact?.phoneE164) return;

  // Pending abonos for this patient (matched by phone). If more than one, we
  // can't tell which appointment the receipt is for — forward the image with an
  // explicit "verify which" note instead of guessing a wrong patient/date.
  const pending = await db.appointmentPaymentToken.findMany({
    where: { patientPhone: msg.contact.phoneE164, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const token = pending[0];
  if (!token) return;
  const ambiguous = pending.length > 1;

  const metaMediaId = (msg.payload as { image?: { id?: string } } | null)?.image?.id;
  const account = await db.waPhoneNumber.findUnique({
    where: { id: msg.phoneNumberId },
    select: { accountId: true },
  });
  if (!metaMediaId || !account) return;

  let imageHeaderMediaId: string | undefined;
  try {
    const { bytes, mimeType } = await downloadMediaBytes(metaMediaId, account.accountId);
    const mime = msg.mediaMimeType ?? mimeType;
    // Upload under the SENDING phone (cfg.phoneNumberId) — a Meta media id is
    // scoped to the phone it's uploaded to, and fanout sends from cfg.phoneNumberId.
    const uploaded = await uploadMedia(
      cfg.phoneNumberId,
      new Blob([bytes] as BlobPart[], { type: mime }),
      mime,
      "comprobante"
    );
    imageHeaderMediaId = uploaded.id;
  } catch (err) {
    logError("abono.staff_notify.media_error", err, { waMessageId });
    return; // the comprobante template needs the image header
  }

  const sent = await fanout(
    cfg,
    cfg.comprobanteTemplateName,
    [
      {
        name: "paciente",
        text: ambiguous
          ? "⚠️ Varios abonos pendientes de este número — verifica cuál"
          : token.patientName,
      },
      { name: "fecha", text: ambiguous ? "—" : fechaCita(token.appointmentDate) },
    ],
    imageHeaderMediaId
  );
  await appendAbonoFlowHistory(token.id, "staff_notified_comprobante", { sent, ambiguous });
  logEvent("abono.staff_notify.comprobante", { tokenId: token.id, waMessageId, sent });
}
