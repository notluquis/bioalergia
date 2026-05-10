import { db } from "@finanzas/db";
import {
  accountIdInput,
  blockContactInputSchema,
  businessProfileResponseSchema,
  acknowledgeAccountEventInputSchema,
  listSnippetsInputSchema,
  listSnippetsResponseSchema,
  sendSnippetInputSchema,
  snippetSchema,
  upsertSnippetInputSchema,
  allScheduledItemSchema,
  conversationAnalyticsExtendedInputSchema,
  conversationAnalyticsExtendedResponseSchema,
  listAccountEventsInputSchema,
  listAccountEventsResponseSchema,
  listAllScheduledInputSchema,
  listAllScheduledResponseSchema,
  savedFlowSchema,
  savedInteractiveListSchema,
  savedLocationSchema,
  syncFlowsInputSchema,
  syncFlowsResponseSchema,
  sendSavedFlowInputSchema,
  sendSavedListInputSchema,
  sendSavedLocationInputSchema,
  upsertSavedFlowInputSchema,
  upsertSavedInteractiveListInputSchema,
  upsertSavedLocationInputSchema,
  conversationAnalyticsInputSchema,
  conversationAnalyticsResponseSchema,
  registerPhoneInputSchema,
  sendAddressInputSchema,
  sendInteractiveListInputSchema,
  setTwoStepPinInputSchema,
  conversationIdInput,
  conversationDetailResponseSchema,
  accountResponseSchema,
  broadcastDetailResponseSchema,
  broadcastIdInputSchema,
  broadcastSummarySchema,
  cancelScheduledInputSchema,
  createBroadcastInputSchema,
  createTemplateInputSchema,
  listBroadcastsResponseSchema,
  createTemplateResponseSchema,
  deleteTemplateInputSchema,
  editTextInputSchema,
  listScheduledInputSchema,
  listScheduledResponseSchema,
  scheduleMessageInputSchema,
  scheduledMessageSchema,
  listAccountsResponseSchema,
  listBlockedResponseSchema,
  listConversationMediaInputSchema,
  listConversationMediaResponseSchema,
  listConversationsInputSchema,
  listConversationsResponseSchema,
  listTemplatesResponseSchema,
  listWebhookLogsInputSchema,
  listWebhookLogsResponseSchema,
  searchMessagesInputSchema,
  searchMessagesResponseSchema,
  markReadInputSchema,
  cloneTemplateFromLibraryInputSchema,
  cloneTemplateFromLibraryResponseSchema,
  conversationalAutomationSchema,
  listTemplateLibraryInputSchema,
  listTemplateLibraryResponseSchema,
  phoneHealthResponseSchema,
  phoneQualitySummaryInputSchema,
  phoneQualitySummaryResponseSchema,
  updateConversationalAutomationInputSchema,
  waPhoneIdInput,
  sendContactsInputSchema,
  sendFlowInputSchema,
  sendLocationInputSchema,
  sendMediaInputSchema,
  sendMessageResponseSchema,
  sendReactionInputSchema,
  sendTemplateInputSchema,
  sendTextInputSchema,
  syncTemplatesResponseSchema,
  updateBusinessProfileInputSchema,
  updateConversationInputSchema,
  updateWaContactInputSchema,
  upsertAccountInputSchema,
  upsertPhoneNumberInputSchema,
  validateAccountResponseSchema,
  waOkResponseSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { decryptSecret, encryptSecret } from "../lib/secret-cipher.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { emitWaEvent } from "../modules/wa-cloud/events.ts";
import {
  blockUsers,
  cloneTemplateFromLibrary,
  createTemplate,
  deleteTemplate,
  editTextMessage,
  getBusinessProfile,
  getConversationAnalytics,
  getConversationalAutomation,
  getPhoneHealth,
  listTemplateLibrary,
  updateConversationalAutomation,
  listAccountFlows,
  listAccountPhoneNumbers,
  listAccountTemplates,
  listBlockedUsers,
  markMessageRead,
  registerPhoneNumber,
  sendAddressMessage,
  sendContactsMessage,
  sendFlowMessage,
  sendInteractiveListMessage,
  sendLocationMessage,
  sendMediaMessage,
  sendReaction,
  sendTemplateMessage,
  sendTextMessage,
  setTwoStepPin,
  unblockUsers,
  updateBusinessProfile,
} from "../modules/wa-cloud/graph-client.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type WaCloudORPCContext = { hono: HonoContext };
const base = os.$context<WaCloudORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function gate(action: "read" | "create" | "update" | "delete", subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const SUBJECT = "WaBusinessAccount";
const readWa = gate("read", SUBJECT);
const writeWa = gate("update", SUBJECT);
const createWa = gate("create", SUBJECT);
const deleteWa = gate("delete", SUBJECT);

const WINDOW_HOURS = 24;

function maskAccount(a: {
  id: number;
  wabaId: string;
  metaBusinessId: string | null;
  appId: string | null;
  graphApiVersion: string;
  displayName: string | null;
  active: boolean;
  systemUserToken: string | null;
  appSecret: string | null;
  webhookVerifyToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    wabaId: a.wabaId,
    metaBusinessId: a.metaBusinessId,
    appId: a.appId,
    graphApiVersion: a.graphApiVersion,
    displayName: a.displayName,
    active: a.active,
    hasToken: Boolean(a.systemUserToken),
    hasAppSecret: Boolean(a.appSecret),
    hasVerifyToken: Boolean(a.webhookVerifyToken),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function buildAccountWithPhones(id: number) {
  const acc = await db.waBusinessAccount.findUnique({
    where: { id },
    include: { phoneNumbers: true },
  });
  if (!acc) throw new ORPCError("NOT_FOUND", { message: "Account no encontrada" });
  return { ...maskAccount(acc), phoneNumbers: acc.phoneNumbers };
}

const waRouterBase = {
  listAccounts: readWa
    .route({ method: "GET", path: "/accounts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listAccountsResponseSchema)
    .handler(async () => {
      const accs = await db.waBusinessAccount.findMany({
        include: { phoneNumbers: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        accounts: accs.map((a) => ({ ...maskAccount(a), phoneNumbers: a.phoneNumbers })),
      };
    }),

  upsertAccount: createWa
    .route({ method: "POST", path: "/accounts/upsert", tags: ["WA Cloud"] })
    .input(upsertAccountInputSchema)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      // All three secrets are encrypted at rest (AES-256-GCM, prefix
      // `enc:v1:`). Plaintext input from the operator is encrypted here
      // before any DB write.
      const encOrUndef = (v: string | undefined) =>
        v === undefined ? undefined : v ? encryptSecret(v) : null;
      const data = {
        wabaId: input.wabaId,
        metaBusinessId: input.metaBusinessId ?? null,
        appId: input.appId ?? null,
        appSecret: input.appSecret ? encryptSecret(input.appSecret) : undefined,
        systemUserToken: input.systemUserToken ? encryptSecret(input.systemUserToken) : undefined,
        webhookVerifyToken: input.webhookVerifyToken
          ? encryptSecret(input.webhookVerifyToken)
          : undefined,
        graphApiVersion: input.graphApiVersion ?? "v21.0",
        displayName: input.displayName ?? null,
        active: input.active ?? true,
      };
      const acc = input.id
        ? await db.waBusinessAccount.update({
            where: { id: input.id },
            data: {
              ...data,
              ...(input.appSecret !== undefined ? { appSecret: encOrUndef(input.appSecret) } : {}),
              ...(input.systemUserToken !== undefined
                ? { systemUserToken: encOrUndef(input.systemUserToken) }
                : {}),
              ...(input.webhookVerifyToken !== undefined
                ? { webhookVerifyToken: encOrUndef(input.webhookVerifyToken) }
                : {}),
            },
          })
        : await db.waBusinessAccount.create({ data });
      return { account: await buildAccountWithPhones(acc.id) };
    }),

  deleteAccount: deleteWa
    .route({ method: "POST", path: "/accounts/delete", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waBusinessAccount.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  validateAccount: writeWa
    .route({ method: "POST", path: "/accounts/validate", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(validateAccountResponseSchema)
    .handler(async ({ input }) => {
      try {
        const phones = await listAccountPhoneNumbers(input.id);
        const tpl = await listAccountTemplates(input.id);
        return {
          ok: true,
          phoneNumbersFound: phones.length,
          templatesFound: tpl.length,
          error: null,
        };
      } catch (err) {
        return {
          ok: false,
          phoneNumbersFound: 0,
          templatesFound: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),

  syncPhoneNumbers: writeWa
    .route({ method: "POST", path: "/accounts/sync-phones", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      const phones = await listAccountPhoneNumbers(input.id);
      // Batch existing rows once instead of N findUnique queries.
      const existingRows = await db.waPhoneNumber.findMany({
        where: { phoneNumberId: { in: phones.map((p) => p.id) } },
      });
      const existingByMetaId = new Map(existingRows.map((r) => [r.phoneNumberId, r]));
      await Promise.all(
        phones.map((p) => {
          const existing = existingByMetaId.get(p.id);
          const data = {
            accountId: input.id,
            phoneNumberId: p.id,
            displayPhoneNumber: p.display_phone_number,
            label: existing?.label ?? p.verified_name ?? null,
            qualityRating: p.quality_rating ?? null,
            active: true,
          };
          return existing
            ? db.waPhoneNumber.update({ where: { id: existing.id }, data })
            : db.waPhoneNumber.create({ data });
        }),
      );
      return { account: await buildAccountWithPhones(input.id) };
    }),

  syncTemplates: writeWa
    .route({ method: "POST", path: "/accounts/sync-templates", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(syncTemplatesResponseSchema)
    .handler(async ({ input }) => {
      const apiTpls = await listAccountTemplates(input.id);
      // Single batched lookup: all existing templates for this account in
      // one query, indexed by composite key (name, language). Replaces the
      // N findUnique sequential roundtrips.
      const existingRows = await db.waTemplate.findMany({
        where: { accountId: input.id },
        select: { id: true, name: true, language: true },
      });
      const existingByKey = new Map(
        existingRows.map((r) => [`${r.name} ${r.language}`, r.id]),
      );
      await Promise.all(
        apiTpls.map((t) => {
          const data = {
            accountId: input.id,
            name: t.name,
            language: t.language,
            category: t.category as never,
            status: t.status as never,
            components: t.components as never,
            qualityScore: t.quality_score?.score ?? null,
            metaTemplateId: t.id,
            syncedAt: new Date(),
          };
          const existingId = existingByKey.get(`${t.name} ${t.language}`);
          return existingId
            ? db.waTemplate.update({ where: { id: existingId }, data })
            : db.waTemplate.create({ data });
        }),
      );
      const all = await db.waTemplate.findMany({
        where: { accountId: input.id },
        orderBy: { name: "asc" },
      });
      return {
        total: all.length,
        templates: all.map((t) => ({
          ...t,
          components: (t.components as unknown[]) ?? [],
        })),
      };
    }),

  upsertPhoneNumber: writeWa
    .route({ method: "POST", path: "/phones/upsert", tags: ["WA Cloud"] })
    .input(upsertPhoneNumberInputSchema)
    .output(accountResponseSchema)
    .handler(async ({ input }) => {
      const data = {
        accountId: input.accountId,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: input.displayPhoneNumber,
        label: input.label ?? null,
        active: input.active ?? true,
      };
      if (input.id) {
        await db.waPhoneNumber.update({ where: { id: input.id }, data });
      } else {
        await db.waPhoneNumber.create({ data });
      }
      return { account: await buildAccountWithPhones(input.accountId) };
    }),

  listConversations: readWa
    .route({ method: "POST", path: "/conversations/list", tags: ["WA Cloud"] })
    .input(listConversationsInputSchema)
    .output(listConversationsResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.assignedToUserId !== undefined) where.assignedToUserId = input.assignedToUserId;
      if (input.phoneNumberId) {
        where.channels = { some: { phoneNumberId: input.phoneNumberId } };
      }
      if (input.search) {
        where.contact = {
          OR: [
            { phoneE164: { contains: input.search } },
            { name: { contains: input.search, mode: "insensitive" } },
            { pushName: { contains: input.search, mode: "insensitive" } },
          ],
        };
      }
      const total = await db.waConversation.count({ where });
      const items = await db.waConversation.findMany({
        where,
        include: { contact: true, channels: { select: { phoneNumberId: true } } },
        orderBy: { lastMessageAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      });
      return {
        items: items.map((c) => ({
          ...c,
          channelPhoneNumberIds: c.channels.map((ch) => ch.phoneNumberId),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getConversation: readWa
    .route({ method: "POST", path: "/conversations/get", tags: ["WA Cloud"] })
    .input(conversationIdInput)
    .output(conversationDetailResponseSchema)
    .handler(async ({ input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.id },
        include: {
          contact: true,
          channels: { include: { phoneNumber: { select: { id: true, label: true } } } },
        },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const messages = await db.waMessage.findMany({
        where: { conversationId: input.id },
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
        channels: conv.channels.map((c) => ({
          phoneNumberId: c.phoneNumberId,
          label: c.phoneNumber.label,
        })),
        windowOpen,
        windowExpiresAt,
      };
    }),

  updateConversation: writeWa
    .route({ method: "POST", path: "/conversations/update", tags: ["WA Cloud"] })
    .input(updateConversationInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {};
      if (input.status) data.status = input.status;
      if (input.assignedToUserId !== undefined) data.assignedToUserId = input.assignedToUserId;
      if (input.notas !== undefined) data.notas = input.notas;
      if (input.etiquetas !== undefined) data.etiquetas = input.etiquetas;
      await db.waConversation.update({ where: { id: input.id }, data });
      return { status: "ok" as const };
    }),

  markRead: writeWa
    .route({ method: "POST", path: "/conversations/mark-read", tags: ["WA Cloud"] })
    .input(markReadInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      // Tell Meta the most recent inbound message has been read so the patient
      // sees the blue ticks. Best-effort: errors here should not block clearing
      // the local unread badge.
      const latestInbound = await db.waMessage.findFirst({
        where: {
          conversationId: input.conversationId,
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
        where: { id: input.conversationId },
        data: { unreadCount: 0 },
      });
      return { status: "ok" as const };
    }),

  updateContact: writeWa
    .route({ method: "POST", path: "/contacts/update", tags: ["WA Cloud"] })
    .input(updateWaContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.notas !== undefined) data.notas = input.notas;
      if (input.etiquetas !== undefined) data.etiquetas = input.etiquetas;
      if (input.patientRut !== undefined) data.patientRut = input.patientRut;
      await db.waContact.update({ where: { id: input.id }, data });
      return { status: "ok" as const };
    }),

  sendText: writeWa
    .route({ method: "POST", path: "/messages/send-text", tags: ["WA Cloud"] })
    .input(sendTextInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      if (conv.contact.blockedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Contacto bloqueado. Desbloquéalo desde el menú de la conversación primero.",
        });
      }
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Ventana 24h cerrada. Usa una plantilla aprobada (sendTemplate) para reactivar la conversación.",
        });
      }

      const apiResp = await sendTextMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        body: input.body,
        contextMessageId: input.contextMetaMessageId,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "TEXT",
          status: "SENT",
          body: input.body,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: input.body.slice(0, 200),
        },
      });
      return { message };
    }),

  sendTemplate: writeWa
    .route({ method: "POST", path: "/messages/send-template", tags: ["WA Cloud"] })
    .input(sendTemplateInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      if (conv.contact.blockedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Contacto bloqueado. Desbloquéalo desde el menú de la conversación primero.",
        });
      }
      const components: Array<Record<string, unknown>> = [];
      if (input.headerParams?.length) {
        components.push({
          type: "header",
          parameters: input.headerParams.map((t) => ({ type: "text", text: t })),
        });
      }
      if (input.bodyParams?.length) {
        components.push({
          type: "body",
          parameters: input.bodyParams.map((t) => ({ type: "text", text: t })),
        });
      }
      // Carousel template (Meta 2026): build cards array with per-card image
      // header + body params + button payloads.
      if (input.cards && input.cards.length > 0) {
        const cards = input.cards.map((card) => {
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
          (card.quickReplyPayloads ?? []).forEach((payload, idx) => {
            cardComponents.push({
              type: "button",
              sub_type: "quick_reply",
              index: idx,
              parameters: [{ type: "payload", payload }],
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
      const apiResp = await sendTemplateMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        templateName: input.templateName,
        language: input.language,
        components: components as never,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const preview = `[plantilla] ${input.templateName}`;
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "TEMPLATE",
          status: "SENT",
          body: preview,
          templateName: input.templateName,
          templateLanguage: input.language,
          sentByUserId: context.user.id,
          payload: { components } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: preview },
      });
      return { message };
    }),

  sendReaction: writeWa
    .route({ method: "POST", path: "/messages/send-reaction", tags: ["WA Cloud"] })
    .input(sendReactionInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const apiResp = await sendReaction(
        input.phoneNumberId,
        conv.contact.phoneE164,
        input.metaMessageId,
        input.emoji,
      );
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "REACTION",
          status: "SENT",
          body: input.emoji || null,
          contextMetaMessageId: input.metaMessageId,
          sentByUserId: context.user.id,
          timestamp: now,
        },
      });
      return { message };
    }),

  sendMedia: writeWa
    .route({ method: "POST", path: "/messages/send-media", tags: ["WA Cloud"] })
    .input(sendMediaInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      if (!input.mediaId && !input.link) {
        throw new ORPCError("BAD_REQUEST", { message: "Falta mediaId o link" });
      }
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. Solo plantillas pueden reactivar la conversación.",
        });
      }
      const apiResp = await sendMediaMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        type: input.type,
        mediaId: input.mediaId,
        link: input.link,
        caption: input.caption,
        filename: input.filename,
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
      const preview =
        input.caption ?? (input.filename ? input.filename : `[${input.type}]`);
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: typeMap[input.type]!,
          status: "SENT",
          body: input.caption ?? null,
          mediaCaption: input.caption ?? null,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          sentByUserId: context.user.id,
          payload: {
            [input.type]: {
              id: input.mediaId,
              link: input.link,
              caption: input.caption,
              filename: input.filename,
            },
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: preview.slice(0, 200) },
      });
      return { message };
    }),

  sendFlow: writeWa
    .route({ method: "POST", path: "/messages/send-flow", tags: ["WA Cloud"] })
    .input(sendFlowInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Ventana 24h cerrada. Solo plantillas pueden reactivar la conversación; los flows requieren ventana abierta.",
        });
      }
      const apiResp = await sendFlowMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        flowId: input.flowId,
        flowCta: input.flowCta,
        bodyText: input.bodyText,
        headerText: input.headerText,
        footerText: input.footerText,
        flowToken: input.flowToken,
        initialScreen: input.initialScreen,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const preview = `[flow] ${input.flowCta}`;
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          status: "SENT",
          body: input.bodyText,
          sentByUserId: context.user.id,
          payload: {
            interactive_type: "flow",
            flow_id: input.flowId,
            flow_cta: input.flowCta,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: preview },
      });
      return { message };
    }),

  sendInteractiveList: writeWa
    .route({ method: "POST", path: "/messages/send-list", tags: ["WA Cloud"] })
    .input(sendInteractiveListInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. Las listas interactivas requieren ventana abierta.",
        });
      }
      const apiResp = await sendInteractiveListMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        bodyText: input.bodyText,
        buttonText: input.buttonText,
        sections: input.sections,
        headerText: input.headerText,
        footerText: input.footerText,
        contextMessageId: input.contextMetaMessageId,
        bizOpaqueCallbackData: input.bizOpaqueCallbackData,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          status: "SENT",
          body: input.bodyText,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: {
            interactive_type: "list",
            button: input.buttonText,
            sections: input.sections,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: `[lista] ${input.buttonText}` },
      });
      return { message };
    }),

  sendAddress: writeWa
    .route({ method: "POST", path: "/messages/send-address", tags: ["WA Cloud"] })
    .input(sendAddressInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. El address message requiere ventana abierta.",
        });
      }
      const apiResp = await sendAddressMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        bodyText: input.bodyText,
        country: input.country,
        saveAddressLabel: input.saveAddressLabel,
        contextMessageId: input.contextMetaMessageId,
        bizOpaqueCallbackData: input.bizOpaqueCallbackData,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          status: "SENT",
          body: input.bodyText,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: {
            interactive_type: "address_message",
            country: input.country,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: "[solicitar dirección]" },
      });
      return { message };
    }),

  sendLocation: writeWa
    .route({ method: "POST", path: "/messages/send-location", tags: ["WA Cloud"] })
    .input(sendLocationInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. Usa una plantilla aprobada para reactivar la conversación.",
        });
      }
      const apiResp = await sendLocationMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        address: input.address,
        contextMessageId: input.contextMetaMessageId,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const preview = `[ubicación] ${input.name ?? ""}`.trim();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "LOCATION",
          status: "SENT",
          body: input.name ?? null,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: {
            location: {
              latitude: input.latitude,
              longitude: input.longitude,
              name: input.name,
              address: input.address,
            },
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: preview },
      });
      return { message };
    }),

  sendContacts: writeWa
    .route({ method: "POST", path: "/messages/send-contacts", tags: ["WA Cloud"] })
    .input(sendContactsInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. Usa una plantilla aprobada para reactivar la conversación.",
        });
      }
      const apiResp = await sendContactsMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        contacts: input.contacts,
        contextMessageId: input.contextMetaMessageId,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const names = input.contacts.map((c) => c.name.formatted_name).join(", ");
      const preview = `[contacto] ${names}`.slice(0, 200);
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "CONTACTS",
          status: "SENT",
          body: names,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: { contacts: input.contacts } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: preview },
      });
      return { message };
    }),

  editText: writeWa
    .route({ method: "POST", path: "/messages/edit-text", tags: ["WA Cloud"] })
    .input(editTextInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ input }) => {
      const orig = await db.waMessage.findUnique({
        where: { id: input.messageId },
        include: { conversation: { include: { contact: true } } },
      });
      if (!orig) throw new ORPCError("NOT_FOUND", { message: "Mensaje no encontrado" });
      if (orig.direction !== "OUTBOUND" || orig.type !== "TEXT") {
        throw new ORPCError("BAD_REQUEST", { message: "Solo mensajes de texto enviados son editables" });
      }
      if (!orig.metaMessageId) {
        throw new ORPCError("BAD_REQUEST", { message: "Mensaje sin metaMessageId — no editable" });
      }
      // Cloud API window for editing: 15 minutes from send.
      const ageMs = Date.now() - orig.timestamp.getTime();
      if (ageMs > 15 * 60 * 1000) {
        throw new ORPCError("BAD_REQUEST", { message: "Ventana de edición (15 min) expirada" });
      }
      await editTextMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: orig.conversation.contact.phoneE164,
        metaMessageId: orig.metaMessageId,
        body: input.body,
      });
      const updated = await db.waMessage.update({
        where: { id: orig.id },
        data: { body: input.body },
      });
      return { message: updated };
    }),

  createTemplate: createWa
    .route({ method: "POST", path: "/templates/create", tags: ["WA Cloud"] })
    .input(createTemplateInputSchema)
    .output(createTemplateResponseSchema)
    .handler(async ({ input }) => {
      const r = await createTemplate({
        accountId: input.accountId,
        name: input.name,
        language: input.language,
        category: input.category,
        components: input.components,
      });
      // Best-effort local persistence so it shows up in the list before sync.
      try {
        await db.waTemplate.upsert({
          where: {
            accountId_name_language: {
              accountId: input.accountId,
              name: input.name,
              language: input.language,
            },
          },
          create: {
            accountId: input.accountId,
            metaTemplateId: r.id,
            name: input.name,
            language: input.language,
            category: input.category,
            status: r.status as "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED",
            components: input.components as never,
          },
          update: {
            metaTemplateId: r.id,
            status: r.status as "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED",
          },
        });
      } catch (err) {
        logError("[wa-cloud.createTemplate] persist failed", { err });
      }
      return r;
    }),

  // Template library (Meta-curated catalog, no approval review)
  listTemplateLibrary: readWa
    .route({ method: "POST", path: "/templates/library/list", tags: ["WA Cloud"] })
    .input(listTemplateLibraryInputSchema)
    .output(listTemplateLibraryResponseSchema)
    .handler(async ({ input }) => {
      const templates = await listTemplateLibrary(input.accountId, {
        category: input.category,
        topic: input.topic,
        industry: input.industry,
        language: input.language,
        search: input.search,
      });
      return { templates };
    }),

  cloneTemplateFromLibrary: createWa
    .route({ method: "POST", path: "/templates/library/clone", tags: ["WA Cloud"] })
    .input(cloneTemplateFromLibraryInputSchema)
    .output(cloneTemplateFromLibraryResponseSchema)
    .handler(async ({ input }) => {
      const r = await cloneTemplateFromLibrary({
        accountId: input.accountId,
        libraryTemplateName: input.libraryTemplateName,
        newName: input.newName,
        language: input.language,
        category: input.category,
      });
      // Persist locally so it appears in the templates list immediately.
      try {
        await db.waTemplate.upsert({
          where: {
            accountId_name_language: {
              accountId: input.accountId,
              name: input.newName ?? input.libraryTemplateName,
              language: input.language,
            },
          },
          create: {
            accountId: input.accountId,
            metaTemplateId: r.id,
            name: input.newName ?? input.libraryTemplateName,
            language: input.language,
            category: input.category,
            status: r.status as "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED",
            components: [] as never,
          },
          update: {
            metaTemplateId: r.id,
            status: r.status as "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED",
          },
        });
      } catch (err) {
        logError("[wa-cloud.cloneTemplateFromLibrary] persist failed", { err });
      }
      return r;
    }),

  deleteTemplate: deleteWa
    .route({ method: "POST", path: "/templates/delete", tags: ["WA Cloud"] })
    .input(deleteTemplateInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await deleteTemplate(input.accountId, input.name, input.hsmId);
      try {
        await db.waTemplate.deleteMany({
          where: { accountId: input.accountId, name: input.name },
        });
      } catch (err) {
        logError("[wa-cloud.deleteTemplate] local cleanup failed", { err });
      }
      return { status: "ok" as const };
    }),

  createBroadcast: createWa
    .route({ method: "POST", path: "/broadcasts/create", tags: ["WA Cloud"] })
    .input(createBroadcastInputSchema)
    .output(broadcastSummarySchema)
    .handler(async ({ context, input }) => {
      const bc = await db.waBroadcast.create({
        data: {
          accountId: input.accountId,
          phoneNumberId: input.phoneNumberId,
          name: input.name,
          templateName: input.templateName,
          templateLanguage: input.templateLanguage,
          scheduledAt: input.scheduledAt ?? null,
          rateLimitPerSecond: input.rateLimitPerSecond,
          totalRecipients: input.recipients.length,
          createdByUserId: context.user.id,
          status: input.scheduledAt ? "QUEUED" : "DRAFT",
          recipients: {
            create: input.recipients.map((r) => ({
              phoneE164: r.phoneE164,
              variables: r.variables as never,
            })),
          },
        },
      });
      return bc;
    }),

  listBroadcasts: readWa
    .route({ method: "GET", path: "/broadcasts", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(listBroadcastsResponseSchema)
    .handler(async () => {
      const rows = await db.waBroadcast.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { broadcasts: rows };
    }),

  getBroadcast: readWa
    .route({ method: "POST", path: "/broadcasts/get", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastDetailResponseSchema)
    .handler(async ({ input }) => {
      const bc = await db.waBroadcast.findUnique({ where: { id: input.id } });
      if (!bc) throw new ORPCError("NOT_FOUND", { message: "Broadcast no encontrado" });
      const recipients = await db.waBroadcastRecipient.findMany({
        where: { broadcastId: bc.id },
        orderBy: { id: "asc" },
        take: 1000,
      });
      return {
        broadcast: bc,
        recipients: recipients.map((r) => ({
          ...r,
          variables: (r.variables as unknown as string[]) ?? [],
        })),
      };
    }),

  startBroadcast: writeWa
    .route({ method: "POST", path: "/broadcasts/start", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(broadcastSummarySchema)
    .handler(async ({ input }) => {
      const bc = await db.waBroadcast.findUnique({ where: { id: input.id } });
      if (!bc) throw new ORPCError("NOT_FOUND", { message: "Broadcast no encontrado" });
      if (bc.status !== "DRAFT" && bc.status !== "QUEUED") {
        throw new ORPCError("BAD_REQUEST", {
          message: `Estado ${bc.status} no permite iniciar`,
        });
      }
      const updated = await db.waBroadcast.update({
        where: { id: bc.id },
        data: { status: "QUEUED", scheduledAt: bc.scheduledAt ?? new Date() },
      });
      return updated;
    }),

  cancelBroadcast: deleteWa
    .route({ method: "POST", path: "/broadcasts/cancel", tags: ["WA Cloud"] })
    .input(broadcastIdInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waBroadcast.update({
        where: { id: input.id },
        data: { status: "CANCELLED", finishedAt: new Date() },
      });
      await db.waBroadcastRecipient.updateMany({
        where: { broadcastId: input.id, status: "PENDING" },
        data: { status: "SKIPPED", errorMessage: "Broadcast cancelado" },
      });
      return { status: "ok" as const };
    }),

  scheduleMessage: writeWa
    .route({ method: "POST", path: "/scheduled/create", tags: ["WA Cloud"] })
    .input(scheduleMessageInputSchema)
    .output(scheduledMessageSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        select: { id: true, contactId: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      if (input.scheduledAt.getTime() <= Date.now() + 30_000) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Programa al menos 30 segundos en el futuro",
        });
      }
      const created = await db.waScheduledMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          scheduledAt: input.scheduledAt,
          type: input.type,
          body: input.body ?? null,
          templateName: input.templateName ?? null,
          templateLanguage: input.templateLanguage ?? null,
          templateVars: (input.templateVars ?? []) as never,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          createdByUserId: context.user.id,
        },
      });
      return {
        ...created,
        templateVars: (created.templateVars as unknown as string[]) ?? [],
      };
    }),

  listScheduled: readWa
    .route({ method: "POST", path: "/scheduled/list", tags: ["WA Cloud"] })
    .input(listScheduledInputSchema)
    .output(listScheduledResponseSchema)
    .handler(async ({ input }) => {
      const rows = await db.waScheduledMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { scheduledAt: "asc" },
      });
      return {
        scheduled: rows.map((r) => ({
          ...r,
          templateVars: (r.templateVars as unknown as string[]) ?? [],
        })),
      };
    }),

  cancelScheduled: deleteWa
    .route({ method: "POST", path: "/scheduled/cancel", tags: ["WA Cloud"] })
    .input(cancelScheduledInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waScheduledMessage.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
      return { status: "ok" as const };
    }),

  searchMessages: readWa
    .route({ method: "POST", path: "/messages/search", tags: ["WA Cloud"] })
    .input(searchMessagesInputSchema)
    .output(searchMessagesResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = {
        body: { contains: input.q, mode: "insensitive" },
      };
      if (input.conversationId) where.conversationId = input.conversationId;
      const rows = await db.waMessage.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: input.limit,
        include: { conversation: { include: { contact: true } } },
      });
      return {
        results: rows.map((r) => ({
          messageId: r.id,
          conversationId: r.conversationId,
          contactName:
            r.conversation.contact.name ?? r.conversation.contact.pushName ?? null,
          phoneE164: r.conversation.contact.phoneE164,
          direction: r.direction,
          type: r.type,
          body: r.body,
          timestamp: r.timestamp,
        })),
      };
    }),

  listConversationMedia: readWa
    .route({ method: "POST", path: "/messages/media-list", tags: ["WA Cloud"] })
    .input(listConversationMediaInputSchema)
    .output(listConversationMediaResponseSchema)
    .handler(async ({ input }) => {
      const rows = await db.waMessage.findMany({
        where: {
          conversationId: input.conversationId,
          type: { in: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"] },
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
        select: { id: true, type: true, body: true, timestamp: true, direction: true },
      });
      return {
        media: rows.map((r) => ({
          messageId: r.id,
          type: r.type,
          body: r.body,
          timestamp: r.timestamp,
          out: r.direction === "OUTBOUND",
        })),
      };
    }),

  listTemplates: readWa
    .route({ method: "GET", path: "/templates", tags: ["WA Cloud"] })
    .input(z.object({ accountId: z.number().int().optional() }).optional())
    .output(listTemplatesResponseSchema)
    .handler(async ({ input }) => {
      const where = input?.accountId ? { accountId: input.accountId } : {};
      const tpls = await db.waTemplate.findMany({ where, orderBy: { name: "asc" } });
      return {
        templates: tpls.map((t) => ({ ...t, components: (t.components as unknown[]) ?? [] })),
      };
    }),

  listWebhookLogs: readWa
    .route({ method: "POST", path: "/webhook-logs", tags: ["WA Cloud"] })
    .input(listWebhookLogsInputSchema)
    .output(listWebhookLogsResponseSchema)
    .handler(async ({ input }) => {
      const where = input.onlyInvalid ? { signatureValid: false } : {};
      const logs = await db.waWebhookLog.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: input.limit,
      });
      return {
        logs: logs.map((l) => {
          const payload = l.payload as
            | {
                entry?: Array<{ changes?: Array<{ field?: string }> }>;
                object?: string;
              }
            | null;
          const fields: string[] = [];
          for (const e of payload?.entry ?? []) {
            for (const c of e.changes ?? []) {
              if (c.field) fields.push(c.field);
            }
          }
          const preview = JSON.stringify(payload).slice(0, 200);
          return {
            id: l.id,
            receivedAt: l.receivedAt,
            signatureValid: l.signatureValid,
            processed: l.processed,
            eventCount: l.eventCount,
            errorMessage: l.errorMessage,
            fields: Array.from(new Set(fields)),
            preview,
          };
        }),
      };
    }),

  // ── Business profile ───────────────────────────────────────────────────────
  getBusinessProfile: readWa
    .route({ method: "POST", path: "/profile/get", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(businessProfileResponseSchema.nullable())
    .handler(async ({ input }) => {
      const p = await getBusinessProfile(input.phoneNumberId);
      if (!p) return null;
      return {
        about: p.about ?? null,
        address: p.address ?? null,
        description: p.description ?? null,
        email: p.email ?? null,
        profile_picture_url: p.profile_picture_url ?? null,
        vertical: p.vertical ?? null,
        websites: p.websites ?? null,
      };
    }),
  updateBusinessProfile: writeWa
    .route({ method: "POST", path: "/profile/update", tags: ["WA Cloud"] })
    .input(updateBusinessProfileInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateBusinessProfile(input.phoneNumberId, input.fields);
      return { status: "ok" as const };
    }),

  // ── Snippets / quick replies ──────────────────────────────────────────────
  listSnippets: readWa
    .route({ method: "POST", path: "/snippets/list", tags: ["WA Cloud"] })
    .input(listSnippetsInputSchema)
    .output(listSnippetsResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = { archived: false };
      if (input.kind) where.kind = input.kind;
      if (input.category) where.category = input.category;
      if (input.q && input.q.length >= 1) {
        where.OR = [
          { name: { contains: input.q, mode: "insensitive" } },
          { description: { contains: input.q, mode: "insensitive" } },
          { shortcut: { contains: input.q, mode: "insensitive" } },
          { bodyText: { contains: input.q, mode: "insensitive" } },
        ];
      }
      const rows = await db.waSnippet.findMany({
        where,
        orderBy: [{ hitCount: "desc" }, { name: "asc" }],
        take: 200,
      });
      return {
        snippets: rows.map((r) => ({
          ...r,
          replyButtons: (r.replyButtons as unknown as Array<{ id: string; title: string }> | null) ?? null,
          variables: (r.variables as unknown as string[]) ?? [],
        })),
      };
    }),

  upsertSnippet: createWa
    .route({ method: "POST", path: "/snippets/upsert", tags: ["WA Cloud"] })
    .input(upsertSnippetInputSchema)
    .output(snippetSchema)
    .handler(async ({ context, input }) => {
      const data = {
        accountId: input.accountId ?? null,
        kind: input.kind,
        category: input.category ?? null,
        name: input.name,
        description: input.description ?? null,
        shortcut: input.shortcut ?? null,
        bodyText: input.bodyText ?? null,
        ctaUrl: input.ctaUrl ?? null,
        ctaButtonText: input.ctaButtonText ?? null,
        ctaHeader: input.ctaHeader ?? null,
        ctaFooter: input.ctaFooter ?? null,
        replyButtons: (input.replyButtons as never) ?? undefined,
        replyHeader: input.replyHeader ?? null,
        replyFooter: input.replyFooter ?? null,
        mediaHandle: input.mediaHandle ?? null,
        // Meta media handles valid 30 days
        mediaHandleExpiresAt: input.mediaHandle
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        mediaUrl: input.mediaUrl ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        mediaFilename: input.mediaFilename ?? null,
        mediaSize: input.mediaSize ?? null,
        variables: input.variables ?? [],
      };
      const row = input.id
        ? await db.waSnippet.update({ where: { id: input.id }, data })
        : await db.waSnippet.create({
            data: { ...data, createdByUserId: context.user.id },
          });
      return {
        ...row,
        replyButtons: (row.replyButtons as unknown as Array<{ id: string; title: string }> | null) ?? null,
        variables: (row.variables as unknown as string[]) ?? [],
      };
    }),

  archiveSnippet: deleteWa
    .route({ method: "POST", path: "/snippets/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waSnippet.update({ where: { id: input.id }, data: { archived: true } });
      return { status: "ok" as const };
    }),

  sendSnippet: writeWa
    .route({ method: "POST", path: "/snippets/send", tags: ["WA Cloud"] })
    .input(sendSnippetInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const snip = await db.waSnippet.findUnique({ where: { id: input.snippetId } });
      if (!snip || snip.archived)
        throw new ORPCError("NOT_FOUND", { message: "Snippet no existe" });
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      if (conv.contact.blockedAt) {
        throw new ORPCError("BAD_REQUEST", { message: "Contacto bloqueado" });
      }
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Ventana 24h cerrada. Snippets requieren ventana abierta (usa template).",
        });
      }

      // Variable substitution
      const subs = input.variableValues ?? [];
      const resolve = (text: string | null) => {
        if (!text) return text;
        return text.replace(/\{\{(\d+)\}\}/g, (_, idx) => subs[Number(idx) - 1] ?? `{{${idx}}}`);
      };

      const toE164 = conv.contact.phoneE164;
      const now = new Date();
      let metaId: string | null = null;
      let preview = "";
      let messageType:
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "AUDIO"
        | "DOCUMENT"
        | "STICKER"
        | "INTERACTIVE" = "TEXT";
      let payload: Record<string, unknown> = { snippet_id: snip.id };

      if (snip.kind === "TEXT") {
        const body = resolve(snip.bodyText) ?? "";
        if (!body.trim()) throw new ORPCError("BAD_REQUEST", { message: "Snippet sin body" });
        const r = await sendTextMessage({ phoneNumberId: input.phoneNumberId, toE164, body });
        metaId = r.messages?.[0]?.id ?? null;
        preview = body.slice(0, 200);
        messageType = "TEXT";
        payload = { ...payload, body };
      } else if (snip.kind === "CTA_URL") {
        const body = resolve(snip.bodyText) ?? "";
        if (!snip.ctaUrl || !snip.ctaButtonText)
          throw new ORPCError("BAD_REQUEST", { message: "Snippet CTA sin url/buttonText" });
        // Cloud API: interactive type=cta_url
        const phone = await db.waPhoneNumber.findUnique({
          where: { id: input.phoneNumberId },
          include: { account: true },
        });
        const ctaToken = decryptSecret(phone?.account.systemUserToken);
        if (!phone || !ctaToken)
          throw new ORPCError("BAD_REQUEST", { message: "Account sin token" });
        const interactive: Record<string, unknown> = {
          type: "cta_url",
          body: { text: body },
          action: {
            name: "cta_url",
            parameters: { display_text: snip.ctaButtonText, url: snip.ctaUrl },
          },
        };
        if (snip.ctaHeader)
          interactive.header = { type: "text", text: resolve(snip.ctaHeader) };
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
          throw new ORPCError("BAD_GATEWAY", { message: `Meta CTA ${res.status}: ${text.slice(0, 200)}` });
        }
        const json = JSON.parse(text) as { messages: Array<{ id: string }> };
        metaId = json.messages?.[0]?.id ?? null;
        preview = `[CTA] ${snip.ctaButtonText}`;
        messageType = "INTERACTIVE";
        payload = { ...payload, interactive_type: "cta_url", body, button: snip.ctaButtonText, url: snip.ctaUrl };
      } else if (snip.kind === "REPLY_BUTTONS") {
        const buttons = (snip.replyButtons as unknown as Array<{ id: string; title: string }>) ?? [];
        if (buttons.length === 0)
          throw new ORPCError("BAD_REQUEST", { message: "Snippet sin botones" });
        const body = resolve(snip.bodyText) ?? "";
        const phone = await db.waPhoneNumber.findUnique({
          where: { id: input.phoneNumberId },
          include: { account: true },
        });
        const replyToken = decryptSecret(phone?.account.systemUserToken);
        if (!phone || !replyToken)
          throw new ORPCError("BAD_REQUEST", { message: "Account sin token" });
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
        if (snip.replyHeader)
          interactive.header = { type: "text", text: resolve(snip.replyHeader) };
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
          throw new ORPCError("BAD_GATEWAY", { message: `Meta buttons ${res.status}: ${text.slice(0, 200)}` });
        }
        const json = JSON.parse(text) as { messages: Array<{ id: string }> };
        metaId = json.messages?.[0]?.id ?? null;
        preview = `[botones] ${buttons.map((b) => b.title).join(" / ")}`;
        messageType = "INTERACTIVE";
        payload = { ...payload, interactive_type: "button", body, buttons };
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
          throw new ORPCError("BAD_REQUEST", { message: "Snippet media sin handle/url" });
        if (
          snip.mediaHandle &&
          snip.mediaHandleExpiresAt &&
          snip.mediaHandleExpiresAt.getTime() < Date.now()
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Media handle expirado (>30 días). Re-sube el archivo en Catálogo.",
          });
        }
        const r = await sendMediaMessage({
          phoneNumberId: input.phoneNumberId,
          toE164,
          type: typeMap[snip.kind],
          mediaId: snip.mediaHandle ?? undefined,
          link: snip.mediaUrl ?? undefined,
          caption: resolve(snip.bodyText) ?? undefined,
          filename: snip.mediaFilename ?? undefined,
        });
        metaId = r.messages?.[0]?.id ?? null;
        preview = `[${snip.kind.toLowerCase()}] ${snip.name}`;
        messageType = typeMap[snip.kind].toUpperCase() as
          | "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "STICKER";
        payload = { ...payload, kind: snip.kind, mediaId: snip.mediaHandle };
      } else {
        throw new ORPCError("BAD_REQUEST", { message: `Tipo ${snip.kind} no implementado` });
      }

      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: messageType,
          status: "SENT",
          body: snip.bodyText,
          sentByUserId: context.user.id,
          payload: payload as never,
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
      return { message };
    }),

  // ── Saved entities catalog ────────────────────────────────────────────────
  listSavedLocations: readWa
    .route({ method: "GET", path: "/saved/locations", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ locations: z.array(savedLocationSchema) }))
    .handler(async () => {
      const rows = await db.waSavedLocation.findMany({
        where: { archived: false },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
      return { locations: rows };
    }),
  upsertSavedLocation: createWa
    .route({ method: "POST", path: "/saved/locations/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedLocationInputSchema)
    .output(savedLocationSchema)
    .handler(async ({ context, input }) => {
      if (input.isDefault) {
        await db.waSavedLocation.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = input.id
        ? await db.waSavedLocation.update({
            where: { id: input.id },
            data: {
              name: input.name,
              latitude: input.latitude,
              longitude: input.longitude,
              address: input.address ?? null,
              isDefault: input.isDefault,
            },
          })
        : await db.waSavedLocation.create({
            data: {
              name: input.name,
              latitude: input.latitude,
              longitude: input.longitude,
              address: input.address ?? null,
              isDefault: input.isDefault,
              createdByUserId: context.user.id,
            },
          });
      return row;
    }),
  archiveSavedLocation: deleteWa
    .route({ method: "POST", path: "/saved/locations/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waSavedLocation.update({
        where: { id: input.id },
        data: { archived: true },
      });
      return { status: "ok" as const };
    }),

  listSavedInteractiveLists: readWa
    .route({ method: "GET", path: "/saved/lists", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ lists: z.array(savedInteractiveListSchema) }))
    .handler(async () => {
      const rows = await db.waSavedInteractiveList.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      });
      return {
        lists: rows.map((r) => ({
          ...r,
          sections: (r.sections as unknown as Array<{
            title?: string;
            rows: Array<{ id: string; title: string; description?: string }>;
          }>) ?? [],
        })),
      };
    }),
  upsertSavedInteractiveList: createWa
    .route({ method: "POST", path: "/saved/lists/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedInteractiveListInputSchema)
    .output(savedInteractiveListSchema)
    .handler(async ({ context, input }) => {
      const data = {
        name: input.name,
        description: input.description ?? null,
        headerText: input.headerText ?? null,
        bodyText: input.bodyText,
        footerText: input.footerText ?? null,
        buttonText: input.buttonText,
        sections: input.sections as never,
      };
      const row = input.id
        ? await db.waSavedInteractiveList.update({ where: { id: input.id }, data })
        : await db.waSavedInteractiveList.create({
            data: { ...data, createdByUserId: context.user.id },
          });
      return {
        ...row,
        sections: (row.sections as unknown as Array<{
          title?: string;
          rows: Array<{ id: string; title: string; description?: string }>;
        }>) ?? [],
      };
    }),
  archiveSavedInteractiveList: deleteWa
    .route({ method: "POST", path: "/saved/lists/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waSavedInteractiveList.update({
        where: { id: input.id },
        data: { archived: true },
      });
      return { status: "ok" as const };
    }),

  listSavedFlows: readWa
    .route({ method: "GET", path: "/saved/flows", tags: ["WA Cloud"] })
    .input(z.object({}).optional())
    .output(z.object({ flows: z.array(savedFlowSchema) }))
    .handler(async () => {
      const rows = await db.waSavedFlow.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      });
      return { flows: rows };
    }),
  upsertSavedFlow: createWa
    .route({ method: "POST", path: "/saved/flows/upsert", tags: ["WA Cloud"] })
    .input(upsertSavedFlowInputSchema)
    .output(savedFlowSchema)
    .handler(async ({ context, input }) => {
      const data = {
        accountId: input.accountId ?? null,
        name: input.name,
        description: input.description ?? null,
        flowId: input.flowId,
        flowToken: input.flowToken ?? null,
        initialScreen: input.initialScreen ?? null,
        defaultBody: input.defaultBody,
        defaultHeader: input.defaultHeader ?? null,
        defaultFooter: input.defaultFooter ?? null,
        defaultCta: input.defaultCta,
      };
      const row = input.id
        ? await db.waSavedFlow.update({ where: { id: input.id }, data })
        : await db.waSavedFlow.create({
            data: { ...data, createdByUserId: context.user.id },
          });
      return row;
    }),
  syncFlows: writeWa
    .route({ method: "POST", path: "/saved/flows/sync", tags: ["WA Cloud"] })
    .input(syncFlowsInputSchema)
    .output(syncFlowsResponseSchema)
    .handler(async ({ context, input }) => {
      const remote = await listAccountFlows(input.accountId);
      const now = new Date();
      // Batch existing rows for all remote flow ids in one query.
      const existingRows = await db.waSavedFlow.findMany({
        where: { flowId: { in: remote.map((f) => f.id) } },
      });
      const existingById = new Map(existingRows.map((r) => [r.flowId, r]));
      await Promise.all(
        remote.map((f) => {
          const existing = existingById.get(f.id);
          const meta = {
            metaStatus: f.status ?? null,
            metaCategories: f.categories ?? [],
            metaHealth: f.health?.can_send_message ?? null,
            metaSyncedAt: now,
          };
          return existing
            ? db.waSavedFlow.update({
                where: { flowId: f.id },
                data: {
                  ...meta,
                  accountId: existing.accountId ?? input.accountId,
                  // Refresh display name unless user customized it.
                  name: existing.name === existing.flowId ? f.name : existing.name,
                },
              })
            : db.waSavedFlow.create({
                data: {
                  accountId: input.accountId,
                  name: f.name ?? f.id,
                  flowId: f.id,
                  defaultBody: `Completa el formulario "${f.name ?? f.id}"`,
                  defaultCta: "Iniciar",
                  ...meta,
                  createdByUserId: context.user.id,
                },
              });
        }),
      );
      const upserted = remote.length;
      const flows = await db.waSavedFlow.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      });
      return { fetched: remote.length, upserted, flows };
    }),
  archiveSavedFlow: deleteWa
    .route({ method: "POST", path: "/saved/flows/archive", tags: ["WA Cloud"] })
    .input(z.object({ id: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await db.waSavedFlow.update({
        where: { id: input.id },
        data: { archived: true },
      });
      return { status: "ok" as const };
    }),

  // ── Send via saved entity (chiquillas eligen, no editan) ──────────────────
  sendSavedLocation: writeWa
    .route({ method: "POST", path: "/messages/send-saved-location", tags: ["WA Cloud"] })
    .input(sendSavedLocationInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const saved = await db.waSavedLocation.findUnique({
        where: { id: input.savedLocationId },
      });
      if (!saved || saved.archived) throw new ORPCError("NOT_FOUND", { message: "Ubicación no existe" });
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const apiResp = await sendLocationMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        latitude: saved.latitude,
        longitude: saved.longitude,
        name: saved.name,
        address: saved.address ?? undefined,
        contextMessageId: input.contextMetaMessageId,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "LOCATION",
          status: "SENT",
          body: saved.name,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: {
            location: {
              latitude: saved.latitude,
              longitude: saved.longitude,
              name: saved.name,
              address: saved.address,
            },
            saved_location_id: saved.id,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: `[ubicación] ${saved.name}` },
      });
      return { message };
    }),

  sendSavedList: writeWa
    .route({ method: "POST", path: "/messages/send-saved-list", tags: ["WA Cloud"] })
    .input(sendSavedListInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const saved = await db.waSavedInteractiveList.findUnique({
        where: { id: input.savedListId },
      });
      if (!saved || saved.archived) throw new ORPCError("NOT_FOUND", { message: "Lista no existe" });
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", { message: "Ventana 24h cerrada" });
      }
      const sections = (saved.sections as unknown as Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>) ?? [];
      const apiResp = await sendInteractiveListMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        bodyText: saved.bodyText,
        buttonText: saved.buttonText,
        sections,
        headerText: saved.headerText ?? undefined,
        footerText: saved.footerText ?? undefined,
        contextMessageId: input.contextMetaMessageId,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          status: "SENT",
          body: saved.bodyText,
          sentByUserId: context.user.id,
          contextMetaMessageId: input.contextMetaMessageId ?? null,
          payload: {
            interactive_type: "list",
            button: saved.buttonText,
            sections,
            saved_list_id: saved.id,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: `[lista] ${saved.name}` },
      });
      // bump hit count
      await db.waSavedInteractiveList.update({
        where: { id: saved.id },
        data: { hitCount: { increment: 1 }, lastUsedAt: now },
      });
      return { message };
    }),

  sendSavedFlow: writeWa
    .route({ method: "POST", path: "/messages/send-saved-flow", tags: ["WA Cloud"] })
    .input(sendSavedFlowInputSchema)
    .output(sendMessageResponseSchema)
    .handler(async ({ context, input }) => {
      const saved = await db.waSavedFlow.findUnique({ where: { id: input.savedFlowId } });
      if (!saved || saved.archived) throw new ORPCError("NOT_FOUND", { message: "Flow no existe" });
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      const lastInbound = conv.lastInboundAt;
      const windowOpen = lastInbound
        ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000
        : false;
      if (!windowOpen) {
        throw new ORPCError("BAD_REQUEST", { message: "Ventana 24h cerrada" });
      }
      const apiResp = await sendFlowMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        flowId: saved.flowId,
        flowCta: input.flowCta ?? saved.defaultCta,
        bodyText: input.bodyText ?? saved.defaultBody,
        headerText: saved.defaultHeader ?? undefined,
        footerText: saved.defaultFooter ?? undefined,
        flowToken: saved.flowToken ?? undefined,
        initialScreen: saved.initialScreen ?? undefined,
      });
      const metaId = apiResp.messages?.[0]?.id ?? null;
      const now = new Date();
      const message = await db.waMessage.create({
        data: {
          conversationId: conv.id,
          contactId: conv.contactId,
          phoneNumberId: input.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: "INTERACTIVE",
          status: "SENT",
          body: input.bodyText ?? saved.defaultBody,
          sentByUserId: context.user.id,
          payload: {
            interactive_type: "flow",
            flow_id: saved.flowId,
            flow_cta: input.flowCta ?? saved.defaultCta,
            saved_flow_id: saved.id,
          } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now, lastMessagePreview: `[flow] ${saved.name}` },
      });
      await db.waSavedFlow.update({
        where: { id: saved.id },
        data: { hitCount: { increment: 1 }, lastUsedAt: now },
      });
      return { message };
    }),

  // ── Global scheduled list ─────────────────────────────────────────────────
  listAllScheduled: readWa
    .route({ method: "POST", path: "/scheduled/list-all", tags: ["WA Cloud"] })
    .input(listAllScheduledInputSchema)
    .output(listAllScheduledResponseSchema)
    .handler(async ({ input }) => {
      const where = input.status ? { status: input.status } : {};
      const rows = await db.waScheduledMessage.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        take: input.limit,
        include: { conversation: { include: { contact: true } } },
      });
      return {
        scheduled: rows.map((r) => ({
          ...r,
          templateVars: (r.templateVars as unknown as string[]) ?? [],
          contactName:
            r.conversation.contact.name ?? r.conversation.contact.pushName ?? null,
          phoneE164: r.conversation.contact.phoneE164,
        })),
      };
    }),

  // ── Account events / alerts ───────────────────────────────────────────────
  listAccountEvents: readWa
    .route({ method: "POST", path: "/account-events/list", tags: ["WA Cloud"] })
    .input(listAccountEventsInputSchema)
    .output(listAccountEventsResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = {};
      if (input.acknowledged !== undefined) where.acknowledged = input.acknowledged;
      if (input.severity) where.severity = input.severity;
      const [events, unacknowledgedCount] = await Promise.all([
        db.waAccountEvent.findMany({
          where,
          orderBy: { receivedAt: "desc" },
          take: input.limit,
        }),
        db.waAccountEvent.count({ where: { acknowledged: false } }),
      ]);
      return { events, unacknowledgedCount };
    }),

  acknowledgeAccountEvent: writeWa
    .route({ method: "POST", path: "/account-events/ack", tags: ["WA Cloud"] })
    .input(acknowledgeAccountEventInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ context, input }) => {
      await db.waAccountEvent.update({
        where: { id: input.id },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedByUserId: context.user.id,
        },
      });
      return { status: "ok" as const };
    }),

  // ── Phone admin (register + 2FA PIN) ───────────────────────────────────────
  registerPhone: writeWa
    .route({ method: "POST", path: "/phones/register", tags: ["WA Cloud"] })
    .input(registerPhoneInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await registerPhoneNumber(input.phoneNumberId, input.pin);
      return { status: "ok" as const };
    }),

  setTwoStepPin: writeWa
    .route({ method: "POST", path: "/phones/two-step-pin", tags: ["WA Cloud"] })
    .input(setTwoStepPinInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await setTwoStepPin(input.phoneNumberId, input.pin);
      return { status: "ok" as const };
    }),

  // ── Extended analytics with pricing ────────────────────────────────────────
  getConversationAnalyticsExtended: readWa
    .route({ method: "POST", path: "/analytics/conversations/extended", tags: ["WA Cloud"] })
    .input(conversationAnalyticsExtendedInputSchema)
    .output(conversationAnalyticsExtendedResponseSchema)
    .handler(async ({ input }) => {
      const r = await getConversationAnalytics({
        accountId: input.accountId,
        startUnix: input.startUnix,
        endUnix: input.endUnix,
        granularity: input.granularity,
        phoneNumbers: input.phoneNumbers,
        includePricing: input.includePricing,
      });
      const conv = r.conversation_analytics?.data?.[0]?.data_points ?? [];
      const pricing = r.pricing_analytics?.data?.[0]?.data_points ?? [];
      return {
        conversation: conv.map((p) => ({
          start: p.start,
          end: p.end,
          conversation: p.conversation,
          cost: p.cost ?? null,
          phone_number: p.phone_number ?? null,
          country: p.country ?? null,
          conversation_type: p.conversation_type ?? null,
          conversation_direction: p.conversation_direction ?? null,
          conversation_category: p.conversation_category ?? null,
        })),
        pricing: pricing.map((p) => ({
          start: p.start,
          end: p.end,
          volume: p.volume,
          cost: p.cost ?? null,
          pricing_category: p.pricing_category ?? null,
          country: p.country ?? null,
          phone_number: p.phone_number ?? null,
          pricing_type: p.pricing_type ?? null,
          tier: p.tier ?? null,
        })),
      };
    }),

  // ── Phone health ───────────────────────────────────────────────────────────
  getPhoneHealth: readWa
    .route({ method: "POST", path: "/phones/health", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(phoneHealthResponseSchema)
    .handler(async ({ input }) => {
      const h = await getPhoneHealth(input.phoneNumberId);
      // Persist quality_rating snapshot for offline charts.
      try {
        if (h.quality_rating) {
          await db.waPhoneNumber.update({
            where: { id: input.phoneNumberId },
            data: { qualityRating: h.quality_rating },
          });
        }
      } catch (err) {
        logError("[wa-cloud.getPhoneHealth] persist failed", { err });
      }
      return h;
    }),

  // ── Conversational automation (ice breakers + commands) ───────────────────
  getConversationalAutomation: readWa
    .route({
      method: "POST",
      path: "/phones/conversational-automation",
      tags: ["WA Cloud"],
    })
    .input(waPhoneIdInput)
    .output(conversationalAutomationSchema)
    .handler(async ({ input }) => {
      const r = await getConversationalAutomation(input.phoneNumberId);
      return {
        enable_welcome_message: Boolean(r.enable_welcome_message),
        prompts: r.prompts ?? [],
        commands: r.commands ?? [],
      };
    }),

  updateConversationalAutomation: writeWa
    .route({
      method: "POST",
      path: "/phones/conversational-automation/update",
      tags: ["WA Cloud"],
    })
    .input(updateConversationalAutomationInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      await updateConversationalAutomation(input.phoneNumberId, input.config);
      return { status: "ok" as const };
    }),

  // Cheap local-DB summary for the conversation header badge. Reads the
  // qualityRating snapshot (kept fresh by the webhook handler) and counts
  // unacknowledged critical / warning events for this phone.
  getPhoneQualitySummary: readWa
    .route({
      method: "POST",
      path: "/phones/quality-summary",
      tags: ["WA Cloud"],
    })
    .input(phoneQualitySummaryInputSchema)
    .output(phoneQualitySummaryResponseSchema)
    .handler(async ({ input }) => {
      const phone = await db.waPhoneNumber.findUnique({
        where: { id: input.phoneNumberId },
        select: { id: true, qualityRating: true },
      });
      if (!phone) {
        throw new ORPCError("NOT_FOUND", { message: "Phone no encontrado" });
      }
      const [critical, warning, last] = await Promise.all([
        db.waAccountEvent.count({
          where: {
            phoneNumberId: input.phoneNumberId,
            severity: "critical",
            acknowledged: false,
          },
        }),
        db.waAccountEvent.count({
          where: {
            phoneNumberId: input.phoneNumberId,
            severity: "warning",
            acknowledged: false,
          },
        }),
        db.waAccountEvent.findFirst({
          where: { phoneNumberId: input.phoneNumberId },
          orderBy: { receivedAt: "desc" },
          select: { receivedAt: true },
        }),
      ]);
      const allowed = ["GREEN", "YELLOW", "RED"] as const;
      const rating =
        phone.qualityRating && (allowed as readonly string[]).includes(phone.qualityRating)
          ? (phone.qualityRating as "GREEN" | "YELLOW" | "RED")
          : null;
      return {
        phoneNumberId: phone.id,
        qualityRating: rating,
        criticalUnacknowledged: critical,
        warningUnacknowledged: warning,
        lastEventAt: last?.receivedAt ?? null,
      };
    }),

  // ── Block / unblock ────────────────────────────────────────────────────────
  blockContact: writeWa
    .route({ method: "POST", path: "/contacts/block", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ context, input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      await blockUsers(input.phoneNumberId, [conv.contact.phoneE164]);
      const now = new Date();
      await db.waContact.update({
        where: { id: conv.contactId },
        data: { blockedAt: now, blockedByUserId: context.user.id },
      });
      await db.waConversation.update({
        where: { id: input.conversationId },
        data: { status: "ARCHIVED" },
      });
      return { status: "ok" as const };
    }),
  unblockContact: writeWa
    .route({ method: "POST", path: "/contacts/unblock", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      await unblockUsers(input.phoneNumberId, [conv.contact.phoneE164]);
      await db.waContact.update({
        where: { id: conv.contactId },
        data: { blockedAt: null, blockedByUserId: null },
      });
      await db.waConversation.update({
        where: { id: input.conversationId },
        data: { status: "OPEN" },
      });
      return { status: "ok" as const };
    }),
  listBlocked: readWa
    .route({ method: "POST", path: "/contacts/blocked", tags: ["WA Cloud"] })
    .input(waPhoneIdInput)
    .output(listBlockedResponseSchema)
    .handler(async ({ input }) => {
      const r = await listBlockedUsers(input.phoneNumberId);
      return {
        blocked: (r.data ?? []).map((b) => ({
          wa_id: b.wa_id ?? null,
          input: b.input ?? null,
        })),
      };
    }),

  // ── Typing indicator ───────────────────────────────────────────────────────
  setTyping: writeWa
    .route({ method: "POST", path: "/conversations/typing", tags: ["WA Cloud"] })
    .input(z.object({ conversationId: z.number().int().positive() }))
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      const latest = await db.waMessage.findFirst({
        where: {
          conversationId: input.conversationId,
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
      return { status: "ok" as const };
    }),

  // ── Analytics ──────────────────────────────────────────────────────────────
  getConversationAnalytics: readWa
    .route({ method: "POST", path: "/analytics/conversations", tags: ["WA Cloud"] })
    .input(conversationAnalyticsInputSchema)
    .output(conversationAnalyticsResponseSchema)
    .handler(async ({ input }) => {
      const r = await getConversationAnalytics({
        accountId: input.accountId,
        startUnix: input.startUnix,
        endUnix: input.endUnix,
        granularity: input.granularity,
        phoneNumbers: input.phoneNumbers,
      });
      const points = r.conversation_analytics?.data?.[0]?.data_points ?? [];
      return {
        dataPoints: points.map((p) => ({
          start: p.start,
          end: p.end,
          conversation: p.conversation,
          cost: p.cost ?? null,
          phone_number: p.phone_number ?? null,
          conversation_type: p.conversation_type ?? null,
          conversation_direction: p.conversation_direction ?? null,
          conversation_category: p.conversation_category ?? null,
        })),
      };
    }),
};

export const waCloudORPCRouter = base.prefix("/api/orpc/wa-cloud").router(waRouterBase);

export const waCloudORPCHandler = new SuperJSONRPCHandler(waCloudORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.wa-cloud" });
    }),
  ],
});

export const waCloudOpenAPIHandler = new OpenAPIHandler(waCloudORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia WhatsApp Cloud oRPC",
          description: "Contratos para WhatsApp Cloud API integration.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.wa-cloud" });
    }),
  ],
});

export type WaCloudORPCRouter = typeof waCloudORPCRouter;
