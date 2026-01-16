import { z } from "zod";

// Zod Schemas (mirroring backend)
export const createCreditSchema = z.object({
  bankName: z.string().min(1, "El banco es obligatorio"),
  creditNumber: z.string().min(1, "El número de crédito es obligatorio"),
  description: z.string().optional(),
  totalAmount: z.number().positive("El monto debe ser positivo"),
  currency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  interestRate: z.number().optional(),
  startDate: z.date({ required_error: "La fecha de inicio es requerida" }),
  totalInstallments: z.number().int().positive("Debe tener al menos 1 cuota"),
  installments: z
    .array(
      z.object({
        installmentNumber: z.number().int(),
        dueDate: z.date(),
        amount: z.number(),
        capitalAmount: z.number().optional(),
        interestAmount: z.number().optional(),
        otherCharges: z.number().optional(),
      })
    )
    .optional(),
});

export const payInstallmentSchema = z.object({
  paymentDate: z.date(),
  amount: z.number().positive(),
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;

// Domain Types (ZenStack models + extensions)
export interface PersonalCredit {
  id: number;
  bankName: string;
  creditNumber: string;
  description?: string | null;
  totalAmount: number; // Decimal in DB, number in JS (usually handled by serializer)
  currency: string;
  interestRate?: number | null;
  startDate: string; // ISO Date
  totalInstallments: number;
  status: "ACTIVE" | "PAID" | "REFINANCED";
  createdAt: string;
  updatedAt: string;
  installments?: PersonalCreditInstallment[];
}

export interface PersonalCreditInstallment {
  id: number;
  creditId: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  capitalAmount?: number | null;
  interestAmount?: number | null;
  otherCharges?: number | null;
  status: "PENDING" | "PAID";
  paidAt?: string | null;
  paidAmount?: number | null;
}
