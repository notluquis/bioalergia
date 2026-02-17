import { z } from "zod";
import { zDateString } from "@/lib/api-validate";

// Zod Schemas (mirroring backend)
export const createCreditSchema = z.object({
  bankName: z.string().min(1, "El banco es obligatorio"),
  creditNumber: z.string().min(1, "El número de crédito es obligatorio"),
  currency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  description: z.string().optional(),
  installments: z
    .array(
      z.object({
        amount: z.number(),
        capitalAmount: z.number().optional(),
        dueDate: zDateString,
        installmentNumber: z.number().int(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      }),
    )
    .optional(),
  interestRate: z.number().optional(),
  startDate: zDateString,
  totalAmount: z.number().positive("El monto debe ser positivo"),
  totalInstallments: z.number().int().positive("Debe tener al menos 1 cuota"),
});

export const payInstallmentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: zDateString,
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;

// Domain Types (ZenStack models + extensions)
export interface PersonalCredit {
  bankName: string;
  createdAt: Date;
  creditNumber: string;
  currency: string;
  description?: null | string;
  id: number;
  installments?: PersonalCreditInstallment[];
  institution?: null | string;
  interestRate?: null | number;
  nextPaymentAmount?: null | number;
  nextPaymentDate?: null | string;
  // Calculated/extended fields
  remainingAmount?: number;
  startDate: string; // YYYY-MM-DD

  status: "ACTIVE" | "PAID" | "REFINANCED";
  totalAmount: number; // Decimal in DB, number in JS (usually handled by serializer)
  totalInstallments: number;
  updatedAt: Date;
}

export interface PersonalCreditInstallment {
  amount: number;
  capitalAmount?: null | number;
  creditId: number;
  dueDate: string;
  id: number;
  installmentNumber: number;
  interestAmount?: null | number;
  otherCharges?: null | number;
  paidAmount?: null | number;
  paidAmountCLP?: null | number; // CLP equivalent for UF credits
  paidAt?: null | string;
  status: "PAID" | "PENDING";
}
