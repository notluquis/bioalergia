import { db } from "@finanzas/db";
import { logEvent } from "../lib/logger.ts";
import { getEmailProvider, getEmailSenders } from "./email/index.ts";

// Server-side outreach campaign sending via Resend (replaces the old browser →
// local-mail-agent flow). Respects the campaign's per-hour rate cap, sends each
// pending delivery, updates its status + the establishment/interaction trail.
// From = the verified broadcast sender (campaign.fromEmail isn't on the Resend
// domain); the campaign's address is preserved as Reply-To.

export interface OutreachBatchResult {
  sent: number;
  failed: number;
  remaining: number;
}

export async function sendOutreachNextBatch(
  campaignId: number,
  requestedLimit: number
): Promise<OutreachBatchResult> {
  const campaign = await db.outreachEmailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.estado !== "ENVIANDO") {
    const remaining = campaign
      ? await db.outreachEmailDelivery.count({
          where: { campaignId, estado: "PENDIENTE" },
        })
      : 0;
    return { sent: 0, failed: 0, remaining };
  }

  // Rate cap: never exceed ratePerHour sends in the trailing hour.
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const sentLastHour = await db.outreachEmailDelivery.count({
    where: { campaignId, estado: "ENVIADO", enviadoEn: { gte: sinceHour } },
  });
  const cap = Math.max(0, campaign.ratePerHour - sentLastHour);
  const limit = Math.min(requestedLimit, cap);

  if (limit <= 0) {
    const remaining = await db.outreachEmailDelivery.count({
      where: { campaignId, estado: "PENDIENTE" },
    });
    return { sent: 0, failed: 0, remaining };
  }

  const pending = await db.outreachEmailDelivery.findMany({
    where: { campaignId, estado: "PENDIENTE" },
    orderBy: { id: "asc" },
    take: limit,
  });

  const senders = await getEmailSenders();
  const provider = getEmailProvider();
  const replyTo = campaign.replyTo || campaign.fromEmail || senders.replyTo || undefined;

  let sent = 0;
  let failed = 0;

  for (const d of pending) {
    try {
      await provider.send({
        to: d.emailDestinatario,
        from: senders.broadcastFrom,
        replyTo,
        subject: d.asuntoRender ?? campaign.asunto,
        html: d.cuerpoHtmlRender ?? campaign.cuerpoHtml,
        text: d.cuerpoTextoRender ?? campaign.cuerpoTexto,
      });
      await markDeliverySent(d.id);
      sent++;
    } catch (err) {
      await db.outreachEmailDelivery.update({
        where: { id: d.id },
        data: {
          estado: "ERROR",
          errorMensaje: err instanceof Error ? err.message.slice(0, 500) : "send failed",
          intentos: { increment: 1 },
        },
      });
      failed++;
    }
  }

  await db.outreachEmailCampaign.update({
    where: { id: campaignId },
    data: { enviados: { increment: sent }, errores: { increment: failed } },
  });

  const remaining = await db.outreachEmailDelivery.count({
    where: { campaignId, estado: "PENDIENTE" },
  });
  if (remaining === 0) {
    await db.outreachEmailCampaign.update({
      where: { id: campaignId },
      data: { estado: "COMPLETADA" },
    });
  }

  logEvent("[outreach-email] batch", { campaignId, sent, failed, remaining });
  return { sent, failed, remaining };
}

// Mirror the bookkeeping the old recordDeliveryResult did on success: mark the
// delivery, log the interaction, advance the establishment state.
async function markDeliverySent(deliveryId: number): Promise<void> {
  const delivery = await db.outreachEmailDelivery.update({
    where: { id: deliveryId },
    data: {
      estado: "ENVIADO",
      errorMensaje: null,
      enviadoEn: new Date(),
      intentos: { increment: 1 },
    },
  });
  await db.outreachInteraction.create({
    data: {
      establecimientoRbd: delivery.establecimientoRbd,
      contactoId: delivery.contactoId,
      tipo: "EMAIL_ENVIADO",
      fecha: new Date(),
      asunto: delivery.asuntoRender,
      contenido: delivery.cuerpoTextoRender ?? "",
      emailHacia: delivery.emailDestinatario,
      creadoPorNombre: "Campaña (Resend)",
    },
  });
  await db.outreachEstablishment.update({
    where: { rbd: delivery.establecimientoRbd },
    data: { ultimoContactoAt: new Date(), estado: "CONTACTADO" },
  });
}
