// Lógica de conversaciones de WhatsApp Cloud, fuera de los handlers oRPC
// (golden 2026: handlers finos). Los servicios validan, hacen las queries y
// lanzan DomainError (mapeado a HTTP por orpc/error.ts::toORPCError). Los
// handlers quedan: authz → service → return.
//
// Las llamadas al Graph client de Meta (markMessageRead) se conservan tal cual,
// movidas dentro del service.

import { db } from "@finanzas/db";
import type {
  conversationDetailResponseSchema,
  listConversationsInputSchema,
  listConversationsResponseSchema,
  markReadInputSchema,
  setMuteInputSchema,
  updateConversationInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { markMessageRead } from "../modules/wa-cloud/graph-client.ts";

const WINDOW_HOURS = 24;

type ListConversationsPayload = z.infer<typeof listConversationsInputSchema>;
type ListConversationsResponse = z.infer<typeof listConversationsResponseSchema>;
type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>;
type UpdateConversationPayload = z.infer<typeof updateConversationInputSchema>;
type MarkReadPayload = z.infer<typeof markReadInputSchema>;
type SetMutePayload = z.infer<typeof setMuteInputSchema>;

export async function listConversations(
  payload: ListConversationsPayload
): Promise<ListConversationsResponse> {
  const where: Record<string, unknown> = {};
  if (payload.status) where.status = payload.status;
  if (payload.assignedToUserId !== undefined) where.assignedToUserId = payload.assignedToUserId;
  if (payload.phoneNumberId) {
    where.channels = { some: { phoneNumberId: payload.phoneNumberId } };
  }
  if (payload.search) {
    where.contact = {
      OR: [
        { phoneE164: { contains: payload.search } },
        { name: { contains: payload.search, mode: "insensitive" as const } },
        { pushName: { contains: payload.search, mode: "insensitive" as const } },
      ],
    };
  }
  const total = await db.waConversation.count({ where });
  const items = await db.waConversation.findMany({
    where,
    include: { contact: true, channels: { select: { phoneNumberId: true } } },
    orderBy: { lastMessageAt: "desc" },
    skip: (payload.page - 1) * payload.pageSize,
    take: payload.pageSize,
  });
  return {
    items: items.map((c: (typeof items)[number]) => ({
      ...c,
      channelPhoneNumberIds: c.channels.map((ch: (typeof c.channels)[number]) => ch.phoneNumberId),
    })),
    total,
    page: payload.page,
    pageSize: payload.pageSize,
  } as unknown as ListConversationsResponse;
}

export async function getConversation(id: number): Promise<ConversationDetailResponse> {
  const conv = await db.waConversation.findUnique({
    where: { id },
    include: {
      contact: true,
      channels: { include: { phoneNumber: { select: { id: true, label: true } } } },
    },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  const messages = await db.waMessage.findMany({
    where: { conversationId: id },
    orderBy: { timestamp: "asc" },
    take: 500,
  });
  const lastInbound = conv.lastInboundAt;
  const windowExpiresAt = lastInbound
    ? new Date(lastInbound.getTime() + WINDOW_HOURS * 60 * 60 * 1000)
    : null;
  const windowOpen = windowExpiresAt ? windowExpiresAt > new Date() : false;
  return {
    conversation: conv,
    contact: conv.contact,
    messages,
    channels: conv.channels.map((c: (typeof conv.channels)[number]) => ({
      phoneNumberId: c.phoneNumberId,
      label: c.phoneNumber.label,
    })),
    windowOpen,
    windowExpiresAt,
  } as unknown as ConversationDetailResponse;
}

export async function updateConversation(payload: UpdateConversationPayload): Promise<void> {
  const data: Record<string, unknown> = {};
  if (payload.status) data.status = payload.status;
  if (payload.assignedToUserId !== undefined) data.assignedToUserId = payload.assignedToUserId;
  if (payload.notas !== undefined) data.notas = payload.notas;
  if (payload.etiquetas !== undefined) data.etiquetas = payload.etiquetas;
  await db.waConversation.update({ where: { id: payload.id }, data });
}

// Avisa a Meta que el último inbound fue leído (ticks azules). Best-effort: un
// fallo aquí no debe impedir limpiar el badge local de no-leídos.
export async function markConversationRead(payload: MarkReadPayload): Promise<void> {
  const latestInbound = await db.waMessage.findFirst({
    where: {
      conversationId: payload.conversationId,
      direction: "INBOUND",
      metaMessageId: { not: null },
    },
    orderBy: { timestamp: "desc" },
    select: { metaMessageId: true, phoneNumberId: true },
  });
  if (latestInbound?.metaMessageId) {
    try {
      await markMessageRead(latestInbound.phoneNumberId, latestInbound.metaMessageId);
    } catch (err) {
      logError("[wa-cloud.markRead] Meta mark-read failed", { err });
    }
  }
  await db.waConversation.update({
    where: { id: payload.conversationId },
    data: { unreadCount: 0 },
  });
}

export async function setConversationMute(payload: SetMutePayload): Promise<void> {
  await db.waConversation.update({
    where: { id: payload.conversationId },
    data: { mutedUntil: payload.mutedUntil ? new Date(payload.mutedUntil) : null },
  });
}

// Indicador "escribiendo…": reusa el read-receipt de Meta con typing=true sobre
// el último inbound. Best-effort (no rompe si Meta falla).
export async function setConversationTyping(conversationId: number): Promise<void> {
  const latest = await db.waMessage.findFirst({
    where: {
      conversationId,
      direction: "INBOUND",
      metaMessageId: { not: null },
    },
    orderBy: { timestamp: "desc" },
    select: { metaMessageId: true, phoneNumberId: true },
  });
  if (latest?.metaMessageId) {
    try {
      await markMessageRead(latest.phoneNumberId, latest.metaMessageId, true);
    } catch (err) {
      logError("[wa-cloud.setTyping] failed", { err });
    }
  }
}
