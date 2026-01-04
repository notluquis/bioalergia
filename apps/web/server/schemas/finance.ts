/**
 * Finance & Transactions schemas
 */
import { z } from "zod";

import { validateRut } from "../lib/rut.js";
import { clpInt, dateRegex, moneySchema } from "./shared.js";

export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(2000).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  description: z.string().optional(),
  sourceId: z.string().optional(),
  externalReference: z.string().optional(),
  transactionType: z.string().optional(),
  status: z.string().optional(),
  includeAmounts: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
  search: z.string().optional(),
});

export const statsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const participantLeaderboardQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  mode: z.enum(["combined", "incoming", "outgoing"]).optional(),
});

export const counterpartPayloadSchema = z.object({
  rut: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .refine((val) => !val || validateRut(val), { message: "RUT inválido" }),
  name: z.string().min(1).max(191),
  personType: z.enum(["PERSON", "COMPANY", "OTHER"]).default("OTHER"),
  category: z
    .enum(["SUPPLIER", "PATIENT", "EMPLOYEE", "PARTNER", "RELATED", "OTHER", "CLIENT", "LENDER", "OCCASIONAL"])
    .optional()
    .default("SUPPLIER"),
  email: z.string().email().optional().nullable(),
  employeeEmail: z.string().email().optional().nullable(),
  employeeId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const counterpartAccountPayloadSchema = z.object({
  accountIdentifier: z.string().trim().min(1).max(191),
  bankName: z.string().max(191).optional().nullable(),
  accountType: z.string().max(64).optional().nullable(),
  holder: z.string().max(191).optional().nullable(),
  concept: z.string().max(191).optional().nullable(),
  metadata: z
    .object({
      bankAccountNumber: z.string().max(191).optional().nullable(),
      withdrawId: z.string().max(191).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const counterpartAccountUpdateSchema = counterpartAccountPayloadSchema.partial().extend({
  concept: z.string().max(191).optional().nullable(),
  metadata: counterpartAccountPayloadSchema.shape.metadata.optional(),
});

export const balancesQuerySchema = z.object({
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
});

export const balanceUpsertSchema = z.object({
  date: z.string().regex(dateRegex, "Fecha inválida"),
  balance: z.coerce.number(),
  note: z.string().max(255).optional(),
});

export const productionBalanceQuerySchema = z.object({
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
});

export const productionBalancePayloadSchema = z.object({
  date: z.string().regex(dateRegex, "Fecha inválida"),
  ingresoTarjetas: clpInt,
  ingresoTransferencias: clpInt,
  ingresoEfectivo: clpInt,
  gastosDiarios: z.coerce.number().int().safe().default(0),
  otrosAbonos: clpInt,
  consultas: z.coerce.number().int().min(0).default(0),
  controles: z.coerce.number().int().min(0).default(0),
  tests: z.coerce.number().int().min(0).default(0),
  vacunas: z.coerce.number().int().min(0).default(0),
  licencias: z.coerce.number().int().min(0).default(0),
  roxair: z.coerce.number().int().min(0).default(0),
  comentarios: z.string().max(600).optional().nullable(),
  status: z.enum(["DRAFT", "FINAL"]).optional().default("DRAFT"),
  reason: z.string().max(255).optional().nullable(),
});

export const loanCreateSchema = z.object({
  title: z.string().min(1).max(191),
  borrowerName: z.string().min(1).max(191),
  borrowerType: z.enum(["PERSON", "COMPANY"]).default("PERSON"),
  principalAmount: moneySchema,
  interestRate: z.coerce.number().min(0),
  interestType: z.enum(["SIMPLE", "COMPOUND"]).default("SIMPLE"),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  totalInstallments: z.coerce.number().int().positive().max(360),
  startDate: z.string().regex(dateRegex),
  notes: z.string().max(500).optional().nullable(),
  generateSchedule: z.boolean().optional().default(true),
});

export const loanScheduleRegenerateSchema = z.object({
  totalInstallments: z.coerce.number().int().positive().max(360).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  interestRate: z.coerce.number().min(0).optional(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
});

export const loanPaymentSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  paidAmount: moneySchema,
  paidDate: z.string().regex(dateRegex),
});

// Monthly expenses
const monthlyExpenseSourceEnum = z.enum(["MANUAL", "TRANSACTION", "SERVICE"]);
const monthlyExpenseStatusEnum = z.enum(["OPEN", "CLOSED"]);

export const monthlyExpenseSchema = z.object({
  name: z.string().min(1).max(191),
  category: z.string().max(120).optional().nullable(),
  amountExpected: z.coerce.number().min(0),
  expenseDate: z.string().regex(dateRegex, "Fecha inválida"),
  notes: z.string().max(500).optional().nullable(),
  source: monthlyExpenseSourceEnum.optional(),
  serviceId: z.coerce.number().int().positive().optional().nullable(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  status: monthlyExpenseStatusEnum.optional(),
});

export const monthlyExpenseLinkSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  amount: z.coerce.number().min(0).optional(),
});

export const monthlyExpenseStatsSchema = z.object({
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
  groupBy: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
  category: z.string().optional().nullable(),
});
