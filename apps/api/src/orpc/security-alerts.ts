import { securityAlertsListResponseSchema } from "@finanzas/orpc-contracts/security-alerts";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { listSecurityAlertStates } from "../services/security-alerts-dashboard.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type SecurityAlertsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SecurityAlertsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readSettings = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const securityAlertsORPCRouterBase = {
  list: readSettings
    .route({ method: "GET", path: "/states" })
    .output(securityAlertsListResponseSchema)
    .handler(async () => listSecurityAlertStates()),
};

export const securityAlertsORPCRouter = base
  .prefix("/api/orpc/security-alerts")
  .router(securityAlertsORPCRouterBase);

export const securityAlertsORPCHandler = new SuperJSONRPCHandler(securityAlertsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.security-alerts",
      });
    }),
  ],
});

export type SecurityAlertsORPCRouter = typeof securityAlertsORPCRouter;
