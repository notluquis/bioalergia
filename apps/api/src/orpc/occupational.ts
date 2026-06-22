import {
  createOccupationalLeadInputSchema,
  createOccupationalLeadResponseSchema,
  occupationalLeadListResponseSchema,
  occupationalLeadResponseSchema,
  updateOccupationalLeadStatusInputSchema,
} from "@finanzas/orpc-contracts/occupational";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createOccupationalLead,
  listOccupationalLeads,
  serializeOccupationalLead,
  updateOccupationalLeadStatus,
} from "../services/occupational.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type OccupationalORPCContext = { hono: HonoContext };
const base = os.$context<OccupationalORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Reusa el subject de permisos `ReactivoLead`: el mismo staff comercial gestiona
// ambos tipos de lead B2B, evitando seedear un subject nuevo en prod.
function requirePermission(action: string, subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readLeads = requirePermission("read", "ReactivoLead");
const writeLeads = requirePermission("update", "ReactivoLead");

const occupationalRouterBase = {
  // Público (sin auth): captación de leads desde /salud-ocupacional.
  createLead: base
    .route({ method: "POST", path: "/leads", tags: ["Occupational"] })
    .input(createOccupationalLeadInputSchema)
    .output(createOccupationalLeadResponseSchema)
    .handler(async ({ input }) => createOccupationalLead(input)),

  // Staff
  listLeads: readLeads
    .route({ method: "GET", path: "/leads", tags: ["Occupational"] })
    .output(occupationalLeadListResponseSchema)
    .handler(async () => {
      const leads = await listOccupationalLeads();
      return { leads: leads.map((l) => serializeOccupationalLead(l)) };
    }),

  updateLeadStatus: writeLeads
    .route({ method: "POST", path: "/leads/{id}/status", tags: ["Occupational"] })
    .input(updateOccupationalLeadStatusInputSchema)
    .output(occupationalLeadResponseSchema)
    .handler(async ({ input }) => {
      const lead = await updateOccupationalLeadStatus(input.id, input.status);
      return { lead: serializeOccupationalLead(lead) };
    }),
};

export const occupationalORPCRouter = base
  .prefix("/api/orpc/occupational")
  .router(occupationalRouterBase);

export const occupationalORPCHandler = new SuperJSONRPCHandler(occupationalORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.occupational" });
    }),
  ],
});

export const occupationalOpenAPIHandler = new OpenAPIHandler(occupationalORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Salud Ocupacional oRPC",
          description: "Captación de leads B2B de testeo ocupacional.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.occupational" });
    }),
  ],
});

export type OccupationalORPCRouter = typeof occupationalORPCRouter;
