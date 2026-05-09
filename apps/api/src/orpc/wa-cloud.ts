import { db } from "@finanzas/db";
import {
  accountIdInput,
  blockContactInputSchema,
  businessProfileResponseSchema,
  acknowledgeAccountEventInputSchema,
  conversationAnalyticsExtendedInputSchema,
  conversationAnalyticsExtendedResponseSchema,
  listAccountEventsInputSchema,
  listAccountEventsResponseSchema,
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
  phoneHealthResponseSchema,
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
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  blockUsers,
  createTemplate,
  deleteTemplate,
  editTextMessage,
  getBusinessProfile,
  getConversationAnalytics,
  getPhoneHealth,
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
      const data = {
        wabaId: input.wabaId,
        metaBusinessId: input.metaBusinessId ?? null,
        appId: input.appId ?? null,
        appSecret: input.appSecret ?? undefined,
        systemUserToken: input.systemUserToken ?? undefined,
        webhookVerifyToken: input.webhookVerifyToken ?? undefined,
        graphApiVersion: input.graphApiVersion ?? "v21.0",
        displayName: input.displayName ?? null,
        active: input.active ?? true,
      };
      const acc = input.id
        ? await db.waBusinessAccount.update({
            where: { id: input.id },
            data: {
              ...data,
              ...(input.appSecret !== undefined ? { appSecret: input.appSecret || null } : {}),
              ...(input.systemUserToken !== undefined
                ? { systemUserToken: input.systemUserToken || null }
                : {}),
              ...(input.webhookVerifyToken !== undefined
                ? { webhookVerifyToken: input.webhookVerifyToken || null }
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
      for (const p of phones) {
        const existing = await db.waPhoneNumber.findUnique({
          where: { phoneNumberId: p.id },
        });
        const data = {
          accountId: input.id,
          phoneNumberId: p.id,
          displayPhoneNumber: p.display_phone_number,
          label: existing?.label ?? p.verified_name ?? null,
          qualityRating: p.quality_rating ?? null,
          active: true,
        };
        if (existing) {
          await db.waPhoneNumber.update({ where: { id: existing.id }, data });
        } else {
          await db.waPhoneNumber.create({ data });
        }
      }
      return { account: await buildAccountWithPhones(input.id) };
    }),

  syncTemplates: writeWa
    .route({ method: "POST", path: "/accounts/sync-templates", tags: ["WA Cloud"] })
    .input(accountIdInput)
    .output(syncTemplatesResponseSchema)
    .handler(async ({ input }) => {
      const apiTpls = await listAccountTemplates(input.id);
      for (const t of apiTpls) {
        const existing = await db.waTemplate.findUnique({
          where: {
            accountId_name_language: {
              accountId: input.id,
              name: t.name,
              language: t.language,
            },
          },
        });
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
        if (existing) {
          await db.waTemplate.update({ where: { id: existing.id }, data });
        } else {
          await db.waTemplate.create({ data });
        }
      }
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
      const components: Array<{
        type: "header" | "body" | "footer" | "button";
        parameters?: Array<{ type: "text"; text: string }>;
      }> = [];
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
      const apiResp = await sendTemplateMessage({
        phoneNumberId: input.phoneNumberId,
        toE164: conv.contact.phoneE164,
        templateName: input.templateName,
        language: input.language,
        components,
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
          conversation_category: p.conversation_category ?? null,
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

  // ── Block / unblock ────────────────────────────────────────────────────────
  blockContact: writeWa
    .route({ method: "POST", path: "/contacts/block", tags: ["WA Cloud"] })
    .input(blockContactInputSchema)
    .output(waOkResponseSchema)
    .handler(async ({ input }) => {
      const conv = await db.waConversation.findUnique({
        where: { id: input.conversationId },
        include: { contact: true },
      });
      if (!conv) throw new ORPCError("NOT_FOUND", { message: "Conversación no encontrada" });
      await blockUsers(input.phoneNumberId, [conv.contact.phoneE164]);
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
