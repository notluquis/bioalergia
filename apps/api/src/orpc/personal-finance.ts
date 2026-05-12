import { authDb } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  personalFinanceBackfillResponseSchema,
  personalFinanceCreateCreditInputSchema,
  personalFinanceCreditIdSchema,
  personalFinanceCreditSchema,
  personalFinanceCreditsResponseSchema,
  personalFinanceDeleteCreditResponseSchema,
  personalFinanceInstallmentSchema,
  personalFinancePayInstallmentInputSchema,
} from "@finanzas/orpc-contracts/personal-finance";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { Decimal } from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { createAuthContext, getSessionUser } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { getUFValue } from "../services/cmf-uf.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();
dayjs.extend(utc);

type PersonalFinanceORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PersonalFinanceORPCContext>();
function parseDateOnlyUtc(value: string): Date {
  return dayjs.utc(value, "YYYY-MM-DD", true).toDate();
}

function toNumberValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Decimal) {
    return value.toNumber();
  }

  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return Number(value.toString());
  }

  return Number(value);
}

function toPlainInstallment<T extends Record<string, unknown>>(installment: T) {
  return {
    ...installment,
    amount: toNumberValue(installment.amount) ?? 0,
    capitalAmount: toNumberValue(installment.capitalAmount),
    creditId: Number(installment.creditId),
    dueDate: installment.dueDate as Date,
    id: Number(installment.id),
    installmentNumber: Number(installment.installmentNumber),
    interestAmount: toNumberValue(installment.interestAmount),
    otherCharges: toNumberValue(installment.otherCharges),
    paidAmount: toNumberValue(installment.paidAmount),
    paidAmountCLP: toNumberValue(installment.paidAmountCLP),
    paidAt: (installment.paidAt as Date | null | undefined) ?? undefined,
    status: installment.status as z.output<typeof personalFinanceInstallmentSchema>["status"],
  } satisfies z.output<typeof personalFinanceInstallmentSchema>;
}

function toPlainCredit<T extends Record<string, unknown>>(credit: T) {
  const installments = Array.isArray(credit.installments)
    ? credit.installments.map((installment) =>
        toPlainInstallment(installment as Record<string, unknown>)
      )
    : undefined;

  return {
    ...credit,
    bankName: String(credit.bankName),
    createdAt: credit.createdAt as Date,
    creditNumber: String(credit.creditNumber),
    currency: credit.currency as z.output<typeof personalFinanceCreditSchema>["currency"],
    description: (credit.description as string | null | undefined) ?? undefined,
    id: Number(credit.id),
    installments,
    interestRate: toNumberValue(credit.interestRate),
    nextPaymentAmount: toNumberValue(credit.nextPaymentAmount),
    nextPaymentDate: (credit.nextPaymentDate as Date | null | undefined) ?? undefined,
    remainingAmount: toNumberValue(credit.remainingAmount),
    startDate: credit.startDate as Date,
    status: credit.status as z.output<typeof personalFinanceCreditSchema>["status"],
    totalAmount: toNumberValue(credit.totalAmount) ?? 0,
    totalInstallments: Number(credit.totalInstallments),
    updatedAt: credit.updatedAt as Date,
  } satisfies z.output<typeof personalFinanceCreditSchema>;
}

async function getAuthorizedDb(c: HonoContext) {
  const user = await getSessionUser(c);
  const authContext = createAuthContext(user);

  if (!authContext) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return authDb.$setAuth(authContext);
}

const personalFinanceORPCRouterBase = {
  backfillUfClp: base
    .route({
      method: "POST",
      path: "/credits/backfill-uf-clp",
      summary: "Backfill CLP amounts for UF installments",
      tags: ["Personal Finance"],
    })
    .output(personalFinanceBackfillResponseSchema)
    .handler(async ({ context }) => {
      const db = await getAuthorizedDb(context.hono);
      const creditsUF = await db.personalCredit.findMany({
        where: { currency: "UF" },
        include: {
          installments: {
            where: {
              paidAt: { not: null },
              status: "PAID",
            },
          },
        },
      });

      const results: Array<{
        creditId: number;
        installmentNumber: number;
        paidAmount: number;
        paidAmountCLP: number;
        paymentDate: string;
        ufValue: number;
      }> = [];

      for (const credit of creditsUF) {
        for (const installment of credit.installments || []) {
          if (!installment.paidAt || !installment.paidAmount) {
            continue;
          }

          try {
            const paymentDate = dayjs(installment.paidAt).format("YYYY-MM-DD");
            const ufValue = await getUFValue(paymentDate);
            const paidAmountCLP = installment.paidAmount.times(ufValue);

            await db.personalCreditInstallment.update({
              where: { id: installment.id },
              data: { paidAmountCLP },
            });

            results.push({
              creditId: credit.id,
              installmentNumber: installment.installmentNumber,
              paidAmount: Number(installment.paidAmount),
              paidAmountCLP: Number(paidAmountCLP),
              paymentDate,
              ufValue,
            });
          } catch (error) {
            console.error(`[Backfill] Error processing installment ${installment.id}:`, error);
          }
        }
      }

      return {
        processed: results.length,
        results,
      };
    }),

  createCredit: base
    .route({
      method: "POST",
      path: "/credits",
      summary: "Create a personal credit",
      tags: ["Personal Finance"],
    })
    .input(personalFinanceCreateCreditInputSchema)
    .output(personalFinanceCreditSchema)
    .handler(async ({ context, input }) => {
      const db = await getAuthorizedDb(context.hono);

      const credit = await db.personalCredit.create({
        data: {
          bankName: input.bankName,
          creditNumber: input.creditNumber,
          description: input.description,
          totalAmount: new Decimal(input.totalAmount),
          currency: input.currency,
          interestRate: input.interestRate ? new Decimal(input.interestRate) : undefined,
          startDate: parseDateOnlyUtc(input.startDate),
          totalInstallments: input.totalInstallments,
          status: "ACTIVE",
          installments: {
            create: input.installments?.map(
              (installment: NonNullable<typeof input.installments>[number]) => ({
                installmentNumber: installment.installmentNumber,
                dueDate: parseDateOnlyUtc(installment.dueDate),
                amount: new Decimal(installment.amount),
                capitalAmount: installment.capitalAmount
                  ? new Decimal(installment.capitalAmount)
                  : undefined,
                interestAmount: installment.interestAmount
                  ? new Decimal(installment.interestAmount)
                  : undefined,
                otherCharges: installment.otherCharges
                  ? new Decimal(installment.otherCharges)
                  : undefined,
                status: "PENDING",
              })
            ),
          },
        },
        include: {
          installments: true,
        },
      });

      return toPlainCredit(credit);
    }),

  deleteCredit: base
    .route({
      method: "DELETE",
      path: "/credits/{id}",
      summary: "Delete a personal credit",
      tags: ["Personal Finance"],
    })
    .input(personalFinanceCreditIdSchema)
    .output(personalFinanceDeleteCreditResponseSchema)
    .handler(async ({ context, input }) => {
      const db = await getAuthorizedDb(context.hono);

      await db.personalCredit.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  getCredit: base
    .route({
      method: "GET",
      path: "/credits/{id}",
      summary: "Get a personal credit",
      tags: ["Personal Finance"],
    })
    .input(personalFinanceCreditIdSchema)
    .output(personalFinanceCreditSchema)
    .handler(async ({ context, input }) => {
      const db = await getAuthorizedDb(context.hono);
      const credit = await db.personalCredit.findUnique({
        where: { id: input.id },
        include: {
          installments: {
            orderBy: { installmentNumber: "asc" },
          },
        },
      });

      if (!credit) {
        throw new ORPCError("NOT_FOUND", { message: "Credit not found" });
      }

      return toPlainCredit(credit);
    }),

  listCredits: base
    .route({
      method: "GET",
      path: "/credits",
      summary: "List personal credits",
      tags: ["Personal Finance"],
    })
    .output(personalFinanceCreditsResponseSchema)
    .handler(async ({ context }) => {
      const db = await getAuthorizedDb(context.hono);

      const credits = await db.personalCredit.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          installments: {
            orderBy: { installmentNumber: "asc" },
          },
        },
      });

      return credits.map((credit) => toPlainCredit(credit));
    }),

  payInstallment: base
    .route({
      method: "POST",
      path: "/credits/{creditId}/installments/{installmentNumber}/pay",
      summary: "Mark a credit installment as paid",
      tags: ["Personal Finance"],
    })
    .input(personalFinancePayInstallmentInputSchema)
    .output(personalFinanceInstallmentSchema)
    .handler(async ({ context, input }) => {
      const db = await getAuthorizedDb(context.hono);

      const installment = await db.personalCreditInstallment.findUnique({
        where: {
          creditId_installmentNumber: {
            creditId: input.creditId,
            installmentNumber: input.installmentNumber,
          },
        },
        include: {
          credit: true,
        },
      });

      if (!installment) {
        throw new ORPCError("NOT_FOUND", { message: "Installment not found" });
      }

      if (installment.status === "PAID") {
        throw new ORPCError("BAD_REQUEST", { message: "Installment already paid" });
      }

      let paidAmountCLP: Decimal | null = null;

      if (installment.credit.currency === "UF") {
        try {
          const ufValue = await getUFValue(input.paymentDate);
          paidAmountCLP = new Decimal(input.amount).times(ufValue);
        } catch (error) {
          console.error("[Payment] Error calculating CLP equivalent:", error);
        }
      }

      const updated = await db.personalCreditInstallment.update({
        where: { id: installment.id },
        data: {
          status: "PAID",
          paidAt: parseDateOnlyUtc(input.paymentDate),
          paidAmount: new Decimal(input.amount),
          paidAmountCLP,
        },
      });

      const pendingInstallments = await db.personalCreditInstallment.count({
        where: {
          creditId: input.creditId,
          status: "PENDING",
        },
      });

      if (pendingInstallments === 0) {
        await db.personalCredit.update({
          where: { id: input.creditId },
          data: { status: "PAID" },
        });
      }

      return toPlainInstallment(updated);
    }),
};

export const personalFinanceORPCRouter = base
  .prefix("/api/orpc/personal-finance")
  .router(personalFinanceORPCRouterBase);

export const personalFinanceORPCHandler = new SuperJSONRPCHandler(personalFinanceORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.personal-finance",
      });
    }),
  ],
});

export const personalFinanceOpenAPIHandler = new OpenAPIHandler(personalFinanceORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Personal Finance oRPC",
          description: "Contratos oRPC/OpenAPI para créditos personales.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.personal-finance",
      });
    }),
  ],
});

export type PersonalFinanceORPCRouter = typeof personalFinanceORPCRouter;
