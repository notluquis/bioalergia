import { oc } from "@orpc/contract";
import { z } from "zod";

export const personalFinanceDateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const personalFinanceCurrencySchema = z.enum(["CLP", "UF", "USD"]);
export const personalFinanceCreditStatusSchema = z.enum(["ACTIVE", "PAID", "REFINANCED"]);
export const personalFinanceInstallmentStatusSchema = z.enum(["PAID", "PENDING"]);

export const personalFinanceCreditIdSchema = z.object({
  id: z.number().int().positive(),
});

export const personalFinancePayInstallmentInputSchema = z.object({
  amount: z.number().positive(),
  creditId: z.number().int().positive(),
  installmentNumber: z.number().int().positive(),
  paymentDate: personalFinanceDateOnlySchema,
});

export const personalFinanceCreateCreditInputSchema = z.object({
  bankName: z.string().min(1),
  creditNumber: z.string().min(1),
  currency: personalFinanceCurrencySchema.default("CLP"),
  description: z.string().optional(),
  installments: z
    .array(
      z.object({
        amount: z.number(),
        capitalAmount: z.number().optional(),
        dueDate: personalFinanceDateOnlySchema,
        installmentNumber: z.number().int(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      })
    )
    .optional(),
  interestRate: z.number().optional(),
  startDate: personalFinanceDateOnlySchema,
  totalAmount: z.number().positive(),
  totalInstallments: z.number().int().positive(),
});

export const personalFinanceInstallmentSchema = z
  .object({
    amount: z.number(),
    capitalAmount: z.number().nullable().optional(),
    creditId: z.number().int(),
    dueDate: z.date(),
    id: z.number().int(),
    installmentNumber: z.number().int(),
    interestAmount: z.number().nullable().optional(),
    otherCharges: z.number().nullable().optional(),
    paidAmount: z.number().nullable().optional(),
    paidAmountCLP: z.number().nullable().optional(),
    paidAt: z.date().nullable().optional(),
    status: personalFinanceInstallmentStatusSchema,
  })
  .passthrough();

export const personalFinanceCreditSchema = z
  .object({
    bankName: z.string(),
    createdAt: z.date(),
    creditNumber: z.string(),
    currency: personalFinanceCurrencySchema,
    description: z.string().nullable().optional(),
    id: z.number().int(),
    installments: z.array(personalFinanceInstallmentSchema).optional(),
    interestRate: z.number().nullable().optional(),
    nextPaymentAmount: z.number().nullable().optional(),
    nextPaymentDate: z.date().nullable().optional(),
    remainingAmount: z.number().nullable().optional(),
    startDate: z.date(),
    status: personalFinanceCreditStatusSchema,
    totalAmount: z.number(),
    totalInstallments: z.number().int(),
    updatedAt: z.date(),
  })
  .passthrough();

export const personalFinanceCreditsResponseSchema = z.array(personalFinanceCreditSchema);
export const personalFinanceDeleteCreditResponseSchema = z.object({
  success: z.boolean(),
});
export const personalFinanceBackfillResponseSchema = z.object({
  processed: z.number().int(),
  results: z.array(
    z.object({
      creditId: z.number().int(),
      installmentNumber: z.number().int(),
      paidAmount: z.number(),
      paidAmountCLP: z.number(),
      paymentDate: z.string(),
      ufValue: z.number(),
    })
  ),
});

export const personalFinanceContract = {
  backfillUfClp: oc
    .route({ method: "POST", path: "/credits/backfill-uf-clp" })
    .output(personalFinanceBackfillResponseSchema),
  createCredit: oc
    .route({ method: "POST", path: "/credits" })
    .input(personalFinanceCreateCreditInputSchema)
    .output(personalFinanceCreditSchema),
  deleteCredit: oc
    .route({ method: "DELETE", path: "/credits/{id}" })
    .input(personalFinanceCreditIdSchema)
    .output(personalFinanceDeleteCreditResponseSchema),
  getCredit: oc
    .route({ method: "GET", path: "/credits/{id}" })
    .input(personalFinanceCreditIdSchema)
    .output(personalFinanceCreditSchema),
  listCredits: oc
    .route({ method: "GET", path: "/credits" })
    .output(personalFinanceCreditsResponseSchema),
  payInstallment: oc
    .route({ method: "POST", path: "/credits/{creditId}/installments/{installmentNumber}/pay" })
    .input(personalFinancePayInstallmentInputSchema)
    .output(personalFinanceInstallmentSchema),
};

export type PersonalFinanceContract = typeof personalFinanceContract;
