import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { balancesQuerySchema, balanceUpsertSchema } from "../lib/financial-schemas";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { getBalancesReport, upsertDailyBalance } from "../services/balances";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type BalancesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<BalancesORPCContext>();

const daySchema = z.object({
  date: z.string(),
  difference: z.number().nullable(),
  expectedBalance: z.number().nullable(),
  hasCashback: z.boolean(),
  netChange: z.number(),
  note: z.string().nullable(),
  recordedBalance: z.number().nullable(),
  totalIn: z.number(),
  totalOut: z.number(),
});

const balancesResponseSchema = z.object({
  days: z.array(daySchema),
  from: z.string(),
  previous: z
    .object({
      balance: z.number(),
      date: z.string(),
      note: z.string().nullable(),
    })
    .nullable(),
  status: z.literal("ok"),
  to: z.string(),
});

const statusResponseSchema = z.object({
  status: z.literal("ok"),
});

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
  const canRead = await hasPermission(context.user.id, "read", "DailyBalance");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeBalances = authed.use(async ({ context, next }) => {
  const canWrite = await hasPermission(context.user.id, "create", "DailyBalance");

  if (!canWrite) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const balancesORPCRouterBase = {
  list: readBalances
    .route({ method: "GET", path: "/", tags: ["Balances"] })
    .input(
      balancesQuerySchema.refine((value) => Boolean(value.from && value.to), {
        message: "Parameters 'from' and 'to' are required",
      }),
    )
    .output(balancesResponseSchema)
    .handler(async ({ input }) => {
      const report = await getBalancesReport(input.from, input.to);

      return {
        ...report,
        from: input.from,
        status: "ok" as const,
        to: input.to,
      };
    }),

  save: writeBalances
    .route({ method: "POST", path: "/", tags: ["Balances"] })
    .input(balanceUpsertSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await upsertDailyBalance(input.date, input.balance, input.note);
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
