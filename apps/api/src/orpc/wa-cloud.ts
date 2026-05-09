import { db } from "@finanzas/db";
import {
  accountIdInput,
  conversationIdInput,
  conversationDetailResponseSchema,
  accountResponseSchema,
  listAccountsResponseSchema,
  listConversationsInputSchema,
  listConversationsResponseSchema,
  listTemplatesResponseSchema,
  listWebhookLogsInputSchema,
  listWebhookLogsResponseSchema,
  markReadInputSchema,
  sendFlowInputSchema,
  sendMediaInputSchema,
  sendMessageResponseSchema,
  sendReactionInputSchema,
  sendTemplateInputSchema,
  sendTextInputSchema,
  syncTemplatesResponseSchema,
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
  listAccountPhoneNumbers,
  listAccountTemplates,
  markMessageRead,
  sendFlowMessage,
  sendMediaMessage,
  sendReaction,
  sendTemplateMessage,
  sendTextMessage,
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
