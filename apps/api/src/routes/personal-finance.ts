import { authDb } from "@finanzas/db";
import { zValidator } from "@hono/zod-validator";
import { Decimal } from "decimal.js";
import { Hono } from "hono";
import { z } from "zod";
import { createAuthContext, getSessionUser } from "../auth";

export const personalFinanceRoutes = new Hono();

// Middleware to get authenticated DB client
async function getAuthDb(c: any) {
  const user = await getSessionUser(c);
  const authContext = createAuthContext(user);
  if (!authContext) throw new Error("Unauthorized");
  return authDb.$setAuth(authContext);
}

// Schemas
const createCreditSchema = z.object({
  bankName: z.string().min(1),
  creditNumber: z.string().min(1),
  description: z.string().optional(),
  totalAmount: z.number().positive(),
  currency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  interestRate: z.number().optional(),
  startDate: z.coerce.date(), // Accepts ISO string or Date object
  totalInstallments: z.number().int().positive(),
  installments: z
    .array(
      z.object({
        installmentNumber: z.number().int(),
        dueDate: z.coerce.date(),
        amount: z.number(),
        capitalAmount: z.number().optional(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      }),
    )
    .optional(), // Optional if we calculate them, but for now let's assume UI sends them or we generate simple ones
});

const payInstallmentSchema = z.object({
  paymentDate: z.coerce.date().default(() => new Date()),
  amount: z.number().positive(), // Amount actually paid
});

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
  return c.json(credits);
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

  if (!credit) return c.json({ error: "Credit not found" }, 404);
  return c.json(credit);
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
      startDate: data.startDate,
      totalInstallments: data.totalInstallments,
      status: "ACTIVE",
      installments: {
        create: data.installments?.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
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

  return c.json(newCredit, 201);
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

    // Find the installment

    const installment = await db.personalCreditInstallment.findUnique({
      where: {
        creditId_installmentNumber: {
          creditId,
          installmentNumber,
        },
      },
    });

    if (!installment) {
      return c.json({ error: "Installment not found" }, 404);
    }

    if (installment.status === "PAID") {
      return c.json({ error: "Installment already paid" }, 400);
    }

    // Update

    const updated = await db.personalCreditInstallment.update({
      where: { id: installment.id },
      data: {
        status: "PAID",
        paidAt: paymentDate,
        paidAmount: new Decimal(amount),
      },
    });

    // Check if all installments are paid to close the credit?
    // Optional Business Logic:

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

    return c.json(updated);
  },
);

// DELETE /credits/:id
personalFinanceRoutes.delete("/credits/:id", async (c) => {
  const db = await getAuthDb(c);
  const id = Number(c.req.param("id"));

  await db.personalCredit.delete({
    where: { id },
  });

  return c.json({ success: true });
});
