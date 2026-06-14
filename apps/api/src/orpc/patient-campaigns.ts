import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  createPatientCampaignInputSchema,
  deleteRecipientInputSchema,
  listCampaignRecipientsInputSchema,
  listPatientCampaignsInputSchema,
  listRecipientsByPatientInputSchema,
  patientCampaignIdInputSchema,
  patientCampaignRecipientResponseSchema,
  patientCampaignRecipientsResponseSchema,
  patientCampaignResponseSchema,
  patientCampaignStatusResponseSchema,
  patientCampaignsListResponseSchema,
  patientRecipientsByPatientResponseSchema,
  updatePatientCampaignInputSchema,
  updateRecipientStatusInputSchema,
  upsertCampaignRecipientInputSchema,
} from "@finanzas/orpc-contracts/patient-campaigns";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createPatientCampaign,
  deletePatientCampaign,
  deleteRecipient,
  getPatientCampaign,
  listCampaignRecipients,
  listPatientCampaigns,
  listRecipientsByPatient,
  updatePatientCampaign,
  updateRecipientStatus,
  upsertCampaignRecipient,
} from "../services/patient-campaigns.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type PatientCampaignsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PatientCampaignsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const readCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "read", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const createCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "create", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const updateCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "update", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const deleteCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "delete", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const patientCampaignsRouterBase = {
  listCampaigns: readCampaigns
    .route({ method: "GET", path: "/", tags: ["Patient Campaigns"] })
    .input(listPatientCampaignsInputSchema)
    .output(patientCampaignsListResponseSchema)
    .handler(({ input }) => listPatientCampaigns(input)),

  getCampaign: readCampaigns
    .route({ method: "GET", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(({ input }) => getPatientCampaign(input)),

  createCampaign: createCampaigns
    .route({ method: "POST", path: "/", tags: ["Patient Campaigns"] })
    .input(createPatientCampaignInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(({ context, input }) => createPatientCampaign(input, context.user.id)),

  updateCampaign: updateCampaigns
    .route({ method: "PUT", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(updatePatientCampaignInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(({ input }) => updatePatientCampaign(input)),

  deleteCampaign: deleteCampaigns
    .route({ method: "DELETE", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignStatusResponseSchema)
    .handler(async ({ input }) => {
      await deletePatientCampaign(input);
      return { status: "ok" as const };
    }),

  listRecipients: readCampaigns
    .route({ method: "GET", path: "/{campaignId}/recipients", tags: ["Patient Campaigns"] })
    .input(listCampaignRecipientsInputSchema)
    .output(patientCampaignRecipientsResponseSchema)
    .handler(({ input }) => listCampaignRecipients(input)),

  upsertRecipient: updateCampaigns
    .route({ method: "POST", path: "/recipients", tags: ["Patient Campaigns"] })
    .input(upsertCampaignRecipientInputSchema)
    .output(patientCampaignRecipientResponseSchema)
    .handler(({ context, input }) => upsertCampaignRecipient(input, context.user.id)),

  updateRecipientStatus: updateCampaigns
    .route({ method: "PUT", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(updateRecipientStatusInputSchema)
    .output(patientCampaignRecipientResponseSchema)
    .handler(({ context, input }) => updateRecipientStatus(input, context.user.id)),

  deleteRecipient: updateCampaigns
    .route({ method: "DELETE", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(deleteRecipientInputSchema)
    .output(patientCampaignStatusResponseSchema)
    .handler(async ({ input }) => {
      await deleteRecipient(input);
      return { status: "ok" as const };
    }),

  listByPatient: readCampaigns
    .route({ method: "GET", path: "/by-patient", tags: ["Patient Campaigns"] })
    .input(listRecipientsByPatientInputSchema)
    .output(patientRecipientsByPatientResponseSchema)
    .handler(({ input }) => listRecipientsByPatient(input)),
};

export const patientCampaignsORPCRouter = base
  .prefix("/api/orpc/patient-campaigns")
  .router(patientCampaignsRouterBase);

export const patientCampaignsORPCHandler = new SuperJSONRPCHandler(patientCampaignsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.patient-campaigns",
      });
    }),
  ],
});

export const patientCampaignsOpenAPIHandler = new OpenAPIHandler(patientCampaignsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Patient Campaigns oRPC",
          description: "Contratos oRPC/OpenAPI para campañas de marketing a pacientes.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.patient-campaigns",
      });
    }),
  ],
});

export type PatientCampaignsORPCRouter = typeof patientCampaignsORPCRouter;
