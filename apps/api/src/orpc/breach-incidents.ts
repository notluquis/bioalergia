import {
  breachIncidentSchema,
  breachIncidentsResponseSchema,
  createBreachIncidentInputSchema,
  listBreachIncidentsInputSchema,
  updateBreachIncidentInputSchema,
} from "@finanzas/orpc-contracts/breach-incidents";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createBreachIncident,
  listBreachIncidents,
  updateBreachIncident,
} from "../services/breach-incidents.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type BreachIncidentsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<BreachIncidentsORPCContext>();

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

const readBreaches = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateBreaches = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const breachIncidentsORPCRouterBase = {
  list: readBreaches
    .route({ method: "GET", path: "/incidents" })
    .input(listBreachIncidentsInputSchema)
    .output(breachIncidentsResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof listBreachIncidentsInputSchema> }) =>
      listBreachIncidents(input)
    ),

  create: updateBreaches
    .route({ method: "POST", path: "/incidents" })
    .input(createBreachIncidentInputSchema)
    .output(breachIncidentSchema)
    .handler(async ({ input }: { input: z.infer<typeof createBreachIncidentInputSchema> }) =>
      createBreachIncident(input)
    ),

  update: updateBreaches
    .route({ method: "POST", path: "/incidents/update" })
    .input(updateBreachIncidentInputSchema)
    .output(breachIncidentSchema)
    .handler(async ({ input }: { input: z.infer<typeof updateBreachIncidentInputSchema> }) =>
      updateBreachIncident(input)
    ),
};

export const breachIncidentsORPCRouter = base
  .prefix("/api/orpc/breach-incidents")
  .router(breachIncidentsORPCRouterBase);

export const breachIncidentsORPCHandler = new SuperJSONRPCHandler(breachIncidentsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.breach-incidents",
      });
    }),
  ],
});

export type BreachIncidentsORPCRouter = typeof breachIncidentsORPCRouter;
