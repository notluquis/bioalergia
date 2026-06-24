import {
  createReactivoLeadInputSchema,
  createReactivoLeadResponseSchema,
  reactivoLeadListResponseSchema,
  reactivoLeadResponseSchema,
  reactivoVitrinaResponseSchema,
  updateReactivoLeadStatusInputSchema,
} from "@finanzas/orpc-contracts/reactivos";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createLead,
  listLeads,
  listVitrina,
  serializeLead,
  serializeVitrinaItem,
  updateLeadStatus,
} from "../services/reactivos.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ReactivosORPCContext = { hono: HonoContext };
const base = os.$context<ReactivosORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function requirePermission(action: string, subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readLeads = requirePermission("read", "ReactivoLead");
const writeLeads = requirePermission("update", "ReactivoLead");

const reactivosRouterBase = {
  // ── Público (sin auth) ─────────────────────────────────────────────
  listVitrina: base
    .route({ method: "GET", path: "/vitrina", tags: ["Reactivos"] })
    .output(reactivoVitrinaResponseSchema)
    .handler(async () => {
      const items = await listVitrina();
      return { items: items.map((p) => serializeVitrinaItem(p)) };
    }),

  createLead: base
    .route({ method: "POST", path: "/leads", tags: ["Reactivos"] })
    .input(createReactivoLeadInputSchema)
    .output(createReactivoLeadResponseSchema)
    .handler(async ({ input }) => createLead(input)),

  // ── Staff ──────────────────────────────────────────────────────────
  listLeads: readLeads
    .route({ method: "GET", path: "/leads", tags: ["Reactivos"] })
    .output(reactivoLeadListResponseSchema)
    .handler(async () => {
      const leads = await listLeads();
      return { leads: leads.map((l) => serializeLead(l)) };
    }),

  updateLeadStatus: writeLeads
    .route({ method: "POST", path: "/leads/{id}/status", tags: ["Reactivos"] })
    .input(updateReactivoLeadStatusInputSchema)
    .output(reactivoLeadResponseSchema)
    .handler(async ({ input }) => {
      const lead = await updateLeadStatus(input.id, input.status);
      return { lead: serializeLead(lead) };
    }),
};

export const reactivosORPCRouter = base.prefix("/api/orpc/reactivos").router(reactivosRouterBase);

export const reactivosORPCHandler = new SuperJSONRPCHandler(reactivosORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.reactivos" });
    }),
  ],
});

export const reactivosOpenAPIHandler = new OpenAPIHandler(reactivosORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Reactivos oRPC",
          description: "Vitrina pública de reactivos + captación de leads B2B.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.reactivos" });
    }),
  ],
});

export type ReactivosORPCRouter = typeof reactivosORPCRouter;
