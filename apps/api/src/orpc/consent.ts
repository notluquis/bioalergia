import {
  consentListInputSchema,
  consentListResponseSchema,
  consentRecordInputSchema,
  consentRecordSchema,
  consentWithdrawInputSchema,
} from "@finanzas/orpc-contracts/consent";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { listConsentRecords, recordConsent, withdrawConsent } from "../services/consent.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ConsentORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ConsentORPCContext>();

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

const consentORPCRouterBase = {
  list: readConsent
    .route({ method: "GET", path: "/records" })
    .input(consentListInputSchema)
    .output(consentListResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof consentListInputSchema> }) =>
      listConsentRecords(input)
    ),

  record: updateConsent
    .route({ method: "POST", path: "/records" })
    .input(consentRecordInputSchema)
    .output(consentRecordSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.infer<typeof consentRecordInputSchema>;
        context: { user: { id: number } };
      }) => recordConsent(input, context.user.id)
    ),

  withdraw: updateConsent
    .route({ method: "POST", path: "/records/withdraw" })
    .input(consentWithdrawInputSchema)
    .output(consentRecordSchema)
    .handler(async ({ input }: { input: z.infer<typeof consentWithdrawInputSchema> }) =>
      withdrawConsent(input.id)
    ),
};

export const consentORPCRouter = base.prefix("/api/orpc/consent").router(consentORPCRouterBase);

export const consentORPCHandler = new SuperJSONRPCHandler(consentORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.consent" });
    }),
  ],
});

export type ConsentORPCRouter = typeof consentORPCRouter;
