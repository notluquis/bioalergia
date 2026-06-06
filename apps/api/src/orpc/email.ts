import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  broadcastRecipientsCountResponseSchema,
  patientOptInQuerySchema,
  patientOptInResponseSchema,
  sendBroadcastInputSchema,
  sendBroadcastResponseSchema,
  sendTestEmailInputSchema,
  sendTestEmailResponseSchema,
  setPatientOptInInputSchema,
} from "@finanzas/orpc-contracts/email";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  countBroadcastRecipients,
  getPatientEmailOptIn,
  sendPatientBroadcast,
  sendTransactionalTest,
  setPatientEmailOptIn,
} from "../services/email/broadcast-service.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type EmailORPCContext = {
  hono: HonoContext;
};

const base = os.$context<EmailORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

// Marketing-to-patients is governed by the same authz resource as the
// existing patient-campaigns surface.
const readEmail = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "read", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const sendEmailPerm = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "create", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const emailRouterBase = {
  sendTest: sendEmailPerm
    .route({ method: "POST", path: "/test", tags: ["Email"] })
    .input(sendTestEmailInputSchema)
    .output(sendTestEmailResponseSchema)
    .handler(async ({ input }) => {
      const result = await sendTransactionalTest(input);
      return { result };
    }),

  recipientsCount: readEmail
    .route({ method: "GET", path: "/broadcast/recipients", tags: ["Email"] })
    .output(broadcastRecipientsCountResponseSchema)
    .handler(async () => {
      const count = await countBroadcastRecipients();
      return { count };
    }),

  sendBroadcast: sendEmailPerm
    .route({ method: "POST", path: "/broadcast", tags: ["Email"] })
    .input(sendBroadcastInputSchema)
    .output(sendBroadcastResponseSchema)
    .handler(async ({ input }) => {
      return sendPatientBroadcast(input);
    }),

  getPatientOptIn: readEmail
    .route({ method: "GET", path: "/opt-in", tags: ["Email"] })
    .input(patientOptInQuerySchema)
    .output(patientOptInResponseSchema)
    .handler(async ({ input }) => {
      return getPatientEmailOptIn(input.personId);
    }),

  setPatientOptIn: sendEmailPerm
    .route({ method: "POST", path: "/opt-in", tags: ["Email"] })
    .input(setPatientOptInInputSchema)
    .output(patientOptInResponseSchema)
    .handler(async ({ input }) => {
      return setPatientEmailOptIn(input.personId, input.optIn);
    }),
};

export const emailORPCRouter = base.prefix("/api/orpc/email").router(emailRouterBase);

export const emailORPCHandler = new SuperJSONRPCHandler(emailORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.email" });
    }),
  ],
});

export const emailOpenAPIHandler = new OpenAPIHandler(emailORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Email oRPC",
          description: "Envío transaccional + broadcast a pacientes (opt-in).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.email" });
    }),
  ],
});

export type EmailORPCRouter = typeof emailORPCRouter;
