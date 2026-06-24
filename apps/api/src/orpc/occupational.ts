import {
  attestRiohsInputSchema,
  createOccupationalLeadInputSchema,
  createOccupationalLeadResponseSchema,
  createOccupationalProgramInputSchema,
  createTestBatchInputSchema,
  listTestBatchesInputSchema,
  occupationalLeadListResponseSchema,
  occupationalLeadResponseSchema,
  occupationalProgramListResponseSchema,
  occupationalProgramResponseSchema,
  occupationalTestBatchListResponseSchema,
  occupationalTestBatchResponseSchema,
  setProgramStatusInputSchema,
  updateOccupationalLeadStatusInputSchema,
  updateOccupationalProgramInputSchema,
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
  attestRiohs,
  createOccupationalLead,
  createProgram,
  createTestBatch,
  listOccupationalLeads,
  listPrograms,
  listTestBatches,
  serializeBatch,
  serializeOccupationalLead,
  serializeProgram,
  setProgramStatus,
  updateOccupationalLeadStatus,
  updateProgram,
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

  // ── Programa ocupacional (stage-B seguro; gate RIOHS) ──────────────
  listPrograms: readLeads
    .route({ method: "GET", path: "/programs", tags: ["Occupational"] })
    .output(occupationalProgramListResponseSchema)
    .handler(async () => {
      const programs = await listPrograms();
      return { programs: programs.map((p) => serializeProgram(p)) };
    }),

  createProgram: writeLeads
    .route({ method: "POST", path: "/programs", tags: ["Occupational"] })
    .input(createOccupationalProgramInputSchema)
    .output(occupationalProgramResponseSchema)
    .handler(async ({ input }) => {
      const program = await createProgram(input);
      return { program: serializeProgram(program) };
    }),

  updateProgram: writeLeads
    .route({ method: "POST", path: "/programs/{id}", tags: ["Occupational"] })
    .input(updateOccupationalProgramInputSchema)
    .output(occupationalProgramResponseSchema)
    .handler(async ({ input }) => {
      const program = await updateProgram(input);
      return { program: serializeProgram(program) };
    }),

  attestRiohs: writeLeads
    .route({ method: "POST", path: "/programs/{id}/attest-riohs", tags: ["Occupational"] })
    .input(attestRiohsInputSchema)
    .output(occupationalProgramResponseSchema)
    .handler(async ({ input, context }) => {
      const program = await attestRiohs(input.id, input.riohsClauseRef, context.user.id ?? null);
      return { program: serializeProgram(program) };
    }),

  setProgramStatus: writeLeads
    .route({ method: "POST", path: "/programs/{id}/status", tags: ["Occupational"] })
    .input(setProgramStatusInputSchema)
    .output(occupationalProgramResponseSchema)
    .handler(async ({ input }) => {
      const program = await setProgramStatus(input.id, input.status);
      return { program: serializeProgram(program) };
    }),

  listTestBatches: readLeads
    .route({ method: "POST", path: "/programs/batches/list", tags: ["Occupational"] })
    .input(listTestBatchesInputSchema)
    .output(occupationalTestBatchListResponseSchema)
    .handler(async ({ input }) => {
      const batches = await listTestBatches(input.programId);
      return { batches: batches.map((b) => serializeBatch(b)) };
    }),

  createTestBatch: writeLeads
    .route({ method: "POST", path: "/programs/batches", tags: ["Occupational"] })
    .input(createTestBatchInputSchema)
    .output(occupationalTestBatchResponseSchema)
    .handler(async ({ input, context }) => {
      const batch = await createTestBatch(input, context.user.id ?? null);
      return { batch: serializeBatch(batch) };
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
