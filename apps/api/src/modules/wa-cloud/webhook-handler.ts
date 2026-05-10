import { db } from "@finanzas/db";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { normalizeToE164 } from "./phone.ts";

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
  // Click-to-WhatsApp ad referral attribution
  referral?: {
    source_url?: string;
    source_type?: string;
    source_id?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    ctwa_clid?: string;
  };
  identity?: { acknowledged?: boolean; created_timestamp?: string; hash?: string };
  system?: { body?: string; type?: string };
};

type MetaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  conversation?: { id: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; pricing_model?: string; category?: string };
  errors?: Array<{ code: number; title: string; message?: string; error_data?: { details?: string } }>;
  biz_opaque_callback_data?: string;
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

// Map raw Meta webhook field names to our normalized WaAccountEventKind enum +
// pick a sensible severity. Defaults to OTHER + info.
function mapEventKind(field: string): { kind:
  | "ACCOUNT_ALERT" | "ACCOUNT_REVIEW" | "ACCOUNT_SETTINGS" | "ACCOUNT_UPDATE"
  | "BUSINESS_CAPABILITY" | "BUSINESS_STATUS" | "SECURITY" | "PARTNER_SOLUTIONS"
  | "PAYMENT_CONFIG" | "USER_PREFERENCES" | "PHONE_QUALITY" | "PHONE_NAME"
  | "TEMPLATE_STATUS" | "TEMPLATE_QUALITY" | "TEMPLATE_CATEGORY"
  | "AUTOMATIC" | "TRACKING" | "OTHER"; severity: "info" | "warning" | "critical" } {
  switch (field) {
    case "account_alerts": return { kind: "ACCOUNT_ALERT", severity: "warning" };
    case "account_review_update": return { kind: "ACCOUNT_REVIEW", severity: "warning" };
    case "account_settings_update": return { kind: "ACCOUNT_SETTINGS", severity: "info" };
    case "account_update": return { kind: "ACCOUNT_UPDATE", severity: "info" };
    case "business_capability_update": return { kind: "BUSINESS_CAPABILITY", severity: "info" };
    case "business_status_update": return { kind: "BUSINESS_STATUS", severity: "warning" };
    case "security": return { kind: "SECURITY", severity: "critical" };
    case "partner_solutions": return { kind: "PARTNER_SOLUTIONS", severity: "info" };
    case "payment_configuration_update": return { kind: "PAYMENT_CONFIG", severity: "warning" };
    case "user_preferences": return { kind: "USER_PREFERENCES", severity: "info" };
    case "phone_number_quality_update": return { kind: "PHONE_QUALITY", severity: "warning" };
    case "phone_number_name_update": return { kind: "PHONE_NAME", severity: "info" };
    case "automatic_events": return { kind: "AUTOMATIC", severity: "info" };
    case "tracking_events": return { kind: "TRACKING", severity: "info" };
    default: return { kind: "OTHER", severity: "info" };
  }
}

function summarizeEvent(field: string, v: Record<string, unknown>): { title: string; description: string | null } {
  const get = (k: string) => v[k];
  switch (field) {
    case "account_alerts": {
      const t = (get("alert_severity") as string | undefined) ?? "alert";
      const reason = (get("alert_description") as string | undefined) ?? null;
      return { title: `Alerta de cuenta: ${t}`, description: reason };
    }
    case "account_review_update":
      return { title: "Meta revisó la cuenta", description: (get("decision") as string | undefined) ?? null };
    case "business_capability_update": {
      const tier = get("max_daily_conversation_per_phone");
      return { title: `Cambio de tier`, description: tier ? `Nuevo límite diario: ${tier}` : null };
    }
    case "business_status_update":
      return { title: "Estado del negocio cambió", description: (get("business_verification_status") as string | undefined) ?? null };
    case "security":
      return { title: "Evento de seguridad", description: (get("text") as string | undefined) ?? null };
    case "phone_number_quality_update": {
      const cur = get("current_limit") ?? get("event");
      return { title: `Calidad de número: ${cur}`, description: null };
    }
    case "phone_number_name_update":
      return { title: "Cambio de nombre de número", description: (get("decision") as string | undefined) ?? null };
    case "user_preferences":
      return { title: "Preferencias de usuario", description: null };
    case "tracking_events":
      return { title: "Tracking event", description: null };
    case "calls":
      return { title: "Evento de llamada", description: null };
    case "flows":
      return { title: "Evento de Flow", description: null };
    default:
      return { title: field, description: null };
  }
}

async function persistAccountEvent(args: {
  accountId: number | null;
  phoneNumberId: number | null;
  field: string;
  value: Record<string, unknown>;
}) {
  const { kind, severity } = mapEventKind(args.field);
  const { title, description } = summarizeEvent(args.field, args.value);
  await db.waAccountEvent.create({
    data: {
      accountId: args.accountId,
      phoneNumberId: args.phoneNumberId,
      kind: kind as never,
      field: args.field,
      severity,
      title,
      description,
      payload: args.value as never,
    },
  });
}

async function applyUserPreferences(v: Record<string, unknown>) {
  // Meta payload: { contacts:[{wa_id}], user_preferences:[{category, value}] }
  const contacts = (v.contacts as Array<{ wa_id?: string }> | undefined) ?? [];
  const prefs = (v.user_preferences as Array<{ category?: string; value?: string }> | undefined) ?? [];
  if (contacts.length === 0 || prefs.length === 0) return;
  for (const c of contacts) {
    if (!c.wa_id) continue;
    const phoneE164 = normalizeToE164(c.wa_id);
    const existing = await db.waContact.findUnique({ where: { phoneE164 } });
    if (!existing) continue;
    for (const p of prefs) {
      if (p.category === "marketing_messages") {
        const optIn = p.value === "resume" || p.value === "OPTED_IN" || p.value === "opted_in";
        const optOut = p.value === "stop" || p.value === "OPTED_OUT" || p.value === "opted_out";
        if (optIn || optOut) {
          await db.waContact.update({
            where: { id: existing.id },
            data: {
              marketingOptIn: optIn,
              marketingOptInAt: new Date(),
              optInStatus: optIn ? "OPTED_IN" : "OPTED_OUT",
            },
          });
        }
      }
    }
  }
}

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
  if (m.contacts) return "[contacto compartido]";
  if (m.interactive) {
    const it = m.interactive as { type?: string; nfm_reply?: { name?: string } };
    if (it.type === "nfm_reply") return `[respuesta flow ${it.nfm_reply?.name ?? ""}]`.trim();
    return "[interactivo]";
  }
  if (m.button) return m.button.text;
  if (m.reaction) return `[reacción] ${m.reaction.emoji}`;
  return `[${m.type}]`;
}

export type ProcessResult = { events: number; errors: string[] };

export async function processWebhookPayload(payload: MetaWebhookPayload): Promise<ProcessResult> {
  const out: ProcessResult = { events: 0, errors: [] };
  for (const entry of payload.entry ?? []) {
    // Meta dashboard "Send test event" / Subscribe button: entry.id === "0" with
    // sample payload (fake phone_number_id, fake message ids). Skip silently so
    // subscription enable does not appear as failed in our logs / Meta UI.
    if (entry.id === "0") {
      logEvent("[wa-cloud.webhook] sample/test event from Meta dashboard, skipped", {
        fields: entry.changes?.map((c) => c.field),
      });
      continue;
    }
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

      // account_* / business_* / security / partner / payment / user_preferences:
      // persist as WaAccountEvent so the inbox UI can surface them.
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
        try {
          const account = await db.waBusinessAccount.findUnique({ where: { wabaId } });
          await persistAccountEvent({
            accountId: account?.id ?? null,
            phoneNumberId: null,
            field: FIELD,
            value: v as unknown as Record<string, unknown>,
          });
          // user_preferences: also update WaContact.marketingOptIn
          if (FIELD === "user_preferences") {
            await applyUserPreferences(v as unknown as Record<string, unknown>);
          }
        } catch (err) {
          out.errors.push(`${FIELD}: ${err instanceof Error ? err.message : String(err)}`);
        }
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

      // ── phone_number_*: actualizar WaPhoneNumber + persist event ──
      if (FIELD === "phone_number_quality_update") {
        out.events += 1;
        try {
          const p = v as unknown as { current_limit?: string; event?: string };
          await db.waPhoneNumber.update({
            where: { id: phoneRow.id },
            data: { qualityRating: p.current_limit ?? p.event ?? null },
          });
          await persistAccountEvent({
            accountId: phoneRow.accountId,
            phoneNumberId: phoneRow.id,
            field: FIELD,
            value: v as unknown as Record<string, unknown>,
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
          await persistAccountEvent({
            accountId: phoneRow.accountId,
            phoneNumberId: phoneRow.id,
            field: FIELD,
            value: v as unknown as Record<string, unknown>,
          });
        } catch (err) {
          out.errors.push(`phone name: ${err instanceof Error ? err.message : String(err)}`);
        }
        continue;
      }

      // ── calls / flows / messaging_handovers / standby / tracking_events ──
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
        try {
          await persistAccountEvent({
            accountId: phoneRow.accountId,
            phoneNumberId: phoneRow.id,
            field: FIELD,
            value: v as unknown as Record<string, unknown>,
          });
          // Flows: keep WaSavedFlow.metaStatus in sync without polling
          if (FIELD === "flows") {
            const fp = v as unknown as { method?: string; flow_id?: string };
            if (fp.flow_id) {
              const statusMap: Record<string, string> = {
                PUBLISHED: "PUBLISHED",
                UNPUBLISHED: "DRAFT",
                DEPRECATED: "DEPRECATED",
                BLOCKED: "BLOCKED",
                UNBLOCKED: "PUBLISHED",
                DELETED: "DELETED",
                THROTTLED: "THROTTLED",
              };
              const newStatus = fp.method ? statusMap[fp.method] ?? fp.method : null;
              if (newStatus) {
                await db.waSavedFlow.updateMany({
                  where: { flowId: fp.flow_id },
                  data: {
                    metaStatus: newStatus,
                    metaSyncedAt: new Date(),
                    archived: newStatus === "DELETED",
                  },
                });
              }
            }
          }
        } catch (err) {
          out.errors.push(`${FIELD}: ${err instanceof Error ? err.message : String(err)}`);
        }
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

            // For REACTION messages the "original" is in m.reaction.message_id
            // (not in m.context). Normalise both into contextMetaMessageId so
            // the UI can always find the target message.
            const ctxId = m.reaction?.message_id ?? m.context?.id ?? null;
            // System message body (e.g. "User changed phone number to ...")
            const sysBody = m.system?.body ?? null;
            const finalBody = body ?? sysBody;
            // Referral attribution for Click-to-WhatsApp ad messages
            const r = m.referral;
            await db.waMessage.create({
              data: {
                conversationId: convId,
                contactId,
                phoneNumberId: phoneRow.id,
                metaMessageId: m.id,
                direction: "INBOUND",
                type: msgType as never,
                status: "DELIVERED",
                body: finalBody,
                mediaCaption,
                mediaMimeType: mediaMime,
                contextMetaMessageId: ctxId,
                payload: m as never,
                timestamp: ts,
                deliveredAt: ts,
                referralSourceUrl: r?.source_url ?? null,
                referralSourceType: r?.source_type ?? null,
                referralSourceId: r?.source_id ?? null,
                referralCtwaClid: r?.ctwa_clid ?? null,
                referralHeadline: r?.headline ?? null,
                referralBodyText: r?.body ?? null,
                referralMediaType: r?.media_type ?? null,
                referralMediaUrl: r?.image_url ?? r?.video_url ?? r?.thumbnail_url ?? null,
              },
            });

            // Referral → tag conversation with utm-style label so staff filter
            if (r?.source_id) {
              try {
                const conv = await db.waConversation.findUnique({
                  where: { id: convId },
                  select: { etiquetas: true },
                });
                const tag = `ad:${r.source_id}`;
                const next = Array.from(new Set([...(conv?.etiquetas ?? []), tag]));
                await db.waConversation.update({
                  where: { id: convId },
                  data: { etiquetas: next },
                });
              } catch {
                // ignore tagging failure
              }
            }

            // Identity changed (m.identity.acknowledged): update local pushName timestamp
            if (m.identity?.acknowledged) {
              await db.waContact.update({
                where: { id: contactId },
                data: { updatedAt: new Date() },
              }).catch(() => undefined);
            }

            // Auto-tag conversation when patient clicks a Quick Reply button
            // from a template (e.g. "Confirmar asistencia" / "Reagendar"). The
            // payload is set per template; clinic staff can search by tag.
            if (m.type === "button" && m.button?.payload) {
              const conv = await db.waConversation.findUnique({
                where: { id: convId },
                select: { etiquetas: true },
              });
              const newTag = `btn:${m.button.payload.slice(0, 64)}`;
              const next = Array.from(new Set([...(conv?.etiquetas ?? []), newTag]));
              await db.waConversation.update({
                where: { id: convId },
                data: { etiquetas: next },
              });
            }

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
            // Status enrichment fields (Meta sends these on each status event)
            if (s.conversation?.id) data.conversationWindowId = s.conversation.id;
            if (s.conversation?.origin?.type) data.conversationOrigin = s.conversation.origin.type;
            if (s.pricing) {
              if (typeof s.pricing.billable === "boolean") data.pricingBillable = s.pricing.billable;
              if (s.pricing.pricing_model) data.pricingModel = s.pricing.pricing_model;
              if (s.pricing.category) data.pricingCategory = s.pricing.category;
            }
            if (s.biz_opaque_callback_data) data.bizCallbackData = s.biz_opaque_callback_data;
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
