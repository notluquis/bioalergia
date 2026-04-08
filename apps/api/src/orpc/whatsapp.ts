import { db } from "@finanzas/db";
import {
  listWhatsappContactStatesInputSchema,
  listWhatsappContactStatesResponseSchema,
  listWhatsappNotificationsInputSchema as contractListInput,
  listWhatsappNotificationsResponseSchema as contractListResponse,
  whatsappConnectionStatusSchema,
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
  getWhatsappConsentSummary,
  listWhatsappConversationStates,
  setWhatsappContactConsent,
} from "../lib/whatsapp/conversation-state";
import {
  disconnectBaileys,
  getConnectionStatus,
  initBaileysSocket,
  markAsRead,
  sendMedia,
  sendReaction,
  sendText,
  sendTyping,
} from "../lib/whatsapp/baileys-socket";
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
            const result = await sendText(input.phone, input.body);
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
