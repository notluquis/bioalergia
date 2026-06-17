import {
  processingActivitiesListResponseSchema,
  processingActivityIdInputSchema,
  processingActivitySchema,
  processingActivityStatusResponseSchema,
  upsertProcessingActivityInputSchema,
} from "@finanzas/orpc-contracts/processing-activities";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  deleteProcessingActivity,
  listProcessingActivities,
  upsertProcessingActivity,
} from "../services/processing-activities.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ProcessingActivitiesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ProcessingActivitiesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({ context: { ...context, user } });
});

const readActivities = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateActivities = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const processingActivitiesORPCRouterBase = {
  list: readActivities
    .route({ method: "GET", path: "/activities" })
    .output(processingActivitiesListResponseSchema)
    .handler(async () => listProcessingActivities()),

  upsert: updateActivities
    .route({ method: "POST", path: "/activities" })
    .input(upsertProcessingActivityInputSchema)
    .output(processingActivitySchema)
    .handler(async ({ input }: { input: z.infer<typeof upsertProcessingActivityInputSchema> }) =>
      upsertProcessingActivity(input)
    ),

  remove: updateActivities
    .route({ method: "DELETE", path: "/activities" })
    .input(processingActivityIdInputSchema)
    .output(processingActivityStatusResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof processingActivityIdInputSchema> }) =>
      deleteProcessingActivity(input.id)
    ),
};

export const processingActivitiesORPCRouter = base
  .prefix("/api/orpc/processing-activities")
  .router(processingActivitiesORPCRouterBase);

export const processingActivitiesORPCHandler = new SuperJSONRPCHandler(
  processingActivitiesORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, { module: "api", operation: "orpc.processing-activities" });
      }),
    ],
  }
);

export type ProcessingActivitiesORPCRouter = typeof processingActivitiesORPCRouter;
