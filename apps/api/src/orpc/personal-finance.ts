import { authDb } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import Decimal from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { createAuthContext, getSessionUser } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { getUFValue } from "../services/cmf-uf";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();
dayjs.extend(utc);

type PersonalFinanceORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PersonalFinanceORPCContext>();
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decimalOutputSchema = z.union([z.number(), z.instanceof(Decimal)]);

const creditIdSchema = z.object({
  id: z.number().int().positive(),
});

const payInstallmentInputSchema = z.object({
  amount: z.number().positive(),
  creditId: z.number().int().positive(),
  installmentNumber: z.number().int().positive(),
  paymentDate: dateOnlySchema.default(() => dayjs().format("YYYY-MM-DD")),
});

const createCreditInputSchema = z.object({
  bankName: z.string().min(1),
  creditNumber: z.string().min(1),
  currency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  description: z.string().optional(),
  installments: z
    .array(
      z.object({
        amount: z.number(),
        capitalAmount: z.number().optional(),
        dueDate: dateOnlySchema,
        installmentNumber: z.number().int(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      }),
    )
    .optional(),
  interestRate: z.number().optional(),
  startDate: dateOnlySchema,
  totalAmount: z.number().positive(),
  totalInstallments: z.number().int().positive(),
});

const installmentSchema = z
  .object({
    amount: decimalOutputSchema,
    capitalAmount: decimalOutputSchema.nullable().optional(),
    creditId: z.number().int(),
    dueDate: z.date(),
    id: z.number().int(),
    installmentNumber: z.number().int(),
    interestAmount: decimalOutputSchema.nullable().optional(),
    otherCharges: decimalOutputSchema.nullable().optional(),
    paidAmount: decimalOutputSchema.nullable().optional(),
    paidAmountCLP: decimalOutputSchema.nullable().optional(),
    paidAt: z.date().nullable().optional(),
    status: z.enum(["PAID", "PENDING"]),
  })
  .passthrough();

const creditSchema = z
  .object({
    bankName: z.string(),
    createdAt: z.date(),
    creditNumber: z.string(),
    currency: z.string(),
    description: z.string().nullable().optional(),
    id: z.number().int(),
    installments: z.array(installmentSchema).optional(),
    interestRate: decimalOutputSchema.nullable().optional(),
    nextPaymentAmount: decimalOutputSchema.nullable().optional(),
    nextPaymentDate: z.date().nullable().optional(),
    remainingAmount: decimalOutputSchema.nullable().optional(),
    startDate: z.date(),
    status: z.enum(["ACTIVE", "PAID", "REFINANCED"]),
    totalAmount: decimalOutputSchema,
    totalInstallments: z.number().int(),
    updatedAt: z.date(),
  })
  .passthrough();

const creditsResponseSchema = z.array(creditSchema);
const creditResponseSchema = creditSchema;
const deleteCreditResponseSchema = z.object({
  success: z.boolean(),
});
const backfillResponseSchema = z.object({
  processed: z.number().int(),
  results: z.array(
    z.object({
      creditId: z.number().int(),
      installmentNumber: z.number().int(),
      paidAmount: z.number(),
      paidAmountCLP: z.number(),
      paymentDate: z.string(),
      ufValue: z.number(),
    }),
  ),
});

function parseDateOnlyUtc(value: string): Date {
  return dayjs.utc(value, "YYYY-MM-DD", true).toDate();
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
      summary: "Backfill UF paid amounts in CLP",
      tags: ["Personal Finance"],
    })
    .output(backfillResponseSchema)
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

      const results: z.infer<typeof backfillResponseSchema>["results"] = [];

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
      summary: "Create personal credit",
      tags: ["Personal Finance"],
    })
    .input(createCreditInputSchema)
    .output(creditResponseSchema)
    .handler(async ({ context, input }) => {
      const db = await getAuthorizedDb(context.hono);

      return db.personalCredit.create({
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
            create: input.installments?.map((installment) => ({
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
            })),
          },
        },
        include: {
          installments: true,
        },
      });
    }),

  deleteCredit: base
    .route({
      method: "DELETE",
      path: "/credits/{id}",
      summary: "Delete personal credit",
      tags: ["Personal Finance"],
    })
    .input(creditIdSchema)
    .output(deleteCreditResponseSchema)
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
      summary: "Get personal credit detail",
      tags: ["Personal Finance"],
    })
    .input(creditIdSchema)
    .output(creditResponseSchema)
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

      return credit;
    }),

  listCredits: base
    .route({
      method: "GET",
      path: "/credits",
      summary: "List personal credits",
      tags: ["Personal Finance"],
    })
    .output(creditsResponseSchema)
    .handler(async ({ context }) => {
      const db = await getAuthorizedDb(context.hono);

      return db.personalCredit.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          installments: {
            orderBy: { installmentNumber: "asc" },
          },
        },
      });
    }),

  payInstallment: base
    .route({
      method: "POST",
      path: "/credits/{creditId}/installments/{installmentNumber}/pay",
      summary: "Pay personal credit installment",
      tags: ["Personal Finance"],
    })
    .input(payInstallmentInputSchema)
    .output(installmentSchema)
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

      return updated;
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
