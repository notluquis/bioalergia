import {
  clinicalConsentCreateInputSchema,
  clinicalConsentDecideInputSchema,
  clinicalConsentListInputSchema,
  clinicalConsentListResponseSchema,
  clinicalConsentSchema,
} from "@finanzas/orpc-contracts/clinical-consent";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createClinicalConsent,
  decideClinicalConsent,
  listClinicalConsents,
} from "../services/clinical-consent.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ClinicalConsentORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ClinicalConsentORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({ context: { ...context, user } });
});

const readConsent = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateConsent = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const clinicalConsentORPCRouterBase = {
  list: readConsent
    .route({ method: "GET", path: "/consents" })
    .input(clinicalConsentListInputSchema)
    .output(clinicalConsentListResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof clinicalConsentListInputSchema> }) =>
      listClinicalConsents(input)
    ),

  create: updateConsent
    .route({ method: "POST", path: "/consents" })
    .input(clinicalConsentCreateInputSchema)
    .output(clinicalConsentSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.infer<typeof clinicalConsentCreateInputSchema>;
        context: { user: { id: number } };
      }) => createClinicalConsent(input, context.user.id)
    ),

  decide: updateConsent
    .route({ method: "POST", path: "/consents/decide" })
    .input(clinicalConsentDecideInputSchema)
    .output(clinicalConsentSchema)
    .handler(async ({ input }: { input: z.infer<typeof clinicalConsentDecideInputSchema> }) =>
      decideClinicalConsent(input)
    ),
};

export const clinicalConsentORPCRouter = base
  .prefix("/api/orpc/clinical-consent")
  .router(clinicalConsentORPCRouterBase);

export const clinicalConsentORPCHandler = new SuperJSONRPCHandler(clinicalConsentORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.clinical-consent" });
    }),
  ],
});

export type ClinicalConsentORPCRouter = typeof clinicalConsentORPCRouter;
