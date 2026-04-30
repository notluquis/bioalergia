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
      const FIELD = change.field;
      const v = change.value;
      const wabaId = entry.id;

      // ── Eventos a nivel WABA (no requieren phone_number_id) ──
      // template_*: actualizar WaTemplate
      if (
        FIELD === "message_template_status_update" ||
        FIELD === "message_template_quality_update" ||
        FIELD === "template_category_update" ||
        FIELD === "template_correct_category_detection" ||
        FIELD === "message_template_components_update"
      ) {
        out.events += 1;
        try {
          const tplPayload = v as unknown as {
            message_template_id?: string;
            message_template_name?: string;
            message_template_language?: string;
            event?: string;
            new_quality_score?: string;
            new_category?: string;
            old_category?: string;
            reason?: string;
          };
          const account = await db.waBusinessAccount.findUnique({ where: { wabaId } });
          if (account && tplPayload.message_template_name && tplPayload.message_template_language) {
            const where = {
              accountId_name_language: {
                accountId: account.id,
                name: tplPayload.message_template_name,
                language: tplPayload.message_template_language,
              },
            };
            const data: Record<string, unknown> = { syncedAt: new Date() };
            if (FIELD === "message_template_status_update" && tplPayload.event) {
              const statusMap: Record<string, string> = {
                APPROVED: "APPROVED",
                REJECTED: "REJECTED",
                FLAGGED: "PAUSED",
                PENDING: "PENDING",
                PAUSED: "PAUSED",
                DISABLED: "DISABLED",
              };
              data.status = statusMap[tplPayload.event] ?? tplPayload.event;
            }
            if (FIELD === "message_template_quality_update" && tplPayload.new_quality_score) {
              data.qualityScore = tplPayload.new_quality_score;
            }
            if (FIELD === "template_category_update" && tplPayload.new_category) {
              data.category = tplPayload.new_category;
            }
            const existing = await db.waTemplate.findUnique({ where });
            if (existing) {
              await db.waTemplate.update({ where, data });
            }
          }
          logEvent("[wa-cloud.webhook] template event", { field: FIELD, ...tplPayload });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          out.errors.push(`${FIELD}: ${msg}`);
        }
        continue;
      }

      // account_*: log + opcionalmente actualizar account (sin fields aún en schema)
      if (
        FIELD === "account_alerts" ||
        FIELD === "account_review_update" ||
        FIELD === "account_settings_update" ||
        FIELD === "account_update" ||
        FIELD === "business_capability_update" ||
        FIELD === "business_status_update" ||
        FIELD === "automatic_events" ||
        FIELD === "security" ||
        FIELD === "partner_solutions" ||
        FIELD === "payment_configuration_update" ||
        FIELD === "user_preferences"
      ) {
        out.events += 1;
        logEvent(`[wa-cloud.webhook] ${FIELD}`, { wabaId, value: v });
        continue;
      }

      const phoneNumberId = v.metadata?.phone_number_id;
      if (!phoneNumberId) {
        // Eventos sin phone_number_id ya manejados arriba; warn si llegan otros
        logWarn("[wa-cloud.webhook] skip sin phone_number_id", { field: FIELD });
        continue;
      }
      const phoneRow = await db.waPhoneNumber.findUnique({
        where: { phoneNumberId },
        include: { account: true },
      });
      if (!phoneRow) {
        out.errors.push(`PhoneNumber ${phoneNumberId} no registrado (field=${FIELD})`);
        continue;
      }

      // ── phone_number_*: actualizar WaPhoneNumber ──
      if (FIELD === "phone_number_quality_update") {
        out.events += 1;
        try {
          const p = v as unknown as { current_limit?: string; event?: string };
          await db.waPhoneNumber.update({
            where: { id: phoneRow.id },
            data: { qualityRating: p.current_limit ?? p.event ?? null },
          });
        } catch (err) {
          out.errors.push(`phone quality: ${err instanceof Error ? err.message : String(err)}`);
        }
        continue;
      }
      if (FIELD === "phone_number_name_update") {
        out.events += 1;
        try {
          const p = v as unknown as { decision?: string; display_phone_number?: string };
          if (p.display_phone_number) {
            await db.waPhoneNumber.update({
              where: { id: phoneRow.id },
              data: { displayPhoneNumber: p.display_phone_number },
            });
          }
          logEvent("[wa-cloud.webhook] phone name update", { decision: p.decision });
        } catch (err) {
          out.errors.push(`phone name: ${err instanceof Error ? err.message : String(err)}`);
        }
        continue;
      }

      // ── calls / flows / messaging_handovers / standby / tracking_events: log ──
      if (
        FIELD === "calls" ||
        FIELD === "flows" ||
        FIELD === "messaging_handovers" ||
        FIELD === "standby" ||
        FIELD === "tracking_events" ||
        FIELD === "group_lifecycle_update" ||
        FIELD === "group_participants_update" ||
        FIELD === "group_settings_update" ||
        FIELD === "group_status_update"
      ) {
        out.events += 1;
        logEvent(`[wa-cloud.webhook] ${FIELD}`, { phoneNumberId, value: v });
        continue;
      }

      // ── message_echoes / smb_message_echoes (Coexistence: outbound from celular) ──
      const echoes = (v as unknown as { message_echoes?: MetaMessage[] }).message_echoes;
      if ((FIELD === "message_echoes" || FIELD === "smb_message_echoes") && echoes?.length) {
        for (const m of echoes) {
          out.events += 1;
          try {
            const echoTo = (m as unknown as { to?: string }).to;
            const targetWaId = echoTo ?? m.from;
            const contactId = await upsertContact(targetWaId, undefined);
            const convId = await ensureConversation(contactId, phoneRow.id);
            const exists = await db.waMessage.findUnique({ where: { metaMessageId: m.id } });
            if (exists) continue;
            const msgType = (TYPE_MAP[m.type] ?? "UNSUPPORTED") as keyof typeof TYPE_MAP;
            const body =
              m.text?.body ?? m.button?.text ?? m.reaction?.emoji ?? null;
            const tsMs = Number.parseInt(m.timestamp, 10) * 1000;
            const ts = Number.isFinite(tsMs) ? new Date(tsMs) : new Date();
            const preview = previewFromMessage(m);
            await db.waMessage.create({
              data: {
                conversationId: convId,
                contactId,
                phoneNumberId: phoneRow.id,
                metaMessageId: m.id,
                direction: "OUTBOUND",
                type: msgType as never,
                status: "SENT",
                body,
                contextMetaMessageId: m.context?.id ?? null,
                payload: m as never,
                timestamp: ts,
              },
            });
            await db.waConversation.update({
              where: { id: convId },
              data: { lastMessageAt: ts, lastMessagePreview: `[eco] ${preview}` },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            out.errors.push(`echo ${m.id}: ${msg}`);
            logWarn("[wa-cloud.webhook] echo failed", { messageId: m.id, error: msg });
          }
        }
        continue;
      }

      // ── smb_app_state_sync (contact add/update/delete sync de WA Business app) ──
      const stateSync = (v as unknown as { state_sync?: Array<Record<string, unknown>> }).state_sync;
      if (FIELD === "smb_app_state_sync" && stateSync?.length) {
        for (const s of stateSync) {
          out.events += 1;
          try {
            const type = s.type as string;
            const action = s.action as string;
            if (type === "contact" && s.contact && typeof s.contact === "object") {
              const c = s.contact as { full_name?: string; first_name?: string; phone_number?: string };
              if (c.phone_number) {
                const phoneE164 = normalizeToE164(c.phone_number);
                const existing = await db.waContact.findUnique({ where: { phoneE164 } });
                if (action === "delete") {
                  // soft-noop: no borramos contactos para preservar historial
                } else {
                  const data = {
                    phoneE164,
                    name: c.full_name ?? c.first_name ?? null,
                    pushName: c.full_name ?? c.first_name ?? null,
                  };
                  if (existing) {
                    await db.waContact.update({ where: { id: existing.id }, data });
                  } else {
                    await db.waContact.create({ data });
                  }
                }
              }
            }
            // Otros types (chat, label, etc): logueo solo
            logEvent("[wa-cloud.webhook] state_sync", { type, action });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            out.errors.push(`state_sync: ${msg}`);
          }
        }
        continue;
      }

      // ── history (one-shot bulk import of past chats during Coexistence onboarding) ──
      const history = (v as unknown as {
        history?: Array<{
          metadata?: { phase?: number; chunk_order?: number; progress?: number };
          threads?: Array<{
            id?: string;
            context?: { wa_id?: string };
            messages?: Array<MetaMessage & { history_context?: { status?: string; from_me?: boolean } }>;
          }>;
        }>;
      }).history;
      if (FIELD === "history" && history?.length) {
        for (const h of history) {
          for (const thread of h.threads ?? []) {
            const waId = thread.context?.wa_id ?? thread.id;
            if (!waId) continue;
            const contactId = await upsertContact(waId, undefined);
            const convId = await ensureConversation(contactId, phoneRow.id);
            for (const m of thread.messages ?? []) {
              out.events += 1;
              try {
                if (m.type === "media_placeholder") continue;
                const exists = await db.waMessage.findUnique({ where: { metaMessageId: m.id } });
                if (exists) continue;
                const msgType = (TYPE_MAP[m.type] ?? "UNSUPPORTED") as keyof typeof TYPE_MAP;
                const fromMe = m.history_context?.from_me === true;
                const body =
                  m.text?.body ?? m.button?.text ?? m.reaction?.emoji ?? null;
                const tsMs = Number.parseInt(m.timestamp, 10) * 1000;
                const ts = Number.isFinite(tsMs) ? new Date(tsMs) : new Date();
                const status = m.history_context?.status?.toUpperCase() ?? "DELIVERED";
                await db.waMessage.create({
                  data: {
                    conversationId: convId,
                    contactId,
                    phoneNumberId: phoneRow.id,
                    metaMessageId: m.id,
                    direction: fromMe ? "OUTBOUND" : "INBOUND",
                    type: msgType as never,
                    status: status as never,
                    body,
                    payload: m as never,
                    timestamp: ts,
                  },
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                out.errors.push(`history ${m.id}: ${msg}`);
              }
            }
          }
        }
        logEvent("[wa-cloud.webhook] history chunk", {
          phase: history[0]?.metadata?.phase,
          progress: history[0]?.metadata?.progress,
        });
        continue;
      }

      // ── messages (default Cloud API webhook field) ──
      if (FIELD !== "messages") continue;

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
