import {
  createPublicComplaintInputSchema,
  createPublicContactInputSchema,
  createPublicDataRightsInputSchema,
  publicOkResponseSchema,
  publicPriceListResponseSchema,
} from "@finanzas/orpc-contracts/public-clinic";
import { onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createPublicComplaint,
  createPublicContact,
  createPublicDataRightsRequest,
  listPublicPriceList,
} from "../services/public-clinic.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type PublicClinicORPCContext = { hono: HonoContext };
const base = os.$context<PublicClinicORPCContext>();

// Toda la superficie es PÚBLICA (sin auth): es la cara al paciente del sitio.
// La protección es honeypot + validación de input + consentimiento (contrato).
const publicClinicRouterBase = {
  priceList: base
    .route({ method: "GET", path: "/price-list" })
    .output(publicPriceListResponseSchema)
    .handler(async () => listPublicPriceList()),

  createComplaint: base
    .route({ method: "POST", path: "/complaints" })
    .input(createPublicComplaintInputSchema)
    .output(publicOkResponseSchema)
    .handler(async ({ input }) => createPublicComplaint(input)),

  createDataRightsRequest: base
    .route({ method: "POST", path: "/data-rights" })
    .input(createPublicDataRightsInputSchema)
    .output(publicOkResponseSchema)
    .handler(async ({ input }) => createPublicDataRightsRequest(input)),

  createContact: base
    .route({ method: "POST", path: "/contact" })
    .input(createPublicContactInputSchema)
    .output(publicOkResponseSchema)
    .handler(async ({ input }) => createPublicContact(input)),
};

export const publicClinicORPCRouter = base
  .prefix("/api/orpc/public-clinic")
  .router(publicClinicRouterBase);

export const publicClinicORPCHandler = new SuperJSONRPCHandler(publicClinicORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.public-clinic" });
    }),
  ],
});

export type PublicClinicORPCRouter = typeof publicClinicORPCRouter;
