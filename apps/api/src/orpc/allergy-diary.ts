import {
  deleteDiaryEntryInputSchema,
  diaryEntryListResponseSchema,
  diaryEntryResponseSchema,
  diarySeasonInputSchema,
  diarySeasonSchema,
  listDiaryEntriesInputSchema,
  upsertDiaryEntryInputSchema,
} from "@finanzas/orpc-contracts/allergy-diary";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { z } from "zod";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  deleteEntry,
  listEntries,
  seasonAggregate,
  serializeDiaryEntry,
  upsertEntry,
} from "../services/allergy-diary.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type AllergyDiaryORPCContext = { hono: HonoContext };
const base = os.$context<AllergyDiaryORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Reusa el subject `ImmunotherapyAdministration`: el mismo staff clínico que
// gestiona la inmunoterapia gestiona el diario de síntomas.
function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "ImmunotherapyAdministration");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const reader = requirePermission("read");
const writer = requirePermission("update");

const allergyDiaryRouterBase = {
  upsertEntry: writer
    .route({ method: "POST", path: "/entries", tags: ["AllergyDiary"] })
    .input(upsertDiaryEntryInputSchema)
    .output(diaryEntryResponseSchema)
    .handler(async ({ input, context }) => {
      const entry = await upsertEntry(input, context.user.id ?? null);
      return { entry: serializeDiaryEntry(entry) };
    }),

  listEntries: reader
    .route({ method: "POST", path: "/entries/list", tags: ["AllergyDiary"] })
    .input(listDiaryEntriesInputSchema)
    .output(diaryEntryListResponseSchema)
    .handler(async ({ input }) => {
      const entries = await listEntries(input);
      // Si vino ventana [from,to], devuelve el agregado de temporada de paso.
      const season =
        input.from && input.to
          ? await seasonAggregate({
              patientId: input.patientId,
              seasonStart: input.from,
              seasonEnd: input.to,
            })
          : null;
      return { entries: entries.map((e) => serializeDiaryEntry(e)), season };
    }),

  season: reader
    .route({ method: "POST", path: "/season", tags: ["AllergyDiary"] })
    .input(diarySeasonInputSchema)
    .output(diarySeasonSchema)
    .handler(async ({ input }) => {
      return seasonAggregate(input);
    }),

  deleteEntry: writer
    .route({ method: "POST", path: "/entries/{id}/delete", tags: ["AllergyDiary"] })
    .input(deleteDiaryEntryInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ input }) => {
      return deleteEntry(input.id);
    }),
};

export const allergyDiaryORPCRouter = base
  .prefix("/api/orpc/allergy-diary")
  .router(allergyDiaryRouterBase);

export const allergyDiaryORPCHandler = new SuperJSONRPCHandler(allergyDiaryORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.allergy-diary" });
    }),
  ],
});

export const allergyDiaryOpenAPIHandler = new OpenAPIHandler(allergyDiaryORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia eDiary oRPC",
          description: "Diario de síntomas CSMS (staff; recolección paciente gateada por EIPD).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.allergy-diary" });
    }),
  ],
});

export type AllergyDiaryORPCRouter = typeof allergyDiaryORPCRouter;
