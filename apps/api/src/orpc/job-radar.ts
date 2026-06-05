import {
  jobRadarListInputSchema,
  jobRadarSettingsSchema,
  jobRadarSettingsUpdateSchema,
  jobRadarSyncResultSchema,
  jobRadarUpdateInputSchema,
  jobPostingSchema,
} from "@finanzas/orpc-contracts/job-radar";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.ts";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  getJobRadarSettings,
  listJobPostings,
  syncJobRadar,
  updateJobApplication,
  updateJobRadarSettings,
} from "../services/job-radar.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type JobRadarORPCContext = { hono: HonoContext };

const base = os.$context<JobRadarORPCContext>();

// Job Radar es búsqueda de empleo personal del dueño. Cualquier usuario activo
// con sesión puede verlo/gestionarlo (no es data sensible de clínica).
async function requireUser(c: HonoContext) {
  const user = await getSessionUser(c);
  if (!user) throw new DomainError("UNAUTHORIZED", "Sesión requerida");
}

const jobRadarORPCRouterBase = {
  list: base
    .route({ method: "GET", path: "/postings", summary: "List job postings", tags: ["Job Radar"] })
    .input(jobRadarListInputSchema)
    .output(z.array(jobPostingSchema))
    .handler(async ({ context, input }) => {
      await requireUser(context.hono);
      const rows = await listJobPostings(input ?? {});
      return rows as unknown as z.output<typeof jobPostingSchema>[];
    }),

  update: base
    .route({
      method: "PATCH",
      path: "/postings/{id}",
      summary: "Update application status / notes",
      tags: ["Job Radar"],
    })
    .input(jobRadarUpdateInputSchema)
    .output(jobPostingSchema)
    .handler(async ({ context, input }) => {
      await requireUser(context.hono);
      const row = await updateJobApplication(input);
      return row as unknown as z.output<typeof jobPostingSchema>;
    }),

  syncNow: base
    .route({ method: "POST", path: "/sync", summary: "Trigger a manual sync", tags: ["Job Radar"] })
    .output(jobRadarSyncResultSchema)
    .handler(async ({ context }) => {
      await requireUser(context.hono);
      return syncJobRadar({ triggerSource: "manual" });
    }),

  getSettings: base
    .route({ method: "GET", path: "/settings", summary: "Get config", tags: ["Job Radar"] })
    .output(jobRadarSettingsSchema)
    .handler(async ({ context }) => {
      await requireUser(context.hono);
      return getJobRadarSettings();
    }),

  updateSettings: base
    .route({ method: "PATCH", path: "/settings", summary: "Update config", tags: ["Job Radar"] })
    .input(jobRadarSettingsUpdateSchema)
    .output(jobRadarSettingsSchema)
    .handler(async ({ context, input }) => {
      await requireUser(context.hono);
      return updateJobRadarSettings(input);
    }),
};

export const jobRadarORPCRouter = base.prefix("/api/orpc/job-radar").router(jobRadarORPCRouterBase);

export const jobRadarORPCHandler = new SuperJSONRPCHandler(jobRadarORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.job-radar" });
    }),
  ],
});

export const jobRadarOpenAPIHandler = new OpenAPIHandler(jobRadarORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Job Radar oRPC",
          description: "Contratos oRPC/OpenAPI para el radar de ofertas de empleo.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.job-radar" });
    }),
  ],
});

export type JobRadarORPCRouter = typeof jobRadarORPCRouter;
