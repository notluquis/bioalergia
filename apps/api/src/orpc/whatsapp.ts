import { db } from "@finanzas/db";
import {
  listWhatsappNotificationsInputSchema as contractListInput,
  listWhatsappNotificationsResponseSchema as contractListResponse,
  whatsappNotificationStatusSchema,
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
import { normalizePhone, sendTemplateMessage } from "../lib/whatsapp/whatsapp-client";
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
          input.status as "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ",
        );
        countQuery = countQuery.where(
          "status",
          "=",
          input.status as "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ",
        );
      }

      const [rows, countRow] = await Promise.all([
        query.limit(limit).offset(offset).execute(),
        countQuery.executeTakeFirst(),
      ]);

      const total = parseInt(countRow?.count ?? "0", 10);

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
          patientEmail: row.patientEmail ?? null,
          patientName: row.patientName,
          patientPhone: row.patientPhone,
          readAt: row.readAt ?? null,
          sentAt: row.sentAt ?? null,
          status: whatsappNotificationStatusSchema.parse(row.status),
          updatedAt: row.updatedAt,
          waMessageId: row.waMessageId ?? null,
        })),
        total,
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
        const n = parseInt(row.count, 10);
        const statusKey = String(row.status);
        counts[statusKey] = n;
        total += n;
      }

      return {
        delivered: counts.DELIVERED ?? 0,
        failed: counts.FAILED ?? 0,
        pending: counts.PENDING ?? 0,
        read: counts.READ ?? 0,
        sent: counts.SENT ?? 0,
        total,
      };
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
      const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "hello_world";
      const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";

      try {
        const result = await sendTemplateMessage(
          normalizePhone(input.phone),
          templateName,
          languageCode,
        );
        return {
          message: `Mensaje enviado. ID: ${result.messageId}`,
          status: "ok" as const,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { message, status: "error" as const };
      }
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
      if (!result) {
        return { message: "Poll ya en ejecución o IMAP no configurado", status: "ok" as const };
      }
      return {
        message: `Poll completado: ${result.sent} enviados, ${result.failed} fallidos, ${result.skipped} omitidos`,
        status: "ok" as const,
      };
    }),
};

export const whatsappORPCRouter = base
  .prefix("/api/orpc/whatsapp")
  .tag("WhatsApp")
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
      docsTitle: "Bioalergia WhatsApp API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: { title: "Bioalergia WhatsApp API", version: "1.0.0" },
      },
    }),
  ],
});

export type WhatsappORPCRouter = typeof whatsappORPCRouter;
