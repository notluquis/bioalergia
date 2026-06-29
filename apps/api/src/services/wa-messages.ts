// Lógica de envío + persistencia de mensajes de WhatsApp Cloud, fuera de los
// handlers oRPC (golden 2026: handlers finos). Cada `send*` llama al Graph
// client de Meta (intacto), persiste el WaMessage OUTBOUND y actualiza la
// conversación (lastMessageAt/lastMessagePreview). Las guardas de ventana 24h y
// contacto bloqueado viven aquí; lanzan DomainError (mapeado a HTTP por
// orpc/error.ts::toORPCError).

import { db } from "@finanzas/db";
import type {
  editTextInputSchema,
  forwardMessageInputSchema,
  listConversationMediaInputSchema,
  listConversationMediaResponseSchema,
  searchMessagesInputSchema,
  searchMessagesResponseSchema,
  sendAddressInputSchema,
  sendContactsInputSchema,
  sendFlowInputSchema,
  sendInteractiveListInputSchema,
  sendLocationInputSchema,
  sendMediaInputSchema,
  sendMessageResponseSchema,
  sendReactionInputSchema,
  sendTemplateInputSchema,
  sendTextInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import {
  downloadMediaBytes,
  editTextMessage,
  sendAddressMessage,
  sendContactsMessage,
  sendFlowMessage,
  sendInteractiveListMessage,
  sendLocationMessage,
  sendMediaMessage,
  sendReaction as sendReactionGraph,
  sendTemplateMessage,
  sendTextMessage,
  uploadMedia,
} from "../modules/wa-cloud/graph-client.ts";

export async function getWaMessagesForExport(conversationId: number) {
  return db.waMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      timestamp: true,
      direction: true,
      type: true,
      body: true,
      status: true,
      metaMessageId: true,
    },
  });
}

export async function getWaMessageForMedia(messageId: number) {
  return db.waMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      type: true,
      mediaMimeType: true,
      mediaR2Key: true,
      payload: true,
      phoneNumber: { select: { accountId: true } },
    },
  });
}

const WINDOW_HOURS = 24;

type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
type SendTextPayload = z.infer<typeof sendTextInputSchema>;
// Internal extension: named body params (Meta named-parameter templates).
// Not in the shared contract — only abono sends use it; the oRPC handler keeps
// passing positional bodyParams (a valid subtype, the field is optional).
type SendTemplatePayload = z.infer<typeof sendTemplateInputSchema> & {
  bodyNamedParams?: Array<{ name: string; text: string }>;
  // Dynamic suffix for a single URL button (template URL = static base + {{1}}).
  urlButtonSuffix?: string;
};
type SendReactionPayload = z.infer<typeof sendReactionInputSchema>;
type SendMediaPayload = z.infer<typeof sendMediaInputSchema> & {
  recordAdHocSticker?: boolean;
};
type SendFlowPayload = z.infer<typeof sendFlowInputSchema>;
type SendInteractiveListPayload = z.infer<typeof sendInteractiveListInputSchema>;
type SendAddressPayload = z.infer<typeof sendAddressInputSchema>;
type SendLocationPayload = z.infer<typeof sendLocationInputSchema>;
type SendContactsPayload = z.infer<typeof sendContactsInputSchema>;
type EditTextPayload = z.infer<typeof editTextInputSchema>;
type ForwardMessagePayload = z.infer<typeof forwardMessageInputSchema>;
type SearchMessagesPayload = z.infer<typeof searchMessagesInputSchema>;
type SearchMessagesResponse = z.infer<typeof searchMessagesResponseSchema>;
type ListConversationMediaPayload = z.infer<typeof listConversationMediaInputSchema>;
type ListConversationMediaResponse = z.infer<typeof listConversationMediaResponseSchema>;

type ConversationWithContact = NonNullable<
  Awaited<
    ReturnType<
      typeof db.waConversation.findUnique<{ where: { id: number }; include: { contact: true } }>
    >
  >
>;

// Carga la conversación + contacto o lanza NOT_FOUND con el mensaje canónico.
async function loadConversation(conversationId: number): Promise<ConversationWithContact> {
  const conv = await db.waConversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  return conv;
}

function windowOpen(lastInbound: Date | null): boolean {
  return lastInbound ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000 : false;
}

export async function sendText(
  payload: SendTextPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (conv.contact.blockedAt) {
    throw new DomainError(
      "BAD_REQUEST",
      "Contacto bloqueado. Desbloquéalo desde el menú de la conversación primero."
    );
  }
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Usa una plantilla aprobada (sendTemplate) para reactivar la conversación."
    );
  }

  const apiResp = await sendTextMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    body: payload.body,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "TEXT",
      status: "SENT",
      body: payload.body,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: payload.body.slice(0, 200) },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendTemplate(
  payload: SendTemplatePayload,
  sentByUserId: number | null
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (conv.contact.blockedAt) {
    throw new DomainError(
      "BAD_REQUEST",
      "Contacto bloqueado. Desbloquéalo desde el menú de la conversación primero."
    );
  }
  const components: Array<Record<string, unknown>> = [];
  if (payload.headerParams?.length) {
    components.push({
      type: "header",
      parameters: payload.headerParams.map((t) => ({ type: "text", text: t })),
    });
  }
  if (payload.bodyNamedParams?.length) {
    components.push({
      type: "body",
      parameters: payload.bodyNamedParams.map((p) => ({
        type: "text",
        parameter_name: p.name,
        text: p.text,
      })),
    });
  } else if (payload.bodyParams?.length) {
    components.push({
      type: "body",
      parameters: payload.bodyParams.map((t) => ({ type: "text", text: t })),
    });
  }
  // Single dynamic URL button (template URL = static base + {{1}}).
  if (payload.urlButtonSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: 0,
      parameters: [{ type: "text", text: payload.urlButtonSuffix }],
    });
  }
  // Carousel template (Meta 2026): build cards array with per-card image header
  // + body params + button payloads.
  if (payload.cards && payload.cards.length > 0) {
    const cards = payload.cards.map((card) => {
      const cardComponents: Array<Record<string, unknown>> = [];
      if (card.imageMediaId) {
        cardComponents.push({
          type: "header",
          parameters: [{ type: "image", image: { id: card.imageMediaId } }],
        });
      }
      if (card.bodyParams?.length) {
        cardComponents.push({
          type: "body",
          parameters: card.bodyParams.map((t) => ({ type: "text", text: t })),
        });
      }
      (card.quickReplyPayloads ?? []).forEach((payloadStr, idx) => {
        cardComponents.push({
          type: "button",
          sub_type: "quick_reply",
          index: idx,
          parameters: [{ type: "payload", payload: payloadStr }],
        });
      });
      if (card.urlButtonSuffix) {
        cardComponents.push({
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [{ type: "text", text: card.urlButtonSuffix }],
        });
      }
      return { card_index: card.cardIndex, components: cardComponents };
    });
    components.push({ type: "carousel", cards });
  }
  // LIMITED_TIME_OFFER countdown (Meta 2026).
  if (payload.ltoExpirationMs) {
    components.push({
      type: "limited_time_offer",
      parameters: [
        {
          type: "limited_time_offer",
          limited_time_offer: { expiration_time_ms: payload.ltoExpirationMs },
        },
      ],
    });
  }
  // COPY_CODE button (Meta 2026): one-tap copy to clipboard.
  if (payload.copyCodeButton) {
    components.push({
      type: "button",
      sub_type: "copy_code",
      index: payload.copyCodeButton.index,
      parameters: [{ type: "coupon_code", coupon_code: payload.copyCodeButton.value }],
    });
  }
  const apiResp = await sendTemplateMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    templateName: payload.templateName,
    language: payload.language,
    components: components as never,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const preview = `[plantilla] ${payload.templateName}`;
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "TEMPLATE",
      status: "SENT",
      body: preview,
      templateName: payload.templateName,
      templateLanguage: payload.language,
      sentByUserId,
      payload: { components } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendReaction(
  payload: SendReactionPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  const apiResp = await sendReactionGraph(
    payload.phoneNumberId,
    conv.contact.phoneE164,
    payload.metaMessageId,
    payload.emoji
  );
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "REACTION",
      status: "SENT",
      body: payload.emoji || null,
      contextMetaMessageId: payload.metaMessageId,
      sentByUserId,
      timestamp: now,
    },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendMedia(
  payload: SendMediaPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!payload.mediaId && !payload.link) {
    throw new DomainError("BAD_REQUEST", "Falta mediaId o link");
  }
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Solo plantillas pueden reactivar la conversación."
    );
  }
  const apiResp = await sendMediaMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    type: payload.type,
    mediaId: payload.mediaId,
    link: payload.link,
    caption: payload.caption,
    filename: payload.filename,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const typeMap: Record<string, "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "STICKER"> = {
    image: "IMAGE",
    document: "DOCUMENT",
    audio: "AUDIO",
    video: "VIDEO",
    sticker: "STICKER",
  };
  const preview = payload.caption ?? (payload.filename ? payload.filename : `[${payload.type}]`);
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: typeMap[payload.type],
      status: "SENT",
      body: payload.caption ?? null,
      mediaCaption: payload.caption ?? null,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      sentByUserId,
      payload: {
        [payload.type]: {
          id: payload.mediaId,
          link: payload.link,
          caption: payload.caption,
          filename: payload.filename,
        },
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview.slice(0, 200) },
  });
  // Auto-poblar la bandeja "Recientes" de stickers cuando se envía un .webp
  // ad-hoc (no desde el picker). Best-effort: un fallo NO debe romper el envío.
  // Import dinámico para evitar el ciclo wa-stickers → wa-messages.
  const stickerMediaId =
    payload.type === "sticker" && payload.recordAdHocSticker !== false
      ? payload.mediaId
      : undefined;
  if (stickerMediaId) {
    void (async () => {
      try {
        const phone = await db.waPhoneNumber.findUnique({
          where: { id: payload.phoneNumberId },
          select: { accountId: true },
        });
        if (!phone) return;
        const { recordAdHocStickerSent } = await import("./wa-stickers.ts");
        await recordAdHocStickerSent({
          accountId: phone.accountId,
          mediaId: stickerMediaId,
          addedByUserId: sentByUserId,
        });
      } catch {
        // ya logueado dentro de recordAdHocStickerSent; tragamos cualquier
        // fallo del lookup para no afectar el envío.
      }
    })();
  }
  return { message } as unknown as SendMessageResponse;
}

export async function sendFlow(
  payload: SendFlowPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Solo plantillas pueden reactivar la conversación; los flows requieren ventana abierta."
    );
  }
  const apiResp = await sendFlowMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    flowId: payload.flowId,
    flowCta: payload.flowCta,
    bodyText: payload.bodyText,
    headerText: payload.headerText,
    footerText: payload.footerText,
    flowToken: payload.flowToken,
    initialScreen: payload.initialScreen,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const preview = `[flow] ${payload.flowCta}`;
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText,
      sentByUserId,
      payload: {
        interactive_type: "flow",
        flow_id: payload.flowId,
        flow_cta: payload.flowCta,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendInteractiveList(
  payload: SendInteractiveListPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Las listas interactivas requieren ventana abierta."
    );
  }
  const apiResp = await sendInteractiveListMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    bodyText: payload.bodyText,
    buttonText: payload.buttonText,
    sections: payload.sections,
    headerText: payload.headerText,
    footerText: payload.footerText,
    contextMessageId: payload.contextMetaMessageId,
    bizOpaqueCallbackData: payload.bizOpaqueCallbackData,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        interactive_type: "list",
        button: payload.buttonText,
        sections: payload.sections,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: `[lista] ${payload.buttonText}` },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendAddress(
  payload: SendAddressPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. El address message requiere ventana abierta."
    );
  }
  const apiResp = await sendAddressMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    bodyText: payload.bodyText,
    country: payload.country,
    saveAddressLabel: payload.saveAddressLabel,
    contextMessageId: payload.contextMetaMessageId,
    bizOpaqueCallbackData: payload.bizOpaqueCallbackData,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        interactive_type: "address_message",
        country: payload.country,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: "[solicitar dirección]" },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendLocation(
  payload: SendLocationPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Usa una plantilla aprobada para reactivar la conversación."
    );
  }
  const apiResp = await sendLocationMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    latitude: payload.latitude,
    longitude: payload.longitude,
    name: payload.name,
    address: payload.address,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const preview = `[ubicación] ${payload.name ?? ""}`.trim();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "LOCATION",
      status: "SENT",
      body: payload.name ?? null,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        location: {
          latitude: payload.latitude,
          longitude: payload.longitude,
          name: payload.name,
          address: payload.address,
        },
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendContacts(
  payload: SendContactsPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await loadConversation(payload.conversationId);
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. Usa una plantilla aprobada para reactivar la conversación."
    );
  }
  const apiResp = await sendContactsMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    contacts: payload.contacts,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const names = payload.contacts.map((c) => c.name.formatted_name).join(", ");
  const preview = `[contacto] ${names}`.slice(0, 200);
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "CONTACTS",
      status: "SENT",
      body: names,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: { contacts: payload.contacts } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview },
  });
  return { message } as unknown as SendMessageResponse;
}

// ── Forward ─────────────────────────────────────────────────────────────────

const SEND_TYPE_BY_DB: Record<string, "image" | "video" | "audio" | "document" | "sticker"> = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  STICKER: "sticker",
};

// Resolve the Meta media id of a stored message: inbound keeps it in `mediaUrl`,
// outbound persists it under `payload[type].id`.
function extractMediaId(msg: {
  mediaUrl: string | null;
  type: string;
  payload: unknown;
}): string | null {
  if (msg.mediaUrl) return msg.mediaUrl;
  if (msg.payload && typeof msg.payload === "object") {
    const sub = (msg.payload as Record<string, unknown>)[msg.type.toLowerCase()];
    if (sub && typeof sub === "object") {
      const id = (sub as { id?: unknown }).id;
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

function extractLocation(
  payload: unknown
): { latitude: number; longitude: number; name?: string; address?: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const loc = (root.location && typeof root.location === "object" ? root.location : root) as Record<
    string,
    unknown
  >;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    latitude: lat,
    longitude: lng,
    name: typeof loc.name === "string" ? loc.name : undefined,
    address: typeof loc.address === "string" ? loc.address : undefined,
  };
}

function extractContacts(payload: unknown): SendContactsPayload["contacts"] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const arr = Array.isArray(root.contacts) ? root.contacts : [];
  const out: SendContactsPayload["contacts"] = [];
  for (const c of arr) {
    if (c && typeof c === "object" && "name" in c) {
      const name = (c as { name?: unknown }).name;
      if (
        name &&
        typeof name === "object" &&
        typeof (name as { formatted_name?: unknown }).formatted_name === "string"
      ) {
        out.push(c as SendContactsPayload["contacts"][number]);
      }
    }
  }
  return out;
}

// Server-side forward: the Cloud API has no native forward operation, so we
// re-send the source message's content into the target conversation through the
// existing send* services (which enforce the TARGET's 24h window + blocked
// contact + persistence). Media is re-downloaded from the source account and
// re-uploaded to the target line — Meta media ids expire ~30d and aren't
// portable across WABAs, so re-upload is the robust path.
export async function forwardMessage(
  payload: ForwardMessagePayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const src = await db.waMessage.findUnique({ where: { id: payload.sourceMessageId } });
  if (!src) throw new DomainError("NOT_FOUND", "Mensaje de origen no encontrado");
  const base = {
    conversationId: payload.targetConversationId,
    phoneNumberId: payload.targetPhoneNumberId,
  };

  if (src.type === "TEXT") {
    if (!src.body?.trim()) {
      throw new DomainError("BAD_REQUEST", "El mensaje no tiene texto para reenviar");
    }
    return sendText({ ...base, body: src.body }, sentByUserId);
  }

  const sendType = SEND_TYPE_BY_DB[src.type];
  if (sendType) {
    const mediaId = extractMediaId(src);
    if (!mediaId) {
      throw new DomainError("BAD_REQUEST", "El media no tiene un identificador reutilizable");
    }
    const srcPhone = await db.waPhoneNumber.findUnique({
      where: { id: src.phoneNumberId },
      select: { accountId: true },
    });
    if (!srcPhone) throw new DomainError("NOT_FOUND", "Número de origen no encontrado");
    // Re-download bytes from the source account, re-upload to the target line.
    const { bytes, mimeType } = await downloadMediaBytes(mediaId, srcPhone.accountId);
    const ext = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
    const filename = src.mediaCaption ?? `reenvio-${src.id}.${ext}`;
    const uploaded = await uploadMedia(
      payload.targetPhoneNumberId,
      new Blob([bytes] as BlobPart[], { type: mimeType }),
      mimeType,
      filename
    );
    // Caption is only valid on image/video/document (Meta rejects it on audio/sticker).
    const caption = ["image", "video", "document"].includes(sendType)
      ? (src.mediaCaption ?? undefined)
      : undefined;
    return sendMedia(
      {
        ...base,
        type: sendType,
        mediaId: uploaded.id,
        caption,
        filename: sendType === "document" ? filename : undefined,
      },
      sentByUserId
    );
  }

  if (src.type === "LOCATION") {
    const loc = extractLocation(src.payload);
    if (!loc) throw new DomainError("BAD_REQUEST", "No se pudo leer la ubicación para reenviar");
    return sendLocation({ ...base, ...loc }, sentByUserId);
  }

  if (src.type === "CONTACTS") {
    const contacts = extractContacts(src.payload);
    if (contacts.length === 0) {
      throw new DomainError("BAD_REQUEST", "No se pudieron leer los contactos para reenviar");
    }
    return sendContacts({ ...base, contacts }, sentByUserId);
  }

  throw new DomainError("BAD_REQUEST", "Este tipo de mensaje no se puede reenviar");
}

export async function editText(payload: EditTextPayload): Promise<SendMessageResponse> {
  const orig = await db.waMessage.findUnique({
    where: { id: payload.messageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!orig) throw new DomainError("NOT_FOUND", "Mensaje no encontrado");
  if (orig.direction !== "OUTBOUND" || orig.type !== "TEXT") {
    throw new DomainError("BAD_REQUEST", "Solo mensajes de texto enviados son editables");
  }
  if (!orig.metaMessageId) {
    throw new DomainError("BAD_REQUEST", "Mensaje sin metaMessageId — no editable");
  }
  // Cloud API window for editing: 15 minutes from send.
  const ageMs = Date.now() - orig.timestamp.getTime();
  if (ageMs > 15 * 60 * 1000) {
    throw new DomainError("BAD_REQUEST", "Ventana de edición (15 min) expirada");
  }
  await editTextMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: orig.conversation.contact.phoneE164,
    metaMessageId: orig.metaMessageId,
    body: payload.body,
  });
  const updated = await db.waMessage.update({
    where: { id: orig.id },
    data: { body: payload.body },
  });
  return { message: updated } as unknown as SendMessageResponse;
}

export async function searchMessages(
  payload: SearchMessagesPayload
): Promise<SearchMessagesResponse> {
  const where: Record<string, unknown> = {
    body: { contains: payload.q, mode: "insensitive" as const },
  };
  if (payload.conversationId) where.conversationId = payload.conversationId;
  const rows = await db.waMessage.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: payload.limit,
    include: { conversation: { include: { contact: true } } },
  });
  return {
    results: rows.map((r: (typeof rows)[number]) => ({
      messageId: r.id,
      conversationId: r.conversationId,
      contactName: r.conversation.contact.name ?? r.conversation.contact.pushName ?? null,
      phoneE164: r.conversation.contact.phoneE164,
      direction: r.direction,
      type: r.type,
      body: r.body,
      timestamp: r.timestamp,
    })),
  } as unknown as SearchMessagesResponse;
}

export async function listConversationMedia(
  payload: ListConversationMediaPayload
): Promise<ListConversationMediaResponse> {
  const rows = await db.waMessage.findMany({
    where: {
      conversationId: payload.conversationId,
      type: { in: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"] },
    },
    orderBy: { timestamp: "desc" },
    take: payload.limit,
    select: { id: true, type: true, body: true, timestamp: true, direction: true },
  });
  return {
    media: rows.map((r: (typeof rows)[number]) => ({
      messageId: r.id,
      type: r.type,
      body: r.body,
      timestamp: r.timestamp,
      out: r.direction === "OUTBOUND",
    })),
  } as unknown as ListConversationMediaResponse;
}
