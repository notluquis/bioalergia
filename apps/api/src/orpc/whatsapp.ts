import { db } from "@finanzas/db";
import {
  listWhatsappContactStatesInputSchema,
  listWhatsappContactStatesResponseSchema,
  listWhatsappNotificationsInputSchema as contractListInput,
  listWhatsappNotificationsResponseSchema as contractListResponse,
  listWhatsappTemplatesResponseSchema,
  whatsappAccountInfoSchema,
  whatsappContactStateSchema,
  whatsappCustomMessageInputSchema,
  whatsappNotificationStatusSchema,
  whatsappOverviewSchema,
  whatsappSetContactConsentInputSchema,
  whatsappStatsSchema,
  whatsappStatusResponseSchema,
  whatsappTestSendInputSchema,
} from "@finanzas/orpc-contracts/whatsapp";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import {
  countActiveCustomerServiceWindows,
  getWhatsappConsentSummary,
  listWhatsappConversationStates,
  resolveWhatsappDispatchDecision,
  setWhatsappContactConsent,
} from "../lib/whatsapp/conversation-state";
import {
  getAccountInfo,
  getFirstApprovedTemplate,
  listMessageTemplates,
  markMessageAsRead,
  normalizePhone,
  sendContextualTextReply,
  sendInteractiveCtaUrlMessage,
  sendInteractiveListMessage,
  sendInteractiveReplyButtonsMessage,
  sendMediaMessage,
  sendReactionMessage,
  sendTemplateMessage,
  sendTextMessage,
  sendTypingIndicator,
  type WhatsappSendResult,
} from "../lib/whatsapp/whatsapp-client";
import { runWhatsappPoll } from "../lib/whatsapp/whatsapp-scheduler";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type WhatsappORPCContext = {
  hono: HonoContext;
};

const base = os.$context<WhatsappORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const integrationRead = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Integration");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const integrationCreate = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Integration");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

function formatSendResponse(message: string, result: WhatsappSendResult) {
  return {
    contacts: result.contacts,
    message,
    messageId: result.messageId,
    messageStatus: result.messageStatus,
    status: "ok" as const,
  };
}

function getEnvTemplate() {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() ?? null;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() ?? null;

  if (!templateName || !languageCode) {
    return null;
  }

  return { languageCode, templateName };
}

async function resolveTemplate(): Promise<{
  languageCode: string;
  templateName: string;
} | null> {
  const envTemplate = getEnvTemplate();
  if (envTemplate) return envTemplate;
  return await getFirstApprovedTemplate();
}

async function ensureServiceWindow(phone: string) {
  const dispatch = await resolveWhatsappDispatchDecision(phone);
  if (!dispatch.hasActiveWindow) {
    throw new Error(
      "La ventana de atención de 24 horas no está activa para ese número. Necesitas un inbound reciente o una llamada entrante.",
    );
  }

  return dispatch;
}

const whatsappORPCRouterBase = {
  listNotifications: integrationRead
    .route({
      method: "GET",
      path: "/notifications",
      summary: "List WhatsApp notifications",
      tags: ["WhatsApp"],
    })
    .input(contractListInput)
    .output(contractListResponse)
    .handler(async ({ input }) => {
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      let query = db.$qb
        .selectFrom("WhatsappNotification")
        .selectAll()
        .orderBy("createdAt", "desc");

      let countQuery = db.$qb
        .selectFrom("WhatsappNotification")
        .select(db.$qb.fn.count<string>("id").as("count"));

      if (input.status) {
        query = query.where(
          "status",
          "=",
          input.status as "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED",
        );
        countQuery = countQuery.where(
          "status",
          "=",
          input.status as "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED",
        );
      }

      const [rows, countRow] = await Promise.all([
        query.limit(limit).offset(offset).execute(),
        countQuery.executeTakeFirst(),
      ]);

      return {
        notifications: rows.map((row) => ({
          appointmentDate: row.appointmentDate ?? null,
          appointmentDoctor: row.appointmentDoctor ?? null,
          appointmentService: row.appointmentService ?? null,
          createdAt: row.createdAt,
          deliveredAt: row.deliveredAt ?? null,
          emailMessageId: row.emailMessageId,
          errorMessage: row.errorMessage ?? null,
          id: row.id,
          messagePacingStatus: row.messagePacingStatus ?? null,
          patientEmail: row.patientEmail ?? null,
          patientName: row.patientName,
          patientPhone: row.patientPhone,
          playedAt: row.playedAt ?? null,
          readAt: row.readAt ?? null,
          recipientWaId: row.recipientWaId ?? null,
          sentAt: row.sentAt ?? null,
          status: whatsappNotificationStatusSchema.parse(row.status),
          updatedAt: row.updatedAt,
          waMessageId: row.waMessageId ?? null,
        })),
        total: parseInt(countRow?.count ?? "0", 10),
      };
    }),

  getStats: integrationRead
    .route({
      method: "GET",
      path: "/stats",
      summary: "Get WhatsApp notification stats",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatsSchema)
    .handler(async () => {
      const rows = await db.$qb
        .selectFrom("WhatsappNotification")
        .select(["status", db.$qb.fn.count<string>("id").as("count")])
        .groupBy("status")
        .execute();

      const counts: Record<string, number> = {};
      let total = 0;

      for (const row of rows) {
        const count = parseInt(row.count, 10);
        counts[String(row.status)] = count;
        total += count;
      }

      return {
        delivered: counts.DELIVERED ?? 0,
        failed: counts.FAILED ?? 0,
        pending: counts.PENDING ?? 0,
        played: counts.PLAYED ?? 0,
        read: counts.READ ?? 0,
        sent: counts.SENT ?? 0,
        total,
      };
    }),

  getOverview: integrationRead
    .route({
      method: "GET",
      path: "/overview",
      summary: "Get WhatsApp integration overview",
      tags: ["WhatsApp"],
    })
    .output(whatsappOverviewSchema)
    .handler(async () => {
      const accessTokenConfigured = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
      const phoneNumberIdConfigured = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
      const webhookVerifyTokenConfigured = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
      const appSecretConfigured = Boolean(process.env.WHATSAPP_APP_SECRET);
      const imapHostConfigured = Boolean(process.env.DOCTORALIA_IMAP_HOST);
      const imapUserConfigured = Boolean(process.env.DOCTORALIA_IMAP_USER);
      const imapPassConfigured = Boolean(process.env.DOCTORALIA_IMAP_PASS);
      const automaticNotificationsEnabled = process.env.ENABLE_WHATSAPP_NOTIFICATIONS === "true";
      const outboundReady = accessTokenConfigured && phoneNumberIdConfigured;
      const webhookReady = webhookVerifyTokenConfigured && appSecretConfigured;
      const imapReady = imapHostConfigured && imapUserConfigured && imapPassConfigured;
      const automaticFlowReady = automaticNotificationsEnabled && outboundReady && imapReady;

      let activeCustomerServiceWindows = 0;
      let consentSummary = { optedIn: 0, optedOut: 0, total: 0, unknown: 0 };
      let resolvedTemplate: { languageCode: string; templateName: string } | null = null;

      try {
        const [windows, consent, template] = await Promise.all([
          countActiveCustomerServiceWindows(),
          getWhatsappConsentSummary(),
          outboundReady ? resolveTemplate() : Promise.resolve(null),
        ]);
        activeCustomerServiceWindows = windows;
        consentSummary = consent;
        resolvedTemplate = template;
      } catch (err) {
        logError("whatsapp.overview.summary_error", err, {});
      }

      return {
        accessTokenConfigured,
        activeCustomerServiceWindows,
        appSecretConfigured,
        autoOptInOnInbound: process.env.WHATSAPP_AUTO_OPT_IN_ON_INBOUND !== "false",
        automaticFlowReady,
        automaticNotificationsEnabled,
        freeformMessageConfigured: Boolean(process.env.WHATSAPP_FREEFORM_MESSAGE?.trim()),
        graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0",
        hybridFlowReady: automaticFlowReady && webhookReady,
        imapHostConfigured,
        imapMailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
        imapPassConfigured,
        imapReady,
        imapUserConfigured,
        optInRequired: process.env.WHATSAPP_REQUIRE_OPT_IN !== "false",
        optedInContacts: consentSummary.optedIn,
        optedOutContacts: consentSummary.optedOut,
        outboundReady,
        phoneNumberIdConfigured,
        pollCron: process.env.WHATSAPP_POLL_CRON ?? "*/2 * * * *",
        senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia.com",
        supportsCalls: true,
        supportsContextualReplies: true,
        supportsInteractive: true,
        supportsMarkAsRead: true,
        supportsMedia: true,
        supportsReactions: true,
        supportsTypingIndicator: true,
        templateFallbackReady: resolvedTemplate !== null,
        templateLanguage: resolvedTemplate?.languageCode ?? null,
        templateName: resolvedTemplate?.templateName ?? null,
        unknownConsentContacts: consentSummary.unknown,
        webhookReady,
        webhookVerifyTokenConfigured,
      };
    }),

  listContacts: integrationRead
    .route({
      method: "GET",
      path: "/contacts",
      summary: "List WhatsApp contact states",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappContactStatesInputSchema)
    .output(listWhatsappContactStatesResponseSchema)
    .handler(async ({ input }) => {
      const result = await listWhatsappConversationStates({
        limit: input.limit,
        offset: input.offset,
        search: input.search,
      });

      return {
        contacts: result.records.map((record) => whatsappContactStateSchema.parse(record)),
        total: result.total,
      };
    }),

  setContactConsent: integrationCreate
    .route({
      method: "POST",
      path: "/contacts/consent",
      summary: "Set WhatsApp contact consent",
      tags: ["WhatsApp"],
    })
    .input(whatsappSetContactConsentInputSchema)
    .output(whatsappContactStateSchema)
    .handler(async ({ input }) => {
      const state = await setWhatsappContactConsent({
        phone: input.phone,
        source: input.source ?? "manual_settings",
        status: input.status,
      });

      if (!state) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "No se pudo guardar el consentimiento de WhatsApp",
        });
      }

      return whatsappContactStateSchema.parse(state);
    }),

  testSend: integrationCreate
    .route({
      method: "POST",
      path: "/test-send",
      summary: "Send a test WhatsApp message",
      tags: ["WhatsApp"],
    })
    .input(whatsappTestSendInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      const normalizedPhone = normalizePhone(input.phone);

      try {
        const dispatch = await resolveWhatsappDispatchDecision(normalizedPhone);

        if (dispatch.reason === "missing_opt_in") {
          return {
            message:
              "El número no tiene consentimiento registrado. Marca opt-in o espera un inbound/call antes de enviar.",
            status: "error" as const,
          };
        }

        const result =
          dispatch.mode === "text"
            ? await sendTextMessage(
                normalizedPhone,
                "Hola, este es un mensaje de prueba de Bioalergia por WhatsApp.",
              )
            : await (async () => {
                const template = await resolveTemplate();
                if (!template) {
                  throw new Error(
                    "No hay ningún template aprobado disponible. Crea uno en Meta Business Manager.",
                  );
                }

                return sendTemplateMessage(
                  normalizedPhone,
                  template.templateName,
                  template.languageCode,
                );
              })();

        return {
          ...formatSendResponse(
            dispatch.mode === "text"
              ? `Mensaje enviado en modo texto. ID: ${result.messageId}`
              : `Mensaje enviado en modo template. ID: ${result.messageId}`,
            result,
          ),
          mode: dispatch.mode,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { message, status: "error" as const };
      }
    }),

  sendCustomMessage: integrationCreate
    .route({
      method: "POST",
      path: "/send-custom",
      summary: "Send advanced WhatsApp messages",
      tags: ["WhatsApp"],
    })
    .input(whatsappCustomMessageInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      try {
        switch (input.kind) {
          case "contextual_text": {
            await ensureServiceWindow(input.phone);
            const result = await sendContextualTextReply(
              input.phone,
              input.body,
              input.quotedMessageId,
              { previewUrl: input.previewUrl },
            );
            return formatSendResponse("Respuesta contextual enviada.", result);
          }
          case "cta_url": {
            await ensureServiceWindow(input.phone);
            const result = await sendInteractiveCtaUrlMessage({
              body: input.body,
              displayText: input.displayText,
              footer: input.footer,
              headerText: input.headerText,
              phone: input.phone,
              url: input.url,
            });
            return formatSendResponse("Mensaje interactivo CTA enviado.", result);
          }
          case "reaction": {
            await ensureServiceWindow(input.phone);
            const result = await sendReactionMessage({
              emoji: input.emoji,
              messageId: input.messageId,
              phone: input.phone,
            });
            return formatSendResponse("Reacción enviada.", result);
          }
          case "mark_read": {
            const result = await markMessageAsRead(input.messageId);
            return formatSendResponse("Mensaje marcado como leído.", result);
          }
          case "list": {
            await ensureServiceWindow(input.phone);
            const result = await sendInteractiveListMessage({
              body: input.body,
              buttonText: input.buttonText,
              footer: input.footer,
              headerText: input.headerText,
              phone: input.phone,
              sections: input.sections,
            });
            return formatSendResponse("Lista interactiva enviada.", result);
          }
          case "image":
          case "audio":
          case "document":
          case "video":
          case "sticker": {
            await ensureServiceWindow(input.phone);
            const result = await sendMediaMessage({
              media: {
                caption: input.caption,
                filename: input.filename,
                id: input.mediaId,
                link: input.link,
              },
              mediaType: input.kind,
              phone: input.phone,
              replyToMessageId: input.replyToMessageId,
            });
            return formatSendResponse(`Mensaje ${input.kind} enviado.`, result);
          }
          case "reply_buttons": {
            await ensureServiceWindow(input.phone);
            const result = await sendInteractiveReplyButtonsMessage({
              body: input.body,
              buttons: input.buttons,
              footer: input.footer,
              headerText: input.headerText,
              phone: input.phone,
            });
            return formatSendResponse("Botones interactivos enviados.", result);
          }
          case "typing": {
            const result = await sendTypingIndicator(input.messageId);
            return formatSendResponse("Typing indicator enviado.", result);
          }
          default: {
            const neverInput: never = input;
            return {
              message: `Tipo de mensaje no soportado: ${String(neverInput)}`,
              status: "error" as const,
            };
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { message, status: "error" as const };
      }
    }),

  listTemplates: integrationRead
    .route({
      method: "GET",
      path: "/templates",
      summary: "List WhatsApp message templates from Meta API",
      tags: ["WhatsApp"],
    })
    .output(listWhatsappTemplatesResponseSchema)
    .handler(async () => {
      const templates = await listMessageTemplates();
      return { templates };
    }),

  getAccountInfo: integrationRead
    .route({
      method: "GET",
      path: "/account-info",
      summary: "Get WhatsApp account info from Meta API",
      tags: ["WhatsApp"],
    })
    .output(whatsappAccountInfoSchema)
    .handler(async () => {
      return await getAccountInfo();
    }),

  triggerPoll: integrationCreate
    .route({
      method: "POST",
      path: "/trigger-poll",
      summary: "Manually trigger IMAP poll",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema)
    .handler(async () => {
      const result = await runWhatsappPoll({ trigger: "manual" });
      return {
        message: `Poll ejecutado. Revisados: ${result.checked}, enviados: ${result.sent}, fallidos: ${result.failed}, omitidos: ${result.skipped}`,
        status: "ok" as const,
      };
    }),
};

export const whatsappORPCRouter = base
  .prefix("/api/orpc/whatsapp")
  .router(whatsappORPCRouterBase);

export const whatsappORPCHandler = new SuperJSONRPCHandler(whatsappORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("whatsapp.orpc", error, { module: "api", operation: "orpc.whatsapp" });
    }),
  ],
});

export const whatsappOpenAPIHandler = new OpenAPIHandler(whatsappORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("whatsapp.openapi", error, { module: "api", operation: "openapi.whatsapp" });
    }),
  ],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          description: "Contratos oRPC/OpenAPI para WhatsApp Cloud API y el flujo Doctoralia.",
          title: "Bioalergia WhatsApp oRPC",
          version: "1.0.0",
        },
      },
    }),
  ],
});

export type WhatsappORPCRouter = typeof whatsappORPCRouter;
