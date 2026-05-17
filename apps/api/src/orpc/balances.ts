import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  balanceUpsertSchema,
  balancesQuerySchema,
  balancesResponseSchema,
  balancesStatusResponseSchema,
} from "@finanzas/orpc-contracts/balances";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { getBalancesReport, upsertDailyBalance } from "../services/balances.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type BalancesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<BalancesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readBalances = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "DailyBalance");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeBalances = authed.use(async ({ context, next }) => {
  const canWrite = await hasPermission(context.user, "create", "DailyBalance");

  if (!canWrite) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const balancesORPCRouterBase = {
  list: readBalances
    .route({ method: "GET", path: "/" })
    .input(balancesQuerySchema)
    .output(balancesResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof balancesQuerySchema> }) => {
      const report = await getBalancesReport(input.from, input.to);

      return {
        ...report,
        from: input.from,
        previous: report.previous
          ? {
              balance: report.previous.balance,
              date: report.previous.date,
              note: null,
            }
          : null,
        status: "ok" as const,
        to: input.to,
      };
    }),

  save: writeBalances
    .route({ method: "POST", path: "/" })
    .input(balanceUpsertSchema)
    .output(balancesStatusResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof balanceUpsertSchema> }) => {
      await upsertDailyBalance(input.date, input.balance, input.note ?? undefined);
      return { status: "ok" as const };
    }),
};

export const balancesORPCRouter = base.prefix("/api/orpc/balances").router(balancesORPCRouterBase);

export const balancesORPCHandler = new SuperJSONRPCHandler(balancesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.balances",
      });
    }),
  ],
});

export const balancesOpenAPIHandler = new OpenAPIHandler(balancesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Balances oRPC",
          description: "Contratos oRPC/OpenAPI para balances diarios de caja.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.balances",
      });
    }),
  ],
});

export type BalancesORPCRouter = typeof balancesORPCRouter;
