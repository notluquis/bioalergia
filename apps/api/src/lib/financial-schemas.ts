import { z } from "zod";

// Shared helpers
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const moneySchema = z.coerce
  .number()
  .min(0, "Amount must be positive")
  .transform((val) => Number(val.toFixed(2)));

export const clpInt = z.coerce.number().int().min(0).default(0);

// Transactions Schemas
export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(2000).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  description: z.string().optional(),
  sourceId: z.string().optional(),
  externalReference: z.string().optional(),
  transactionType: z.string().optional(),
  status: z.string().optional(),
  includeAmounts: z.enum(["true", "false"]).optional(),
  includeTotal: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
  search: z.string().optional(),
});

// Loans Schemas
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

// Balances & Production
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
  gastosDiarios: z.coerce.number().int().default(0),
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
