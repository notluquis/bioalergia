import { db } from "@finanzas/db";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logEvent, logWarn } from "../../lib/logger";
import { normalizeToE164 } from "./phone";

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
        errors?: Array<{ code: number; title: string; message?: string }>;
      };
    }>;
  }>;
};

type MetaMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: unknown;
  interactive?: unknown;
  button?: { text: string; payload: string };
  reaction?: { message_id: string; emoji: string };
  context?: { from?: string; id?: string };
  errors?: Array<{ code: number; title: string }>;
};

type MetaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  conversation?: { id: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; pricing_model?: string; category?: string };
  errors?: Array<{ code: number; title: string; message?: string; error_data?: { details?: string } }>;
};

const TYPE_MAP: Record<string, string> = {
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
  document: "DOCUMENT",
  sticker: "STICKER",
  location: "LOCATION",
  contacts: "CONTACTS",
  interactive: "INTERACTIVE",
  button: "BUTTON",
  reaction: "REACTION",
  template: "TEMPLATE",
  system: "SYSTEM",
  unsupported: "UNSUPPORTED",
};

export function verifyMetaSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string | undefined): boolean {
  if (!appSecret || !signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function upsertContact(waId: string, profileName?: string) {
  const phoneE164 = normalizeToE164(waId);
  const existing = await db.waContact.findUnique({ where: { phoneE164 } });
  if (existing) {
    if (profileName && profileName !== existing.pushName) {
      await db.waContact.update({
        where: { id: existing.id },
        data: { pushName: profileName },
      });
    }
    return existing.id;
  }
  const created = await db.waContact.create({
    data: { phoneE164, pushName: profileName, name: profileName ?? null },
  });
  return created.id;
}

async function ensureConversation(contactId: number, phoneNumberRowId: number) {
  let conv = await db.waConversation.findUnique({ where: { contactId } });
  if (!conv) {
    conv = await db.waConversation.create({ data: { contactId } });
  }
  // Channel link
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
  return conv.id;
}

function previewFromMessage(m: MetaMessage): string {
  if (m.text?.body) return m.text.body.slice(0, 200);
  if (m.image) return m.image.caption ?? "[imagen]";
  if (m.video) return m.video.caption ?? "[video]";
  if (m.audio) return m.audio.voice ? "[audio nota de voz]" : "[audio]";
  if (m.document) return m.document.filename ?? m.document.caption ?? "[documento]";
  if (m.sticker) return "[sticker]";
  if (m.location) return `[ubicación] ${m.location.name ?? ""}`.trim();
  if (m.contacts) return "[contactos]";
  if (m.interactive) return "[interactivo]";
  if (m.button) return m.button.text;
  if (m.reaction) return `[reacción] ${m.reaction.emoji}`;
  return `[${m.type}]`;
}

export type ProcessResult = { events: number; errors: string[] };

export async function processWebhookPayload(payload: MetaWebhookPayload): Promise<ProcessResult> {
  const out: ProcessResult = { events: 0, errors: [] };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const v = change.value;
      const phoneNumberId = v.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const phoneRow = await db.waPhoneNumber.findUnique({
        where: { phoneNumberId },
        include: { account: true },
      });
      if (!phoneRow) {
        out.errors.push(`PhoneNumber ${phoneNumberId} no registrado`);
        continue;
      }

      // Inbound messages
      if (v.messages?.length) {
        for (const m of v.messages) {
          out.events += 1;
          try {
            const profileName = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
            const contactId = await upsertContact(m.from, profileName);
            const convId = await ensureConversation(contactId, phoneRow.id);

            // Dedupe
            const exists = await db.waMessage.findUnique({
              where: { metaMessageId: m.id },
            });
            if (exists) continue;

            const msgType = (TYPE_MAP[m.type] ?? "UNSUPPORTED") as keyof typeof TYPE_MAP;
            const body =
              m.text?.body ??
              m.button?.text ??
              m.reaction?.emoji ??
              null;
            const mediaCaption =
              m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? null;
            const mediaMime =
              m.image?.mime_type ??
              m.video?.mime_type ??
              m.audio?.mime_type ??
              m.document?.mime_type ??
              m.sticker?.mime_type ??
              null;
            const tsMs = Number.parseInt(m.timestamp, 10) * 1000;
            const ts = Number.isFinite(tsMs) ? new Date(tsMs) : new Date();
            const preview = previewFromMessage(m);

            await db.waMessage.create({
              data: {
                conversationId: convId,
                contactId,
                phoneNumberId: phoneRow.id,
                metaMessageId: m.id,
                direction: "INBOUND",
                type: msgType as never,
                status: "DELIVERED",
                body,
                mediaCaption,
                mediaMimeType: mediaMime,
                contextMetaMessageId: m.context?.id ?? null,
                payload: m as never,
                timestamp: ts,
                deliveredAt: ts,
              },
            });

            await db.waConversation.update({
              where: { id: convId },
              data: {
                lastInboundAt: ts,
                lastMessageAt: ts,
                lastMessagePreview: preview,
                unreadCount: { increment: 1 },
                status: "OPEN",
              },
            });
            await db.waConversationChannel.update({
              where: {
                conversationId_phoneNumberId: {
                  conversationId: convId,
                  phoneNumberId: phoneRow.id,
                },
              },
              data: { lastMessageAt: ts },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            out.errors.push(`msg ${m.id}: ${msg}`);
            logWarn("[wa-cloud.webhook] message process failed", { messageId: m.id, error: msg });
          }
        }
      }

      // Status updates (for outbound)
      if (v.statuses?.length) {
        for (const s of v.statuses) {
          out.events += 1;
          try {
            const status = s.status.toUpperCase() as
              | "SENT"
              | "DELIVERED"
              | "READ"
              | "FAILED";
            const tsMs = Number.parseInt(s.timestamp, 10) * 1000;
            const ts = Number.isFinite(tsMs) ? new Date(tsMs) : new Date();
            const data: Record<string, unknown> = { status };
            if (status === "DELIVERED") data.deliveredAt = ts;
            if (status === "READ") data.readAt = ts;
            if (status === "FAILED" && s.errors?.length) {
              data.errorCode = String(s.errors[0]!.code);
              data.errorTitle = s.errors[0]!.title;
              data.errorDetails = s.errors[0]!.error_data?.details ?? s.errors[0]!.message ?? null;
            }
            await db.waMessage.updateMany({
              where: { metaMessageId: s.id },
              data,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            out.errors.push(`status ${s.id}: ${msg}`);
          }
        }
      }
    }
  }
  logEvent("[wa-cloud.webhook] processed", out);
  return out;
}
