import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  assignRutToPayoutsResponseSchema,
  counterpartAccountsResponseSchema,
  counterpartAddAccountInputSchema,
  counterpartAttachRutInputSchema,
  counterpartBulkAssignRutSchema,
  counterpartDetailResponseSchema,
  counterpartIdSchema,
  counterpartPayloadSchema,
  counterpartStatusResponseSchema,
  counterpartSuggestionInputSchema,
  counterpartSuggestionsResponseSchema,
  counterpartSummaryInputSchema,
  counterpartSummaryResponseSchema,
  counterpartUnassignedPayoutAccountsInputSchema,
  counterpartUpdateAccountInputSchema,
  counterpartUpdateInputSchema,
  counterpartsResponseSchema,
  counterpartsSyncResponseSchema,
  unassignedPayoutAccountsResponseSchema,
} from "@finanzas/orpc-contracts/counterparts";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
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
} from "../services/counterparts.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

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
  const canRead = await hasPermission(context.user, "read", "Counterpart");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createCounterparts = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Counterpart");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateCounterparts = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Counterpart");

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
    .input(counterpartAddAccountInputSchema)
    .output(counterpartAccountsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartAddAccountInputSchema> }) => {
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
    .input(counterpartBulkAssignRutSchema)
    .output(assignRutToPayoutsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartBulkAssignRutSchema> }) =>
      assignRutToPayoutAccounts(input),
    ),

  attachRut: updateCounterparts
    .route({
      method: "POST",
      path: "/{counterpartId}/attach-rut",
      summary: "Attach RUT to counterpart",
      tags: ["Counterparts"],
    })
    .input(counterpartAttachRutInputSchema)
    .output(counterpartAccountsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartAttachRutInputSchema> }) => ({
      accounts: await attachRutToCounterpart(input.counterpartId, input.rut),
    })),

  create: createCounterparts
    .route({
      method: "POST",
      path: "/",
      summary: "Create counterpart",
      tags: ["Counterparts"],
    })
    .input(counterpartPayloadSchema)
    .output(counterpartDetailResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartPayloadSchema> }) => {
      return await createCounterpart({
        bankAccountHolder: input.bankAccountHolder,
        category: input.category,
        identificationNumber: input.identificationNumber,
        notes: input.notes,
      });
    }),

  detail: readCounterparts
    .route({
      method: "GET",
      path: "/{id}",
      summary: "Get counterpart detail",
      tags: ["Counterparts"],
    })
    .input(counterpartIdSchema)
    .output(counterpartDetailResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartIdSchema> }) => {
      const result = await getCounterpartById(input.id);
      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }
      return result;
    }),

  list: readCounterparts
    .route({
      method: "GET",
      path: "/",
      summary: "List counterparts",
      tags: ["Counterparts"],
    })
    .output(counterpartsResponseSchema)
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
    .input(counterpartSuggestionInputSchema)
    .output(counterpartSuggestionsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartSuggestionInputSchema> }) => {
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
    .input(counterpartSummaryInputSchema)
    .output(counterpartSummaryResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartSummaryInputSchema> }) => ({
      summary: await getCounterpartSummary(input.id),
    })),

  sync: updateCounterparts
    .route({
      method: "POST",
      path: "/sync",
      summary: "Sync counterparts from transactions",
      tags: ["Counterparts"],
    })
    .output(counterpartsSyncResponseSchema)
    .handler(async () => syncCounterpartsFromTransactions()),

  unassignedPayoutAccounts: readCounterparts
    .route({
      method: "GET",
      path: "/unassigned-payout-accounts",
      summary: "List unassigned payout accounts",
      tags: ["Counterparts"],
    })
    .input(counterpartUnassignedPayoutAccountsInputSchema)
    .output(unassignedPayoutAccountsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartUnassignedPayoutAccountsInputSchema> }) =>
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
    .input(counterpartUpdateInputSchema)
    .output(counterpartDetailResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartUpdateInputSchema> }) =>
      updateCounterpart(input.id, input.payload),
    ),

  updateAccount: updateCounterparts
    .route({
      method: "PUT",
      path: "/accounts/{accountId}",
      summary: "Update counterpart account",
      tags: ["Counterparts"],
    })
    .input(counterpartUpdateAccountInputSchema)
    .output(counterpartStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof counterpartUpdateAccountInputSchema> }) => {
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
