import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  loanCreateInputSchema,
  loanDeleteResponseSchema,
  loanDetailResponseSchema,
  loanListResponseSchema,
  loanPaymentInputSchema,
  loanPublicIdSchema,
  loanRegenerateSchedulesInputSchema,
  loanScheduleIdSchema,
  loanScheduleResponseSchema,
  loanUpdateInputSchema,
} from "@finanzas/orpc-contracts/loans";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createLoan,
  deleteLoan,
  getLoanDetail,
  listLoans,
  regenerateLoanSchedules,
  registerLoanPayment,
  unlinkLoanPayment,
  updateLoan,
} from "../services/loans";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type LoansORPCContext = {
  hono: HonoContext;
};

const base = os.$context<LoansORPCContext>();

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

const readLoans = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Loan");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const createLoans = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Loan");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const updateLoans = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Loan");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const deleteLoans = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "Loan");
  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const loansORPCRouterBase = {
  create: createLoans
    .route({ method: "POST", path: "/", summary: "Create a loan", tags: ["Loans"] })
    .input(loanCreateInputSchema)
    .output(loanDetailResponseSchema)
    .handler(async ({ input }) => {
      const created = await createLoan(input);
      return { ...created, status: "ok" as const };
    }),

  delete: deleteLoans
    .route({ method: "DELETE", path: "/{publicId}", summary: "Delete a loan", tags: ["Loans"] })
    .input(loanPublicIdSchema)
    .output(loanDeleteResponseSchema)
    .handler(async ({ input }) => {
      await deleteLoan(input.publicId);
      return { status: "ok" as const };
    }),

  detail: readLoans
    .route({ method: "GET", path: "/{publicId}", summary: "Get loan detail", tags: ["Loans"] })
    .input(loanPublicIdSchema)
    .output(loanDetailResponseSchema)
    .handler(async ({ input }) => {
      const loan = await getLoanDetail(input.publicId);
      return { ...loan, status: "ok" as const };
    }),

  list: readLoans
    .route({ method: "GET", path: "/", summary: "List loans", tags: ["Loans"] })
    .output(loanListResponseSchema)
    .handler(async () => ({
      loans: await listLoans(),
      status: "ok" as const,
    })),

  paySchedule: updateLoans
    .route({
      method: "POST",
      path: "/schedules/{id}/pay",
      summary: "Register a loan payment",
      tags: ["Loans"],
    })
    .input(loanScheduleIdSchema.extend({ payload: loanPaymentInputSchema }))
    .output(loanScheduleResponseSchema)
    .handler(async ({ input }) => ({
      schedule: await registerLoanPayment(input.id, input.payload),
      status: "ok" as const,
    })),

  regenerateSchedules: updateLoans
    .route({
      method: "POST",
      path: "/{publicId}/schedules",
      summary: "Regenerate loan schedules",
      tags: ["Loans"],
    })
    .input(loanPublicIdSchema.extend({ payload: loanRegenerateSchedulesInputSchema }))
    .output(loanDetailResponseSchema)
    .handler(async ({ input }) => {
      const loan = await regenerateLoanSchedules(input.publicId, input.payload);
      return { ...loan, status: "ok" as const };
    }),

  unlinkSchedulePayment: updateLoans
    .route({
      method: "POST",
      path: "/schedules/{id}/unlink",
      summary: "Unlink a loan payment",
      tags: ["Loans"],
    })
    .input(loanScheduleIdSchema)
    .output(loanScheduleResponseSchema)
    .handler(async ({ input }) => ({
      schedule: await unlinkLoanPayment(input.id),
      status: "ok" as const,
    })),

  update: updateLoans
    .route({ method: "PUT", path: "/{publicId}", summary: "Update a loan", tags: ["Loans"] })
    .input(loanPublicIdSchema.extend({ payload: loanUpdateInputSchema }))
    .output(loanDetailResponseSchema)
    .handler(async ({ input }) => {
      const loan = await updateLoan(input.publicId, input.payload);
      return { ...loan, status: "ok" as const };
    }),
};

export const loansORPCRouter = base.prefix("/api/orpc/loans").tag("Loans").router(loansORPCRouterBase);

export const loansORPCHandler = new SuperJSONRPCHandler(loansORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("loans.orpc", error, {
        module: "api",
        operation: "orpc.loans",
      });
    }),
  ],
});

export const loansOpenAPIHandler = new OpenAPIHandler(loansORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Loans API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Loans API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("loans.openapi", error, {
        module: "api",
        operation: "openapi.loans",
      });
    }),
  ],
});

export type LoansORPCRouter = typeof loansORPCRouter;
