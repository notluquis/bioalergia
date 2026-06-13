// Send a scheduled WhatsApp message at its due time. Driven by the
// `send_wa_scheduled` graphile-worker task (one-shot; enqueued by the
// scheduleMessage handler with runAt = scheduledAt). Mirrors the inline send +
// persistence of the sendMessage/sendTemplate oRPC handlers, but lives in the
// service layer (golden 2026: no business logic in tasks/handlers).

import { db } from "@finanzas/db";
import { logError, logEvent } from "../lib/logger.ts";
import { sendTemplateMessage, sendTextMessage } from "../modules/wa-cloud/graph-client.ts";

export type ScheduledSendResult = { status: string };

export async function sendScheduledMessage(
  scheduledMessageId: number
): Promise<ScheduledSendResult> {
  const sm = await db.waScheduledMessage.findUnique({
    where: { id: scheduledMessageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!sm) return { status: "missing" };
  // Only PENDING sends. CANCELLED/SENT/FAILED → no-op (a cancelled job that
  // still fires harmlessly lands here).
  if (sm.status !== "PENDING") return { status: sm.status };

  const contact = sm.conversation.contact;
  if (contact.blockedAt) {
    await db.waScheduledMessage.update({
      where: { id: sm.id },
      data: { status: "FAILED", errorMessage: "Contacto bloqueado" },
    });
    return { status: "FAILED" };
  }

  try {
    let metaId: string | null = null;
    let preview: string;
    let payload: Record<string, unknown> | null = null;

    if (sm.type === "TEMPLATE") {
      if (!sm.templateName || !sm.templateLanguage) {
        // Schema refine guarantees these, but guard rather than assert.
        await db.waScheduledMessage.update({
          where: { id: sm.id },
          data: { status: "FAILED", errorMessage: "Plantilla incompleta" },
        });
        return { status: "FAILED" };
      }
      const vars = (sm.templateVars as unknown as string[]) ?? [];
      const components =
        vars.length > 0
          ? [{ type: "body", parameters: vars.map((t) => ({ type: "text", text: t })) }]
          : [];
      const resp = await sendTemplateMessage({
        phoneNumberId: sm.phoneNumberId,
        toE164: contact.phoneE164,
        templateName: sm.templateName,
        language: sm.templateLanguage,
        components: components as never,
      });
      metaId = resp.messages?.[0]?.id ?? null;
      preview = `[plantilla] ${sm.templateName}`;
      payload = { components, scheduled: true, scheduledMessageId: sm.id };
    } else {
      // TEXT — requires the 24h window open at send time; if Meta rejects
      // (window closed), the catch below records it as FAILED.
      const resp = await sendTextMessage({
        phoneNumberId: sm.phoneNumberId,
        toE164: contact.phoneE164,
        body: sm.body ?? "",
        contextMessageId: sm.contextMetaMessageId ?? undefined,
      });
      metaId = resp.messages?.[0]?.id ?? null;
      preview = (sm.body ?? "").slice(0, 200);
    }

    const now = new Date();
    const message = await db.waMessage.create({
      data: {
        conversationId: sm.conversationId,
        contactId: sm.contactId,
        phoneNumberId: sm.phoneNumberId,
        metaMessageId: metaId,
        direction: "OUTBOUND",
        type: sm.type,
        status: "SENT",
        body: sm.type === "TEMPLATE" ? preview : sm.body,
        templateName: sm.type === "TEMPLATE" ? sm.templateName : null,
        templateLanguage: sm.type === "TEMPLATE" ? sm.templateLanguage : null,
        sentByUserId: sm.createdByUserId,
        contextMetaMessageId: sm.contextMetaMessageId ?? null,
        payload: payload as never,
        timestamp: now,
      },
    });
    await db.waConversation.update({
      where: { id: sm.conversationId },
      data: { lastMessageAt: now, lastMessagePreview: preview },
    });
    await db.waScheduledMessage.update({
      where: { id: sm.id },
      data: { status: "SENT", sentMessageId: message.id },
    });
    logEvent("queue.wa_scheduled.sent", { scheduledMessageId: sm.id, type: sm.type });
    return { status: "SENT" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.waScheduledMessage.update({
      where: { id: sm.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 500) },
    });
    logError("[wa-cloud.scheduled.send] failed", err, { scheduledMessageId: sm.id });
    return { status: "FAILED" };
  }
}
