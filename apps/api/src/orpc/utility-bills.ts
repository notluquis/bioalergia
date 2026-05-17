import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  cgeBillResultSchema,
  essbioBillResultSchema,
  listSnapshotsInputSchema,
  listSnapshotsResponseSchema,
  listUtilityAccountsInputSchema,
  utilityAccountDetailResponseSchema,
  utilityAccountListResponseSchema,
  utilityAccountPayloadSchema,
  utilityAccountRefreshResponseSchema,
} from "@finanzas/orpc-contracts/utility-bills";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createUtilityAccount,
  deleteUtilityAccount,
  fetchCgeBill,
  fetchEssbioBill,
  listUtilityAccounts,
  listUtilityBillSnapshots,
  refreshUtilityAccount,
  updateUtilityAccount,
} from "../services/utility-bills.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type UtilityBillsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<UtilityBillsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({ context: { ...context, user } });
});

const idInputSchema = z.object({ id: z.number().int() });

const utilityBillsRouterBase = {
  // ─── UtilityAccount CRUD ──────────────────────────────────────────────────

  createAccount: authed
    .route({ method: "POST", path: "/accounts" })
    .input(utilityAccountPayloadSchema)
    .output(utilityAccountDetailResponseSchema)
    .handler(async ({ input }) => {
      const account = await createUtilityAccount(input);
      return { account, status: "ok" as const };
    }),

  deleteAccount: authed
    .route({ method: "DELETE", path: "/accounts/{id}" })
    .input(idInputSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteUtilityAccount(input.id);
      return { status: "ok" as const };
    }),

  listAccounts: authed
    .route({ method: "GET", path: "/accounts" })
    .input(listUtilityAccountsInputSchema)
    .output(utilityAccountListResponseSchema)
    .handler(async ({ input }) => {
      const accounts = await listUtilityAccounts({
        isActive: input.isActive,
        provider: input.provider,
        scope: input.scope,
      });
      return { accounts, status: "ok" as const };
    }),

  updateAccount: authed
    .route({ method: "PUT", path: "/accounts/{id}" })
    .input(z.object({ id: z.number().int(), payload: utilityAccountPayloadSchema }))
    .output(utilityAccountDetailResponseSchema)
    .handler(async ({ input }) => {
      const account = await updateUtilityAccount(input.id, input.payload);
      return { account, status: "ok" as const };
    }),

  refreshAccount: authed
    .route({ method: "POST", path: "/accounts/{id}/refresh" })
    .input(idInputSchema)
    .output(utilityAccountRefreshResponseSchema)
    .handler(async ({ input }) => {
      const result = await refreshUtilityAccount(input.id);

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Utility account not found" });
      }

      return { account: result.account, bill: result.bill, status: "ok" as const };
    }),

  // ─── One-off raw fetches ──────────────────────────────────────────────────

  fetchEssbio: authed
    .route({ method: "POST", path: "/fetch/essbio" })
    .input(z.object({ serviceNumber: z.string().min(1) }))
    .output(z.object({ bill: essbioBillResultSchema, status: z.literal("ok") }))
    .handler(async ({ input }) => {
      const bill = await fetchEssbioBill(input.serviceNumber);
      return { bill, status: "ok" as const };
    }),

  fetchCge: authed
    .route({ method: "POST", path: "/fetch/cge" })
    .input(z.object({ accountNumber: z.string().min(1) }))
    .output(z.object({ bill: cgeBillResultSchema, status: z.literal("ok") }))
    .handler(async ({ input }) => {
      const bill = await fetchCgeBill(input.accountNumber);
      return { bill, status: "ok" as const };
    }),

  // ─── Snapshot history ────────────────────────────────────────────────────
  listSnapshots: authed
    .route({ method: "GET", path: "/accounts/{utilityAccountId}/snapshots" })
    .input(listSnapshotsInputSchema)
    .output(listSnapshotsResponseSchema)
    .handler(async ({ input }) => {
      const snapshots = await listUtilityBillSnapshots(input.utilityAccountId, {
        limit: input.limit,
      });
      return { snapshots, status: "ok" as const };
    }),
};

export const utilityBillsORPCRouter = base
  .prefix("/api/orpc/utility-bills")
  .router(utilityBillsRouterBase);

export const utilityBillsORPCHandler = new SuperJSONRPCHandler(utilityBillsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.utility-bills",
      });
    }),
  ],
});

export const utilityBillsOpenAPIHandler = new OpenAPIHandler(utilityBillsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Utility Bills oRPC",
          description:
            "Cuentas de servicios básicos (Essbio, CGE, etc.) — CRUD y consulta de deuda.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.utility-bills",
      });
    }),
  ],
});

export type UtilityBillsORPCRouter = typeof utilityBillsORPCRouter;
