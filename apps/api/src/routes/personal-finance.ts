import { authDb } from "@finanzas/db";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { Decimal } from "decimal.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import { createAuthContext, getSessionUser } from "../auth";
import { zValidator } from "../lib/zod-validator";
import { getUFValue } from "../services/cmf-uf";
import { reply } from "../utils/reply";

export const personalFinanceRoutes = new Hono();
dayjs.extend(utc);

// Middleware to get authenticated DB client
async function getAuthDb(c: Context) {
  const user = await getSessionUser(c);
  const authContext = createAuthContext(user);
  if (!authContext) {
    throw new Error("Unauthorized");
  }
  return authDb.$setAuth(authContext);
}

// Schemas
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createCreditSchema = z.object({
  bankName: z.string().min(1),
  creditNumber: z.string().min(1),
  description: z.string().optional(),
  totalAmount: z.number().positive(),
  currency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  interestRate: z.number().optional(),
  startDate: dateOnlySchema,
  totalInstallments: z.number().int().positive(),
  installments: z
    .array(
      z.object({
        installmentNumber: z.number().int(),
        dueDate: dateOnlySchema,
        amount: z.number(),
        capitalAmount: z.number().optional(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      }),
    )
    .optional(), // Optional if we calculate them, but for now let's assume UI sends them or we generate simple ones
});

const payInstallmentSchema = z.object({
  paymentDate: dateOnlySchema.default(() => dayjs().format("YYYY-MM-DD")),
  amount: z.number().positive(), // Amount actually paid
});

function parseDateOnlyUtc(value: string): Date {
  return dayjs.utc(value, "YYYY-MM-DD", true).toDate();
}

// Routes

// GET /credits - List all active credits
personalFinanceRoutes.get("/credits", async (c) => {
  const db = await getAuthDb(c);

  const credits = await db.personalCredit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
        take: 1, // Get next installment?
      },
    },
  });
  return reply(c, credits);
});

// GET /credits/:id - Get credit details with all installments
personalFinanceRoutes.get("/credits/:id", async (c) => {
  const db = await getAuthDb(c);
  const id = Number(c.req.param("id"));

  const credit = await db.personalCredit.findUnique({
    where: { id },
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });

  if (!credit) {
    return reply(c, { error: "Credit not found" }, 404);
  }
  return reply(c, credit);
});

// POST /credits - Create new credit
personalFinanceRoutes.post("/credits", zValidator("json", createCreditSchema), async (c) => {
  const db = await getAuthDb(c);
  const data = c.req.valid("json");

  // If installments are provided, use them. Otherwise we might need logic to generate them.
  // For MVP Phase 1, we assume frontend provides the schedule or we just create header.
  // Let's enforce installments for now to ensure data completeness, or handle empty.

  // Transactional create

  const newCredit = await db.personalCredit.create({
    data: {
      bankName: data.bankName,
      creditNumber: data.creditNumber,
      description: data.description,
      totalAmount: new Decimal(data.totalAmount),
      currency: data.currency,
      interestRate: data.interestRate ? new Decimal(data.interestRate) : undefined,
      startDate: parseDateOnlyUtc(data.startDate),
      totalInstallments: data.totalInstallments,
      status: "ACTIVE",
      installments: {
        create: data.installments?.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: parseDateOnlyUtc(inst.dueDate),
          amount: new Decimal(inst.amount),
          capitalAmount: inst.capitalAmount ? new Decimal(inst.capitalAmount) : undefined,
          interestAmount: inst.interestAmount ? new Decimal(inst.interestAmount) : undefined,
          otherCharges: inst.otherCharges ? new Decimal(inst.otherCharges) : undefined,
          status: "PENDING",
        })),
      },
    },
    include: {
      installments: true,
    },
  });

  return reply(c, newCredit, 201);
});

// POST /credits/:id/installments/:number/pay - Pay an installment
personalFinanceRoutes.post(
  "/credits/:id/installments/:number/pay",
  zValidator("json", payInstallmentSchema),
  async (c) => {
    const db = await getAuthDb(c);
    const creditId = Number(c.req.param("id"));
    const installmentNumber = Number(c.req.param("number"));
    const { paymentDate, amount } = c.req.valid("json");

    // Find the installment and credit (need credit.currency)
    const installment = await db.personalCreditInstallment.findUnique({
      where: {
        creditId_installmentNumber: {
          creditId,
          installmentNumber,
        },
      },
      include: {
        credit: true, // Include credit to get currency
      },
    });

    if (!installment) {
      return reply(c, { error: "Installment not found" }, 404);
    }

    if (installment.status === "PAID") {
      return reply(c, { error: "Installment already paid" }, 400);
    }

    // Calculate CLP equivalent if credit is in UF
    let paidAmountCLP: Decimal | null = null;

    if (installment.credit.currency === "UF") {
      try {
        const ufValue = await getUFValue(paymentDate);
        paidAmountCLP = new Decimal(amount).times(ufValue);
        console.log(
          `[Payment] UF payment: ${amount} UF x ${ufValue} = ${paidAmountCLP.toString()} CLP`,
        );
      } catch (error) {
        console.error("[Payment] Error calculating CLP equivalent:", error);
        // Continue without CLP value if API fails
      }
    }

    // Update installment
    const updated = await db.personalCreditInstallment.update({
      where: { id: installment.id },
      data: {
        status: "PAID",
        paidAt: parseDateOnlyUtc(paymentDate),
        paidAmount: new Decimal(amount),
        paidAmountCLP,
      },
    });

    // Check if all installments are paid to close the credit
    const pendingInstallments = await db.personalCreditInstallment.count({
      where: {
        creditId,
        status: "PENDING",
      },
    });

    if (pendingInstallments === 0) {
      await db.personalCredit.update({
        where: { id: creditId },
        data: { status: "PAID" },
      });
    }

    return reply(c, updated);
  },
);

// DELETE /credits/:id
personalFinanceRoutes.delete("/credits/:id", async (c) => {
  const db = await getAuthDb(c);
  const id = Number(c.req.param("id"));

  await db.personalCredit.delete({
    where: { id },
  });

  return reply(c, { success: true });
});

// POST /credits/backfill-uf-clp - Backfill paidAmountCLP for existing payments
personalFinanceRoutes.post("/credits/backfill-uf-clp", async (c) => {
  const db = await getAuthDb(c);

  // Find all paid installments in UF credits without paidAmountCLP
  const creditsUF = await db.personalCredit.findMany({
    where: { currency: "UF" },
    include: {
      installments: {
        where: {
          status: "PAID",
          paidAt: { not: null },
        },
      },
    },
  });

  const results = [];

  for (const credit of creditsUF) {
    for (const installment of credit.installments || []) {
      if (installment.paidAt && installment.paidAmount) {
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
            ufValue,
            paidAmountCLP: Number(paidAmountCLP),
            paymentDate,
          });

          console.log(
            `[Backfill] Credit ${credit.id} Installment ${installment.installmentNumber}: ${installment.paidAmount} UF x ${ufValue} = ${paidAmountCLP} CLP`,
          );
        } catch (error) {
          console.error(`[Backfill] Error processing installment ${installment.id}:`, error);
        }
      }
    }
  }

  return reply(c, { processed: results.length, results });
});
