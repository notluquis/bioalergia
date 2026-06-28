// Lógica de contactos de WhatsApp Cloud, fuera de los handlers oRPC (golden
// 2026: handlers finos). Validan, hacen queries y lanzan DomainError. Las
// llamadas al Graph client de Meta (blockUsers/unblockUsers/listBlockedUsers)
// se conservan tal cual dentro del service.

import { db } from "@finanzas/db";
import type {
  blockContactInputSchema,
  listBlockedResponseSchema,
  updateWaContactInputSchema,
  waPhoneIdInput,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { blockUsers, listBlockedUsers, unblockUsers } from "../modules/wa-cloud/graph-client.ts";

type UpdateContactPayload = z.infer<typeof updateWaContactInputSchema>;
type BlockContactPayload = z.infer<typeof blockContactInputSchema>;
type ListBlockedResponse = z.infer<typeof listBlockedResponseSchema>;
type PhoneIdPayload = z.infer<typeof waPhoneIdInput>;

export async function ensureContactAndConversation(phoneE164: string, name: string, phoneNumberRowId: number) {
  let contact = await db.waContact.findUnique({ where: { phoneE164 } });
  if (!contact) {
    contact = await db.waContact.create({ data: { phoneE164, name } });
  }
  let conv = await db.waConversation.findUnique({ where: { contactId: contact.id } });
  if (!conv) {
    conv = await db.waConversation.create({ data: { contactId: contact.id } });
  }
  const channel = await db.waConversationChannel.findUnique({
    where: {
      conversationId_phoneNumberId: { conversationId: conv.id, phoneNumberId: phoneNumberRowId },
    },
  });
  if (!channel) {
    await db.waConversationChannel.create({
      data: { conversationId: conv.id, phoneNumberId: phoneNumberRowId },
    });
  }
  return { contactId: contact.id, conversationId: conv.id };
}

export async function updateContact(payload: UpdateContactPayload): Promise<void> {
  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.notas !== undefined) data.notas = payload.notas;
  if (payload.etiquetas !== undefined) data.etiquetas = payload.etiquetas;
  if (payload.patientRut !== undefined) data.patientRut = payload.patientRut;
  await db.waContact.update({ where: { id: payload.id }, data });
}

export async function blockContact(
  payload: BlockContactPayload,
  blockedByUserId: number
): Promise<void> {
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  await blockUsers(payload.phoneNumberId, [conv.contact.phoneE164]);
  const now = new Date();
  await db.waContact.update({
    where: { id: conv.contactId },
    data: { blockedAt: now, blockedByUserId },
  });
  await db.waConversation.update({
    where: { id: payload.conversationId },
    data: { status: "ARCHIVED" },
  });
}

export async function unblockContact(payload: BlockContactPayload): Promise<void> {
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  await unblockUsers(payload.phoneNumberId, [conv.contact.phoneE164]);
  await db.waContact.update({
    where: { id: conv.contactId },
    data: { blockedAt: null, blockedByUserId: null },
  });
  await db.waConversation.update({
    where: { id: payload.conversationId },
    data: { status: "OPEN" },
  });
}

export async function listBlocked(payload: PhoneIdPayload): Promise<ListBlockedResponse> {
  const r = await listBlockedUsers(payload.phoneNumberId);
  return {
    blocked: (r.data ?? []).map((b) => ({
      wa_id: b.wa_id ?? null,
      input: b.input ?? null,
    })),
  };
}
