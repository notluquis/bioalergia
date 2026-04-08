import { db } from "@finanzas/db";
import {
  assignWhatsappBusinessChatLabelInputSchema,
  assignWhatsappBusinessMessageLabelInputSchema,
  deleteWhatsappBusinessQuickReplyInputSchema,
  listWhatsappContactStatesInputSchema,
  listWhatsappContactStatesResponseSchema,
  listWhatsappBusinessChatLabelsInputSchema,
  listWhatsappBusinessChatLabelsResponseSchema,
  listWhatsappBusinessLabelsInputSchema,
  listWhatsappBusinessLabelsResponseSchema,
  listWhatsappBusinessMessageLabelsInputSchema,
  listWhatsappBusinessMessageLabelsResponseSchema,
  listWhatsappBusinessQuickRepliesInputSchema,
  listWhatsappBusinessQuickRepliesResponseSchema,
  listWhatsappChatsInputSchema,
  listWhatsappChatsResponseSchema,
  listWhatsappMessageHistoryInputSchema,
  listWhatsappMessageHistoryResponseSchema,
  removeWhatsappBusinessCoverPhotoInputSchema,
  saveWhatsappBusinessLabelInputSchema,
  saveWhatsappBusinessQuickReplyInputSchema,
  updateWhatsappBusinessCoverPhotoInputSchema,
  updateWhatsappBusinessProfileInputSchema,
  whatsappBusinessCoverPhotoResultSchema,
  whatsappBusinessLabelSchema,
  whatsappBusinessProfileSchema,
  whatsappBusinessProfileStateSchema,
  whatsappBusinessQuickReplySchema,
  listWhatsappNotificationsInputSchema as contractListInput,
  listWhatsappNotificationsResponseSchema as contractListResponse,
  whatsappChatSchema,
  whatsappConnectionStatusSchema,
  whatsappConversationThreadInputSchema,
  whatsappContactStateSchema,
  whatsappCustomMessageInputSchema,
  whatsappMessageSchema,
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
  getWhatsappConsentSummary,
  listWhatsappConversationStates,
  setWhatsappContactConsent,
} from "../lib/whatsapp/conversation-state";
import {
  assignBusinessChatLabel,
  assignBusinessMessageLabel,
  createOrUpdateBusinessLabel,
  createOrUpdateBusinessQuickReply,
  deleteBusinessQuickReply,
  getBusinessProfile,
  deleteMessage,
  disconnectBaileys,
  editMessage,
  getConnectionStatus,
  initBaileysSocket,
  removeBusinessChatLabel,
  removeBusinessCoverPhoto,
  removeBusinessMessageLabel,
  markAsRead,
  sendContacts,
  sendContextualText,
  sendForward,
  sendLocation,
  sendMedia,
  sendReaction,
  sendText,
  setDisappearingMessages,
  sendTyping,
  updateBusinessCoverPhoto,
  updateBusinessProfile,
} from "../lib/whatsapp/baileys-socket";
import {
  listWhatsappBusinessChatLabels,
  listWhatsappBusinessLabels,
  listWhatsappBusinessMessageLabels,
  listWhatsappBusinessQuickReplies,
} from "../lib/whatsapp/business-store";
import {
  getWhatsappConversationThread,
  listWhatsappChats,
  listWhatsappMessageHistory,
} from "../lib/whatsapp/history-store";
import { normalizePhone, phoneToJid } from "../lib/whatsapp/jid";
import { runWhatsappPoll } from "../lib/whatsapp/whatsapp-scheduler";
import { getSetting, updateSetting } from "../services/settings";
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
      const automaticNotificationsEnabled = process.env.ENABLE_WHATSAPP_NOTIFICATIONS === "true";
      const {
        connectionState: connState,
        isReady,
        sessionReplaced,
      } = getConnectionStatus();
      const connected = connState === "open" && !sessionReplaced;
      const automaticFlowReady = automaticNotificationsEnabled && isReady && !sessionReplaced;

      let consentSummary = { optedIn: 0, optedOut: 0, total: 0, unknown: 0 };
      try {
        consentSummary = await getWhatsappConsentSummary();
      } catch (err) {
        logError("whatsapp.overview.summary_error", err, {});
      }

      return {
        autoOptInOnInbound: process.env.WHATSAPP_AUTO_OPT_IN_ON_INBOUND !== "false",
        automaticFlowReady,
        automaticNotificationsEnabled,
        connected,
        connectionState: connState,
        isReady,
        optInRequired: process.env.WHATSAPP_REQUIRE_OPT_IN !== "false",
        optedInContacts: consentSummary.optedIn,
        optedOutContacts: consentSummary.optedOut,
        sessionReplaced,
        unknownConsentContacts: consentSummary.unknown,
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
        const result = await sendText(
          normalizedPhone,
          "Hola, este es un mensaje de prueba de Bioalergia por WhatsApp.",
        );

        return {
          message: `Mensaje de prueba enviado. ID: ${result.messageId}`,
          messageId: result.messageId,
          status: "ok" as const,
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
            const result = await sendContextualText({
              body: input.body,
              phone: input.phone,
              quotedMessageId: input.quotedMessageId,
            });
            return {
              message: "Respuesta contextual enviada.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "reaction": {
            const result = await sendReaction(input.phone, input.messageId, input.emoji);
            return {
              message: "Reacción enviada.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "mark_read": {
            const jid = phoneToJid(input.phone);
            await markAsRead([{ id: input.messageId, remoteJid: jid }]);
            return {
              message: "Mensaje marcado como leído.",
              status: "ok" as const,
            };
          }
          case "image":
          case "audio":
          case "document":
          case "video":
          case "sticker": {
            const result = await sendMedia(input.phone, input.kind, {
              caption: input.caption,
              filename: input.filename,
              url: input.link,
            });
            return {
              message: `Mensaje ${input.kind} enviado.`,
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "typing": {
            await sendTyping(input.phone);
            return {
              message: "Typing indicator enviado.",
              status: "ok" as const,
            };
          }
          case "forward": {
            const result = await sendForward(input.phone, input.messageId);
            return {
              message: "Mensaje reenviado.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "delete": {
            const result = await deleteMessage(input.phone, input.messageId);
            return {
              message: "Mensaje eliminado para todos.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "edit": {
            const result = await editMessage(input.phone, input.messageId, input.body);
            return {
              message: "Mensaje editado.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "location": {
            const result = await sendLocation(input);
            return {
              message: "Ubicación enviada.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "contacts": {
            const result = await sendContacts(input);
            return {
              message: "Contacto enviado.",
              messageId: result.messageId,
              status: "ok" as const,
            };
          }
          case "disappearing_messages": {
            const result = await setDisappearingMessages({
              expiration: input.expiration,
              phone: input.phone,
            });
            return {
              message: "Modo de mensajes temporales actualizado.",
              messageId: result.messageId,
              status: "ok" as const,
            };
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

  listMessageHistory: integrationRead
    .route({
      method: "GET",
      path: "/messages",
      summary: "List persisted WhatsApp message history",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappMessageHistoryInputSchema)
    .output(listWhatsappMessageHistoryResponseSchema)
    .handler(async ({ input }) => {
      const result = await listWhatsappMessageHistory(input);
      return {
        records: result.records.map((record) => whatsappMessageSchema.parse(record)),
        total: result.total,
      };
    }),

  getConversationThread: integrationRead
    .route({
      method: "GET",
      path: "/messages/thread",
      summary: "Get a WhatsApp conversation thread",
      tags: ["WhatsApp"],
    })
    .input(whatsappConversationThreadInputSchema)
    .output(listWhatsappMessageHistoryResponseSchema.shape.records)
    .handler(async ({ input }) => {
      const records = await getWhatsappConversationThread(input);
      return records.map((record) => whatsappMessageSchema.parse(record));
    }),

  listChats: integrationRead
    .route({
      method: "GET",
      path: "/chats",
      summary: "List WhatsApp chats from history sync",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappChatsInputSchema)
    .output(listWhatsappChatsResponseSchema)
    .handler(async ({ input }) => {
      const result = await listWhatsappChats(input);
      return {
        records: result.records.map((record) => whatsappChatSchema.parse(record)),
        total: result.total,
      };
    }),

  getBusinessProfile: integrationRead
    .route({
      method: "GET",
      path: "/business/profile",
      summary: "Get WhatsApp business profile state",
      tags: ["WhatsApp"],
    })
    .output(whatsappBusinessProfileStateSchema)
    .handler(async () => {
      const savedCoverPhotoId = await getSetting("whatsapp.businessCoverPhotoId");
      return {
        profile: await getBusinessProfile(),
        savedCoverPhotoId: savedCoverPhotoId || null,
      };
    }),

  updateBusinessProfile: integrationCreate
    .route({
      method: "POST",
      path: "/business/profile",
      summary: "Update WhatsApp business profile",
      tags: ["WhatsApp"],
    })
    .input(updateWhatsappBusinessProfileInputSchema)
    .output(whatsappBusinessProfileSchema.nullable())
    .handler(async ({ input }) => {
      const result = await updateBusinessProfile({
        address: input.address,
        description: input.description,
        email: input.email,
        hours: input.hours,
        websites: input.websites,
      });
      return result ? whatsappBusinessProfileSchema.parse(result) : null;
    }),

  updateBusinessCoverPhoto: integrationCreate
    .route({
      method: "POST",
      path: "/business/cover-photo",
      summary: "Update WhatsApp business cover photo",
      tags: ["WhatsApp"],
    })
    .input(updateWhatsappBusinessCoverPhotoInputSchema)
    .output(whatsappBusinessCoverPhotoResultSchema)
    .handler(async ({ input }) => {
      const result = await updateBusinessCoverPhoto(input.link);
      await updateSetting("whatsapp.businessCoverPhotoId", result.coverPhotoId);
      return result;
    }),

  removeBusinessCoverPhoto: integrationCreate
    .route({
      method: "POST",
      path: "/business/cover-photo/remove",
      summary: "Remove WhatsApp business cover photo",
      tags: ["WhatsApp"],
    })
    .input(removeWhatsappBusinessCoverPhotoInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await removeBusinessCoverPhoto(input.coverPhotoId);
      await updateSetting("whatsapp.businessCoverPhotoId", "");
      return {
        message: "Cover photo eliminada.",
        status: "ok" as const,
      };
    }),

  listBusinessQuickReplies: integrationRead
    .route({
      method: "GET",
      path: "/business/quick-replies",
      summary: "List WhatsApp business quick replies",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessQuickRepliesInputSchema)
    .output(listWhatsappBusinessQuickRepliesResponseSchema)
    .handler(async ({ input }) => {
      const records = await listWhatsappBusinessQuickReplies({
        includeDeleted: input.includeDeleted,
      });
      return {
        records: records.map((record) => whatsappBusinessQuickReplySchema.parse(record)),
      };
    }),

  saveBusinessQuickReply: integrationCreate
    .route({
      method: "POST",
      path: "/business/quick-replies",
      summary: "Create or update a WhatsApp business quick reply",
      tags: ["WhatsApp"],
    })
    .input(saveWhatsappBusinessQuickReplyInputSchema)
    .output(whatsappBusinessQuickReplySchema)
    .handler(async ({ input }) => {
      return whatsappBusinessQuickReplySchema.parse(
        await createOrUpdateBusinessQuickReply(input),
      );
    }),

  deleteBusinessQuickReply: integrationCreate
    .route({
      method: "POST",
      path: "/business/quick-replies/delete",
      summary: "Delete a WhatsApp business quick reply",
      tags: ["WhatsApp"],
    })
    .input(deleteWhatsappBusinessQuickReplyInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await deleteBusinessQuickReply(input.timestamp);
      return {
        message: "Quick reply eliminada.",
        status: "ok" as const,
      };
    }),

  listBusinessLabels: integrationRead
    .route({
      method: "GET",
      path: "/business/labels",
      summary: "List WhatsApp business labels",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessLabelsInputSchema)
    .output(listWhatsappBusinessLabelsResponseSchema)
    .handler(async ({ input }) => {
      const records = await listWhatsappBusinessLabels({
        includeDeleted: input.includeDeleted,
      });
      return {
        records: records.map((record) => whatsappBusinessLabelSchema.parse(record)),
      };
    }),

  saveBusinessLabel: integrationCreate
    .route({
      method: "POST",
      path: "/business/labels",
      summary: "Create or update a WhatsApp business label",
      tags: ["WhatsApp"],
    })
    .input(saveWhatsappBusinessLabelInputSchema)
    .output(whatsappBusinessLabelSchema)
    .handler(async ({ input }) => {
      return whatsappBusinessLabelSchema.parse(await createOrUpdateBusinessLabel(input));
    }),

  listBusinessChatLabels: integrationRead
    .route({
      method: "GET",
      path: "/business/labels/chat",
      summary: "List chat label associations",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessChatLabelsInputSchema)
    .output(listWhatsappBusinessChatLabelsResponseSchema)
    .handler(async ({ input }) => {
      const records = await listWhatsappBusinessChatLabels(input);
      return { records };
    }),

  assignBusinessChatLabel: integrationCreate
    .route({
      method: "POST",
      path: "/business/labels/chat",
      summary: "Assign a business label to a chat",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessChatLabelInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await assignBusinessChatLabel(input);
      return {
        message: "Label asignado al chat.",
        status: "ok" as const,
      };
    }),

  removeBusinessChatLabel: integrationCreate
    .route({
      method: "POST",
      path: "/business/labels/chat/remove",
      summary: "Remove a business label from a chat",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessChatLabelInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await removeBusinessChatLabel(input);
      return {
        message: "Label removido del chat.",
        status: "ok" as const,
      };
    }),

  listBusinessMessageLabels: integrationRead
    .route({
      method: "GET",
      path: "/business/labels/message",
      summary: "List message label associations",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappBusinessMessageLabelsInputSchema)
    .output(listWhatsappBusinessMessageLabelsResponseSchema)
    .handler(async ({ input }) => {
      const records = await listWhatsappBusinessMessageLabels(input);
      return { records };
    }),

  assignBusinessMessageLabel: integrationCreate
    .route({
      method: "POST",
      path: "/business/labels/message",
      summary: "Assign a business label to a message",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessMessageLabelInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await assignBusinessMessageLabel(input);
      return {
        message: "Label asignado al mensaje.",
        status: "ok" as const,
      };
    }),

  removeBusinessMessageLabel: integrationCreate
    .route({
      method: "POST",
      path: "/business/labels/message/remove",
      summary: "Remove a business label from a message",
      tags: ["WhatsApp"],
    })
    .input(assignWhatsappBusinessMessageLabelInputSchema)
    .output(whatsappStatusResponseSchema)
    .handler(async ({ input }) => {
      await removeBusinessMessageLabel(input);
      return {
        message: "Label removido del mensaje.",
        status: "ok" as const,
      };
    }),

  getConnectionStatus: integrationRead
    .route({
      method: "GET",
      path: "/connection-status",
      summary: "Get Baileys WhatsApp connection status and QR code",
      tags: ["WhatsApp"],
    })
    .output(whatsappConnectionStatusSchema)
    .handler(async () => {
      const enabled = (await getSetting("whatsapp.enabled")) === "true";
      return { ...getConnectionStatus(), enabled };
    }),

  toggleConnection: integrationCreate
    .route({
      method: "POST",
      path: "/toggle-connection",
      summary: "Enable or disable Baileys WhatsApp connection",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema)
    .handler(async () => {
      const current = (await getSetting("whatsapp.enabled")) === "true";
      const next = !current;

      await updateSetting("whatsapp.enabled", String(next));

      if (next) {
        await initBaileysSocket();
        return { message: "WhatsApp activado. Esperando QR...", status: "ok" as const };
      }

      await disconnectBaileys();
      return { message: "WhatsApp desactivado.", status: "ok" as const };
    }),

  triggerPoll: integrationCreate
    .route({
      method: "POST",
      path: "/trigger-poll",
      summary: "Manually trigger the legacy Doctoralia IMAP poll",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema)
    .handler(async () => {
      const result = await runWhatsappPoll({ trigger: "manual" });
      if (!result) {
        return {
          message: "El poll IMAP falló. Revisa los logs del servidor para el detalle.",
          status: "error" as const,
        };
      }

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
          description: "Contratos oRPC/OpenAPI para WhatsApp Baileys y el flujo Doctoralia.",
          title: "Bioalergia WhatsApp oRPC",
          version: "2.0.0",
        },
      },
    }),
  ],
});

export type WhatsappORPCRouter = typeof whatsappORPCRouter;
