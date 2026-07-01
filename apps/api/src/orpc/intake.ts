import {
  listIntakeSubmissionsInputSchema,
  listIntakeSubmissionsResponseSchema,
} from "@finanzas/orpc-contracts/intake";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { listIntakeSubmissions } from "../services/intake.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type IntakeORPCContext = {
  hono: HonoContext;
};

const base = os.$context<IntakeORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Gated on the same subject as the WhatsApp Cloud admin surface — these intakes
// are the abono/WA feature's data and only WA-admin staff should read them.
const readWa = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "read", "WaBusinessAccount");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const intakeORPCRouterBase = {
  list: readWa
    .route({ method: "POST", path: "/list" })
    .input(listIntakeSubmissionsInputSchema)
    .output(listIntakeSubmissionsResponseSchema)
    .handler(async ({ input }) => listIntakeSubmissions(input)),
};

export const intakeORPCRouter = base.prefix("/api/orpc/intake").router(intakeORPCRouterBase);

export const intakeORPCHandler = new SuperJSONRPCHandler(intakeORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.intake" });
    }),
  ],
});

export type IntakeORPCRouter = typeof intakeORPCRouter;
