import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import {
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
  counterpartBulkAssignRutSchema,
  counterpartPayloadSchema,
} from "../lib/entity-schemas";
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

const counterpartCategorySchema = z.enum([
  "SUPPLIER",
  "CLIENT",
  "EMPLOYEE",
  "PARTNER",
  "LENDER",
  "PERSONAL_EXPENSE",
  "OTHER",
]);

const counterpartSchema = z.object({
  bankAccountHolder: z.string(),
  category: counterpartCategorySchema,
  createdAt: z.date(),
  id: z.number().int(),
  identificationNumber: z.string(),
  notes: z.string().nullable(),
  updatedAt: z.date(),
});

const counterpartAccountSchema = z.object({
  accountNumber: z.string(),
  accountType: z.string().nullable(),
  bankName: z.string().nullable(),
  counterpartId: z.number().int(),
  createdAt: z.date(),
  id: z.number().int(),
  updatedAt: z.date(),
});

const counterpartSuggestionSchema = z.object({
  accountIdentifier: z.string(),
  accountType: z.string().nullable(),
  assignedCounterpartId: z.number().int().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankName: z.string().nullable(),
  identificationNumber: z.string().nullable(),
  totalAmount: z.number(),
  withdrawId: z.string().nullable(),
});

const counterpartSummarySchema = z.object({
  releaseTotal: z.number(),
  settlementCount: z.number().int(),
  withdrawTotal: z.number(),
});

const unassignedPayoutAccountSchema = z.object({
  conflict: z.boolean(),
  counterpartId: z.number().int().nullable(),
  counterpartName: z.string().nullable(),
  counterpartRut: z.string().nullable(),
  movementCount: z.number().int(),
  payoutBankAccountNumber: z.string(),
  totalGrossAmount: z.number(),
  withdrawRut: z.string().nullable(),
});

const suggestionInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  q: z.string().optional(),
});

const unassignedPayoutAccountsInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  query: z.string().optional(),
});

const counterpartIdSchema = z.object({
  id: z.number().int(),
});

const counterpartSummaryInputSchema = counterpartIdSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
});

const addAccountInputSchema = z.object({
  counterpartId: z.number().int(),
  payload: counterpartAccountPayloadSchema,
});

const updateAccountInputSchema = z.object({
  accountId: z.number().int(),
  payload: counterpartAccountUpdateSchema,
});

const updateCounterpartInputSchema = z.object({
  id: z.number().int(),
  payload: counterpartPayloadSchema.partial(),
});

const attachRutInputSchema = z.object({
  counterpartId: z.number().int(),
  rut: z.string().min(1),
});

const counterpartsResponseSchema = z.object({
  counterparts: z.array(counterpartSchema),
});

const counterpartDetailResponseSchema = z.object({
  accounts: z.array(counterpartAccountSchema),
  counterpart: counterpartSchema,
});

const accountsResponseSchema = z.object({
  accounts: z.array(counterpartAccountSchema),
});

const suggestionsResponseSchema = z.object({
  suggestions: z.array(counterpartSuggestionSchema),
});

const syncResponseSchema = z.object({
  conflictCount: z.number().int().optional(),
  syncedAccounts: z.number().int(),
  syncedCounterparts: z.number().int(),
});

const unassignedPayoutAccountsResponseSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  rows: z.array(unassignedPayoutAccountSchema),
  total: z.number().int(),
});

const assignRutToPayoutsResponseSchema = z.object({
  assignedCount: z.number().int(),
  conflicts: z.array(unassignedPayoutAccountSchema),
  counterpart: counterpartSchema,
});

const summaryResponseSchema = z.object({
  summary: counterpartSummarySchema,
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
    .input(addAccountInputSchema)
    .output(accountsResponseSchema)
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
    .input(counterpartBulkAssignRutSchema)
    .output(assignRutToPayoutsResponseSchema)
    .handler(async ({ input }) => assignRutToPayoutAccounts(input)),

  attachRut: updateCounterparts
    .route({
      method: "POST",
      path: "/{counterpartId}/attach-rut",
      summary: "Attach RUT to counterpart",
      tags: ["Counterparts"],
    })
    .input(attachRutInputSchema)
    .output(accountsResponseSchema)
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
    .input(counterpartPayloadSchema)
    .output(counterpartDetailResponseSchema)
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
    .input(counterpartIdSchema)
    .output(counterpartDetailResponseSchema)
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
    .input(suggestionInputSchema)
    .output(suggestionsResponseSchema)
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
    .input(counterpartSummaryInputSchema)
    .output(summaryResponseSchema)
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
    .output(syncResponseSchema)
    .handler(async () => syncCounterpartsFromTransactions()),

  unassignedPayoutAccounts: readCounterparts
    .route({
      method: "GET",
      path: "/unassigned-payout-accounts",
      summary: "List unassigned payout accounts",
      tags: ["Counterparts"],
    })
    .input(unassignedPayoutAccountsInputSchema)
    .output(unassignedPayoutAccountsResponseSchema)
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
    .input(updateCounterpartInputSchema)
    .output(counterpartDetailResponseSchema)
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
    .input(updateAccountInputSchema)
    .output(statusResponseSchema)
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
      docsPath: "/api/orpc/counterparts/docs",
      docsTitle: "Bioalergia Counterparts API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Counterparts API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/counterparts/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("counterparts.orpc.openapi", error, {});
    }),
  ],
});

export type CounterpartsORPCRouter = typeof counterpartsORPCRouter;
