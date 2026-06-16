import {
  priceListItemIdInputSchema,
  priceListItemSchema,
  priceListResponseSchema,
  priceListStatusResponseSchema,
  upsertPriceListItemInputSchema,
} from "@finanzas/orpc-contracts/price-list";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  deletePriceListItem,
  listPriceListItems,
  upsertPriceListItem,
} from "../services/price-list.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type PriceListORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PriceListORPCContext>();

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

const readPriceList = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updatePriceList = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const priceListORPCRouterBase = {
  list: readPriceList
    .route({ method: "GET", path: "/items" })
    .output(priceListResponseSchema)
    .handler(async () => listPriceListItems()),

  upsert: updatePriceList
    .route({ method: "POST", path: "/items" })
    .input(upsertPriceListItemInputSchema)
    .output(priceListItemSchema)
    .handler(async ({ input }: { input: z.infer<typeof upsertPriceListItemInputSchema> }) =>
      upsertPriceListItem(input)
    ),

  remove: updatePriceList
    .route({ method: "DELETE", path: "/items" })
    .input(priceListItemIdInputSchema)
    .output(priceListStatusResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof priceListItemIdInputSchema> }) =>
      deletePriceListItem(input.id)
    ),
};

export const priceListORPCRouter = base
  .prefix("/api/orpc/price-list")
  .router(priceListORPCRouterBase);

export const priceListORPCHandler = new SuperJSONRPCHandler(priceListORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.price-list",
      });
    }),
  ],
});

export type PriceListORPCRouter = typeof priceListORPCRouter;
