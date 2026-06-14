// Send a scheduled WhatsApp message at its due time. Driven by the
// `send_wa_scheduled` graphile-worker task (one-shot; enqueued by the
// scheduleMessage handler with runAt = scheduledAt). Mirrors the inline send +
// persistence of the sendMessage/sendTemplate oRPC handlers, but lives in the
// service layer (golden 2026: no business logic in tasks/handlers).

import { db } from "@finanzas/db";
import type {
  listAllScheduledInputSchema,
  listScheduledResponseSchema,
  scheduledMessageSchema,
  scheduleMessageInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
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
    // WaMessage.payload is non-nullable (Json @default("{}")). TEXT keeps the
    // empty object (mirrors the inline sendMessage handler, which omits it and
    // lets the default apply); TEMPLATE overwrites with the components object.
    // Writing null here would violate NOT NULL and fail every scheduled TEXT.
    let payload: Record<string, unknown> = {};

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

// ── CRUD de mensajes programados (golden 2026: lógica fuera del handler) ──────
// El handler scheduleMessage encola send_wa_scheduled con runAt = scheduledAt;
// ese enqueue se queda en el handler (trigger de cola). Estos servicios validan
// + persisten y devuelven la fila para que el handler decida el enqueue.

type ScheduleMessagePayload = z.infer<typeof scheduleMessageInputSchema>;
type ListAllScheduledPayload = z.infer<typeof listAllScheduledInputSchema>;

type ScheduledMessageRow = Awaited<ReturnType<typeof db.waScheduledMessage.create>>;
type ScheduledMessageDto = z.infer<typeof scheduledMessageSchema>;

function toScheduledDto(row: ScheduledMessageRow): ScheduledMessageDto {
  return {
    ...row,
    templateVars: (row.templateVars as unknown as string[]) ?? [],
  } as unknown as ScheduledMessageDto;
}

// Crea el mensaje programado. Valida que la conversación exista y que la hora
// programada esté al menos 30s en el futuro. Devuelve la fila normalizada.
export async function createScheduledMessage(
  payload: ScheduleMessagePayload,
  createdByUserId: number
): Promise<ScheduledMessageDto> {
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    select: { id: true, contactId: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  if (payload.scheduledAt.getTime() <= Date.now() + 30_000) {
    throw new DomainError("BAD_REQUEST", "Programa al menos 30 segundos en el futuro");
  }
  const created = await db.waScheduledMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      scheduledAt: payload.scheduledAt,
      type: payload.type,
      body: payload.body ?? null,
      templateName: payload.templateName ?? null,
      templateLanguage: payload.templateLanguage ?? null,
      templateVars: (payload.templateVars ?? []) as never,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      createdByUserId,
    },
  });
  return toScheduledDto(created);
}

export async function listScheduledForConversation(
  conversationId: number
): Promise<z.infer<typeof listScheduledResponseSchema>> {
  const rows = await db.waScheduledMessage.findMany({
    where: { conversationId },
    orderBy: { scheduledAt: "asc" },
  });
  return { scheduled: rows.map((r) => toScheduledDto(r)) };
}

export async function cancelScheduledMessage(id: number): Promise<void> {
  await db.waScheduledMessage.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

export async function listAllScheduled(payload: ListAllScheduledPayload) {
  const where = payload.status ? { status: payload.status } : {};
  const rows = await db.waScheduledMessage.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: payload.limit,
    include: { conversation: { include: { contact: true } } },
  });
  return {
    scheduled: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      templateVars: (r.templateVars as unknown as string[]) ?? [],
      contactName: r.conversation.contact.name ?? r.conversation.contact.pushName ?? null,
      phoneE164: r.conversation.contact.phoneE164,
    })),
  };
}
