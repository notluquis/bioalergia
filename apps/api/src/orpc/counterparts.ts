import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { counterpartsContract } from "@finanzas/orpc-contracts/counterparts";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  assignRutToPayoutAccounts,
  attachRutToCounterpart,
  createCounterpart,
  getCounterpartById,
  getCounterpartSuggestions,
  getCounterpartSummary,
  listCounterparts,
  listUnassignedPayoutAccounts,
  syncCounterpartsFromTransactions,
  updateCounterpart,
  updateCounterpartAccount,
  upsertCounterpartAccount,
} from "../services/counterparts";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type CounterpartsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<CounterpartsORPCContext>();

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

const readCounterparts = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Counterpart");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createCounterparts = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Counterpart");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateCounterparts = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Counterpart");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const counterpartsORPCRouterBase = {
  addAccount: updateCounterparts
    .route({
      method: "POST",
      path: "/{counterpartId}/accounts",
      summary: "Add counterpart account",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.addAccount["~orpc"].inputSchema)
    .output(counterpartsContract.addAccount["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      const result = await upsertCounterpartAccount(input.counterpartId, {
        accountNumber: input.payload.accountIdentifier ?? input.payload.accountNumber ?? "",
        accountType: input.payload.accountType,
        bankName: input.payload.bankName,
      });

      return { accounts: [result] };
    }),

  assignRutToPayouts: updateCounterparts
    .route({
      method: "POST",
      path: "/assign-rut-to-payouts",
      summary: "Assign RUT to payout accounts",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.assignRutToPayouts["~orpc"].inputSchema)
    .output(counterpartsContract.assignRutToPayouts["~orpc"].outputSchema)
    .handler(async ({ input }) => assignRutToPayoutAccounts(input)),

  attachRut: updateCounterparts
    .route({
      method: "POST",
      path: "/{counterpartId}/attach-rut",
      summary: "Attach RUT to counterpart",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.attachRut["~orpc"].inputSchema)
    .output(counterpartsContract.attachRut["~orpc"].outputSchema)
    .handler(async ({ input }) => ({
      accounts: await attachRutToCounterpart(input.counterpartId, input.rut),
    })),

  create: createCounterparts
    .route({
      method: "POST",
      path: "/",
      summary: "Create counterpart",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.create["~orpc"].inputSchema)
    .output(counterpartsContract.create["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      const counterpart = await createCounterpart({
        bankAccountHolder: input.bankAccountHolder,
        category: input.category,
        identificationNumber: input.identificationNumber,
        notes: input.notes,
      });

      return {
        accounts: counterpart.accounts ?? [],
        counterpart,
      };
    }),

  detail: readCounterparts
    .route({
      method: "GET",
      path: "/{id}",
      summary: "Get counterpart detail",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.detail["~orpc"].inputSchema)
    .output(counterpartsContract.detail["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      const result = await getCounterpartById(input.id);
      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      return {
        accounts: result.accounts,
        counterpart: result.counterpart,
      };
    }),

  list: readCounterparts
    .route({
      method: "GET",
      path: "/",
      summary: "List counterparts",
      tags: ["Counterparts"],
    })
    .output(counterpartsContract.list["~orpc"].outputSchema)
    .handler(async () => ({
      counterparts: await listCounterparts(),
    })),

  suggestions: readCounterparts
    .route({
      method: "GET",
      path: "/suggestions",
      summary: "Get counterpart account suggestions",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.suggestions["~orpc"].inputSchema)
    .output(counterpartsContract.suggestions["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      if (!input.q?.trim()) {
        return { suggestions: [] };
      }

      return {
        suggestions: await getCounterpartSuggestions(input.q, input.limit ?? 10),
      };
    }),

  summary: readCounterparts
    .route({
      method: "GET",
      path: "/{id}/summary",
      summary: "Get counterpart summary",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.summary["~orpc"].inputSchema)
    .output(counterpartsContract.summary["~orpc"].outputSchema)
    .handler(async ({ input }) => ({
      summary: await getCounterpartSummary(input.id),
    })),

  sync: updateCounterparts
    .route({
      method: "POST",
      path: "/sync",
      summary: "Sync counterparts from transactions",
      tags: ["Counterparts"],
    })
    .output(counterpartsContract.sync["~orpc"].outputSchema)
    .handler(async () => syncCounterpartsFromTransactions()),

  unassignedPayoutAccounts: readCounterparts
    .route({
      method: "GET",
      path: "/unassigned-payout-accounts",
      summary: "List unassigned payout accounts",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.unassignedPayoutAccounts["~orpc"].inputSchema)
    .output(counterpartsContract.unassignedPayoutAccounts["~orpc"].outputSchema)
    .handler(async ({ input }) =>
      listUnassignedPayoutAccounts({
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
        query: input.query,
      }),
    ),

  update: updateCounterparts
    .route({
      method: "PUT",
      path: "/{id}",
      summary: "Update counterpart",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.update["~orpc"].inputSchema)
    .output(counterpartsContract.update["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      const counterpart = await updateCounterpart(input.id, input.payload);
      return {
        accounts: counterpart.accounts ?? [],
        counterpart,
      };
    }),

  updateAccount: updateCounterparts
    .route({
      method: "PUT",
      path: "/accounts/{accountId}",
      summary: "Update counterpart account",
      tags: ["Counterparts"],
    })
    .input(counterpartsContract.updateAccount["~orpc"].inputSchema)
    .output(counterpartsContract.updateAccount["~orpc"].outputSchema)
    .handler(async ({ input }) => {
      await updateCounterpartAccount(input.accountId, input.payload);
      return { status: "ok" as const };
    }),
};

export const counterpartsORPCRouter = base
  .prefix("/api/orpc/counterparts")
  .tag("Counterparts")
  .router(counterpartsORPCRouterBase);

export const counterpartsORPCHandler = new SuperJSONRPCHandler(counterpartsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("counterparts.orpc", error, {});
    }),
  ],
});

export const counterpartsOpenAPIHandler = new OpenAPIHandler(counterpartsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Counterparts API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Counterparts API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("counterparts.orpc.openapi", error, {});
    }),
  ],
});

export type CounterpartsORPCRouter = typeof counterpartsORPCRouter;
