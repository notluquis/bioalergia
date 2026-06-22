import {
  cancelReminderInputSchema,
  listRemindersInputSchema,
  reminderBatchResponseSchema,
  reminderListResponseSchema,
  reminderResponseSchema,
  scheduleReminderInputSchema,
  scheduleVisitRemindersInputSchema,
} from "@finanzas/orpc-contracts/adherence";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { enqueueJob } from "../queue/runner.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  cancelReminder,
  listReminders,
  reminderJobKey,
  scheduleReminder,
  scheduleVisitReminders,
  serializeReminder,
} from "../services/adherence-reminders.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

/** Encola el envío del recordatorio en graphile-worker para su `runAt`. */
async function enqueueReminder(r: { id: number; runAt: Date }): Promise<void> {
  await enqueueJob(
    "adherence_reminder_send",
    { reminderScheduleId: r.id },
    {
      runAt: r.runAt,
      jobKey: reminderJobKey(r.id),
      jobKeyMode: "replace",
      queueName: reminderJobKey(r.id),
    }
  );
}

configureSuperjson();

type AdherenceORPCContext = { hono: HonoContext };
const base = os.$context<AdherenceORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Reusa el subject `ImmunotherapyAdministration`: el mismo staff que gestiona la
// inmunoterapia gestiona los recordatorios de adherencia.
function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "ImmunotherapyAdministration");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const reader = requirePermission("read");
const writer = requirePermission("update");

const adherenceRouterBase = {
  scheduleVisitReminders: writer
    .route({ method: "POST", path: "/visit-reminders", tags: ["Adherence"] })
    .input(scheduleVisitRemindersInputSchema)
    .output(reminderBatchResponseSchema)
    .handler(async ({ input }) => {
      const reminders = await scheduleVisitReminders({
        patientId: input.patientId,
        visitAt: input.visitAt,
        channel: input.channel,
      });
      for (const r of reminders) await enqueueReminder(r);
      return { reminders: reminders.map((r) => serializeReminder(r)) };
    }),

  scheduleReminder: writer
    .route({ method: "POST", path: "/reminders", tags: ["Adherence"] })
    .input(scheduleReminderInputSchema)
    .output(reminderResponseSchema)
    .handler(async ({ input }) => {
      const reminder = await scheduleReminder({
        patientId: input.patientId,
        channel: input.channel,
        subjectType: input.subjectType,
        title: input.title,
        body: input.body,
        runAt: input.runAt,
      });
      await enqueueReminder(reminder);
      return { reminder: serializeReminder(reminder) };
    }),

  listReminders: reader
    .route({ method: "POST", path: "/reminders/list", tags: ["Adherence"] })
    .input(listRemindersInputSchema)
    .output(reminderListResponseSchema)
    .handler(async ({ input }) => {
      const reminders = await listReminders(input.patientId);
      return { reminders: reminders.map((r) => serializeReminder(r)) };
    }),

  cancelReminder: writer
    .route({ method: "POST", path: "/reminders/{id}/cancel", tags: ["Adherence"] })
    .input(cancelReminderInputSchema)
    .output(reminderResponseSchema)
    .handler(async ({ input }) => {
      const reminder = await cancelReminder(input.id);
      return { reminder: serializeReminder(reminder) };
    }),
};

export const adherenceORPCRouter = base.prefix("/api/orpc/adherence").router(adherenceRouterBase);

export const adherenceORPCHandler = new SuperJSONRPCHandler(adherenceORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.adherence" });
    }),
  ],
});

export const adherenceOpenAPIHandler = new OpenAPIHandler(adherenceORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Adherencia oRPC",
          description: "Recordatorios de adherencia SCIT/SLIT (consent-gated).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.adherence" });
    }),
  ],
});

export type AdherenceORPCRouter = typeof adherenceORPCRouter;
