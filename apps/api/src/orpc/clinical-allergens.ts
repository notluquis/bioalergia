import {
  allergenIdInputSchema,
  clinicalAllergenListInputSchema,
  clinicalAllergenListResponseSchema,
  clinicalAllergenResponseSchema,
  createClinicalAllergenInputSchema,
  updateClinicalAllergenInputSchema,
} from "@finanzas/orpc-contracts/clinical-allergens";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createAllergen,
  deactivateAllergen,
  getAllergenOrThrow,
  listAllergens,
  serializeAllergen,
  updateAllergen,
} from "../services/clinical-allergens.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ClinicalAllergensORPCContext = { hono: HonoContext };
const base = os.$context<ClinicalAllergensORPCContext>();

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

const readAllergens = requirePermission("read", "ClinicalAllergen");
const writeAllergens = requirePermission("update", "ClinicalAllergen");
const createAllergens = requirePermission("create", "ClinicalAllergen");

const clinicalAllergensRouterBase = {
  listAllergens: readAllergens
    .route({ method: "GET", path: "/allergens", tags: ["ClinicalAllergens"] })
    .input(clinicalAllergenListInputSchema)
    .output(clinicalAllergenListResponseSchema)
    .handler(async ({ input }) => {
      const allergens = await listAllergens(input);
      return { allergens: allergens.map((a) => serializeAllergen(a)) };
    }),

  getAllergen: readAllergens
    .route({ method: "GET", path: "/allergens/{id}", tags: ["ClinicalAllergens"] })
    .input(allergenIdInputSchema)
    .output(clinicalAllergenResponseSchema)
    .handler(async ({ input }) => {
      const allergen = await getAllergenOrThrow(input.id);
      return { allergen: serializeAllergen(allergen) };
    }),

  createAllergen: createAllergens
    .route({ method: "POST", path: "/allergens", tags: ["ClinicalAllergens"] })
    .input(createClinicalAllergenInputSchema)
    .output(clinicalAllergenResponseSchema)
    .handler(async ({ input }) => {
      const allergen = await createAllergen(input);
      return { allergen: serializeAllergen(allergen) };
    }),

  updateAllergen: writeAllergens
    .route({ method: "POST", path: "/allergens/{id}/update", tags: ["ClinicalAllergens"] })
    .input(updateClinicalAllergenInputSchema)
    .output(clinicalAllergenResponseSchema)
    .handler(async ({ input }) => {
      const allergen = await updateAllergen(input);
      return { allergen: serializeAllergen(allergen) };
    }),

  deactivateAllergen: writeAllergens
    .route({ method: "POST", path: "/allergens/{id}/deactivate", tags: ["ClinicalAllergens"] })
    .input(allergenIdInputSchema)
    .output(clinicalAllergenResponseSchema)
    .handler(async ({ input }) => {
      const allergen = await deactivateAllergen(input.id);
      return { allergen: serializeAllergen(allergen) };
    }),
};

export const clinicalAllergensORPCRouter = base
  .prefix("/api/orpc/clinical-allergens")
  .router(clinicalAllergensRouterBase);

export const clinicalAllergensORPCHandler = new SuperJSONRPCHandler(clinicalAllergensORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.clinical-allergens" });
    }),
  ],
});

export const clinicalAllergensOpenAPIHandler = new OpenAPIHandler(clinicalAllergensORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia ClinicalAllergens oRPC",
          description: "CRUD del catálogo clínico de alérgenos.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.clinical-allergens" });
    }),
  ],
});

export type ClinicalAllergensORPCRouter = typeof clinicalAllergensORPCRouter;
