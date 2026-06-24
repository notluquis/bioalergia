// Lógica de snippets / quick-replies de WhatsApp Cloud, fuera de los handlers
// oRPC (golden 2026: handlers finos). Los servicios validan, hacen queries y
// lanzan DomainError (mapeado a HTTP por orpc/error.ts::toORPCError). Las
// llamadas al Graph client de Meta (sendTextMessage/sendMediaMessage + el
// fetch directo para interactive cta_url / button) se conservan intactas.

import { db } from "@finanzas/db";
import type {
  listSnippetsInputSchema,
  listSnippetsResponseSchema,
  sendMessageResponseSchema,
  sendSnippetInputSchema,
  snippetSchema,
  upsertSnippetInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import { ORPCError } from "@orpc/server";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import { sendMediaMessage, sendTextMessage } from "../modules/wa-cloud/graph-client.ts";

const WINDOW_HOURS = 24;

type ListSnippetsPayload = z.infer<typeof listSnippetsInputSchema>;
type ListSnippetsResponse = z.infer<typeof listSnippetsResponseSchema>;
type UpsertSnippetPayload = z.infer<typeof upsertSnippetInputSchema>;
type Snippet = z.infer<typeof snippetSchema>;
type SendSnippetPayload = z.infer<typeof sendSnippetInputSchema>;
type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

export async function listSnippets(payload: ListSnippetsPayload): Promise<ListSnippetsResponse> {
  const where: Record<string, unknown> = { archived: false };
  if (payload.kind) where.kind = payload.kind;
  if (payload.category) where.category = payload.category;
  if (payload.q && payload.q.length >= 1) {
    where.OR = [
      { name: { contains: payload.q, mode: "insensitive" as const } },
      { description: { contains: payload.q, mode: "insensitive" as const } },
      { shortcut: { contains: payload.q, mode: "insensitive" as const } },
      { bodyText: { contains: payload.q, mode: "insensitive" as const } },
    ];
  }
  const rows = await db.waSnippet.findMany({
    where,
    orderBy: [{ hitCount: "desc" }, { name: "asc" }],
    take: 200,
  });
  return {
    snippets: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      replyButtons:
        (r.replyButtons as unknown as Array<{ id: string; title: string }> | null) ?? null,
      variables: (r.variables as unknown as string[]) ?? [],
    })),
  } as unknown as ListSnippetsResponse;
}

export async function upsertSnippet(
  payload: UpsertSnippetPayload,
  createdByUserId: number
): Promise<Snippet> {
  const data = {
    accountId: payload.accountId ?? null,
    kind: payload.kind,
    category: payload.category ?? null,
    name: payload.name,
    description: payload.description ?? null,
    shortcut: payload.shortcut ?? null,
    bodyText: payload.bodyText ?? null,
    ctaUrl: payload.ctaUrl ?? null,
    ctaButtonText: payload.ctaButtonText ?? null,
    ctaHeader: payload.ctaHeader ?? null,
    ctaFooter: payload.ctaFooter ?? null,
    replyButtons: (payload.replyButtons as never) ?? undefined,
    replyHeader: payload.replyHeader ?? null,
    replyFooter: payload.replyFooter ?? null,
    mediaHandle: payload.mediaHandle ?? null,
    // Meta media handles valid 30 days
    mediaHandleExpiresAt: payload.mediaHandle
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null,
    mediaUrl: payload.mediaUrl ?? null,
    mediaMimeType: payload.mediaMimeType ?? null,
    mediaFilename: payload.mediaFilename ?? null,
    mediaSize: payload.mediaSize ?? null,
    variables: payload.variables ?? [],
  };
  const row = payload.id
    ? await db.waSnippet.update({ where: { id: payload.id }, data })
    : await db.waSnippet.create({
        data: { ...data, createdByUserId },
      });
  return {
    ...row,
    replyButtons:
      (row.replyButtons as unknown as Array<{ id: string; title: string }> | null) ?? null,
    variables: (row.variables as unknown as string[]) ?? [],
  } as unknown as Snippet;
}

export async function archiveSnippet(id: number): Promise<void> {
  await db.waSnippet.update({ where: { id }, data: { archived: true } });
}

export async function sendSnippet(
  payload: SendSnippetPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const snip = await db.waSnippet.findUnique({ where: { id: payload.snippetId } });
  if (!snip || snip.archived) throw new DomainError("NOT_FOUND", "Snippet no existe");
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  if (conv.contact.blockedAt) {
    throw new DomainError("BAD_REQUEST", "Contacto bloqueado");
  }
  const lastInbound = conv.lastInboundAt;
  const windowOpen = lastInbound
    ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
    : false;
  if (!windowOpen) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Snippets requieren ventana abierta (usa template)."
    );
  }

  // Variable substitution
  const subs = payload.variableValues ?? [];
  const resolve = (text: string | null) => {
    if (!text) return text;
    return text.replace(/\{\{(\d+)\}\}/g, (_, idx) => subs[Number(idx) - 1] ?? `{{${idx}}}`);
  };

  const toE164 = conv.contact.phoneE164;
  const now = new Date();
  let metaId: string | null = null;
  let preview = "";
  let messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "STICKER" | "INTERACTIVE" =
    "TEXT";
  let payloadJson: Record<string, unknown> = { snippet_id: snip.id };

  if (snip.kind === "TEXT") {
    const body = resolve(snip.bodyText) ?? "";
    if (!body.trim()) throw new DomainError("BAD_REQUEST", "Snippet sin body");
    const r = await sendTextMessage({ phoneNumberId: payload.phoneNumberId, toE164, body });
    metaId = r.messages?.[0]?.id ?? null;
    preview = body.slice(0, 200);
    messageType = "TEXT";
    payloadJson = { ...payloadJson, body };
  } else if (snip.kind === "CTA_URL") {
    const body = resolve(snip.bodyText) ?? "";
    if (!snip.ctaUrl || !snip.ctaButtonText)
      throw new DomainError("BAD_REQUEST", "Snippet CTA sin url/buttonText");
    // Cloud API: interactive type=cta_url
    const phone = await db.waPhoneNumber.findUnique({
      where: { id: payload.phoneNumberId },
      include: { account: true },
    });
    const ctaToken = decryptSecret(phone?.account.systemUserToken);
    if (!phone || !ctaToken) throw new DomainError("BAD_REQUEST", "Account sin token");
    const interactive: Record<string, unknown> = {
      type: "cta_url",
      body: { text: body },
      action: {
        name: "cta_url",
        parameters: { display_text: snip.ctaButtonText, url: snip.ctaUrl },
      },
    };
    if (snip.ctaHeader) interactive.header = { type: "text", text: resolve(snip.ctaHeader) };
    if (snip.ctaFooter) interactive.footer = { text: resolve(snip.ctaFooter) };
    const url = `https://graph.facebook.com/${phone.account.graphApiVersion}/${phone.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toE164.replace(/^\+/, ""),
        type: "interactive",
        interactive,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ORPCError("BAD_GATEWAY", {
        message: `Meta CTA ${res.status}: ${text.slice(0, 200)}`,
      });
    }
    const json = JSON.parse(text) as { messages: Array<{ id: string }> };
    metaId = json.messages?.[0]?.id ?? null;
    preview = `[CTA] ${snip.ctaButtonText}`;
    messageType = "INTERACTIVE";
    payloadJson = {
      ...payloadJson,
      interactive_type: "cta_url",
      body,
      button: snip.ctaButtonText,
      url: snip.ctaUrl,
    };
  } else if (snip.kind === "REPLY_BUTTONS") {
    const buttons = (snip.replyButtons as unknown as Array<{ id: string; title: string }>) ?? [];
    if (buttons.length === 0) throw new DomainError("BAD_REQUEST", "Snippet sin botones");
    const body = resolve(snip.bodyText) ?? "";
    const phone = await db.waPhoneNumber.findUnique({
      where: { id: payload.phoneNumberId },
      include: { account: true },
    });
    const replyToken = decryptSecret(phone?.account.systemUserToken);
    if (!phone || !replyToken) throw new DomainError("BAD_REQUEST", "Account sin token");
    const interactive: Record<string, unknown> = {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    };
    if (snip.replyHeader) interactive.header = { type: "text", text: resolve(snip.replyHeader) };
    if (snip.replyFooter) interactive.footer = { text: resolve(snip.replyFooter) };
    const url = `https://graph.facebook.com/${phone.account.graphApiVersion}/${phone.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toE164.replace(/^\+/, ""),
        type: "interactive",
        interactive,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ORPCError("BAD_GATEWAY", {
        message: `Meta buttons ${res.status}: ${text.slice(0, 200)}`,
      });
    }
    const json = JSON.parse(text) as { messages: Array<{ id: string }> };
    metaId = json.messages?.[0]?.id ?? null;
    preview = `[botones] ${buttons.map((b) => b.title).join(" / ")}`;
    messageType = "INTERACTIVE";
    payloadJson = { ...payloadJson, interactive_type: "button", body, buttons };
  } else if (
    snip.kind === "MEDIA_DOCUMENT" ||
    snip.kind === "MEDIA_IMAGE" ||
    snip.kind === "MEDIA_VIDEO" ||
    snip.kind === "MEDIA_AUDIO" ||
    snip.kind === "MEDIA_STICKER"
  ) {
    const typeMap = {
      MEDIA_DOCUMENT: "document",
      MEDIA_IMAGE: "image",
      MEDIA_VIDEO: "video",
      MEDIA_AUDIO: "audio",
      MEDIA_STICKER: "sticker",
    } as const;
    if (!snip.mediaHandle && !snip.mediaUrl)
      throw new DomainError("BAD_REQUEST", "Snippet media sin handle/url");
    if (
      snip.mediaHandle &&
      snip.mediaHandleExpiresAt &&
      snip.mediaHandleExpiresAt.getTime() < Date.now()
    ) {
      throw new DomainError(
        "BAD_REQUEST",
        "Media handle expirado (>30 días). Re-sube el archivo en Catálogo."
      );
    }
    const r = await sendMediaMessage({
      phoneNumberId: payload.phoneNumberId,
      toE164,
      type: typeMap[snip.kind as keyof typeof typeMap],
      mediaId: snip.mediaHandle ?? undefined,
      link: snip.mediaUrl ?? undefined,
      caption: resolve(snip.bodyText) ?? undefined,
      filename: snip.mediaFilename ?? undefined,
    });
    metaId = r.messages?.[0]?.id ?? null;
    preview = `[${snip.kind.toLowerCase()}] ${snip.name}`;
    messageType = typeMap[snip.kind as keyof typeof typeMap].toUpperCase() as
      | "DOCUMENT"
      | "IMAGE"
      | "VIDEO"
      | "AUDIO"
      | "STICKER";
    payloadJson = { ...payloadJson, kind: snip.kind, mediaId: snip.mediaHandle };
  } else {
    throw new DomainError("BAD_REQUEST", `Tipo ${snip.kind} no implementado`);
  }

  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: messageType,
      status: "SENT",
      body: snip.bodyText,
      sentByUserId,
      payload: payloadJson as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview },
  });
  await db.waSnippet.update({
    where: { id: snip.id },
    data: { hitCount: { increment: 1 }, lastUsedAt: now },
  });
  return { message } as unknown as SendMessageResponse;
}
