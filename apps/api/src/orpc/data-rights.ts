import {
  dataRightsCreateInputSchema,
  dataRightsListInputSchema,
  dataRightsListResponseSchema,
  dataRightsRequestSchema,
  dataRightsResolveInputSchema,
} from "@finanzas/orpc-contracts/data-rights";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createDataRightsRequest,
  listDataRightsRequests,
  resolveDataRightsRequest,
} from "../services/data-rights.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type DataRightsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DataRightsORPCContext>();

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

const readDataRights = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateDataRights = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const dataRightsORPCRouterBase = {
  list: readDataRights
    .route({ method: "GET", path: "/requests" })
    .input(dataRightsListInputSchema)
    .output(dataRightsListResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof dataRightsListInputSchema> }) =>
      listDataRightsRequests(input)
    ),

  create: updateDataRights
    .route({ method: "POST", path: "/requests" })
    .input(dataRightsCreateInputSchema)
    .output(dataRightsRequestSchema)
    .handler(async ({ input }: { input: z.infer<typeof dataRightsCreateInputSchema> }) =>
      createDataRightsRequest(input)
    ),

  resolve: updateDataRights
    .route({ method: "POST", path: "/requests/resolve" })
    .input(dataRightsResolveInputSchema)
    .output(dataRightsRequestSchema)
    .handler(async ({ input }: { input: z.infer<typeof dataRightsResolveInputSchema> }) =>
      resolveDataRightsRequest(input)
    ),
};

export const dataRightsORPCRouter = base
  .prefix("/api/orpc/data-rights")
  .router(dataRightsORPCRouterBase);

export const dataRightsORPCHandler = new SuperJSONRPCHandler(dataRightsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.data-rights",
      });
    }),
  ],
});

export type DataRightsORPCRouter = typeof dataRightsORPCRouter;
