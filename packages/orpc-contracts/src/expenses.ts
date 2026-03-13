import { oc } from "@orpc/contract";
import { z } from "zod";

export const listExpensesInputSchema = z.object({
  from: z.string().optional(),
  serviceId: z.number().int().nullable().optional(),
  status: z.string().optional(),
  to: z.string().optional(),
});

export const statsExpensesInputSchema = z.object({
  category: z.string().nullable().optional(),
  from: z.string().optional(),
  groupBy: z.enum(["day", "month", "quarter", "week", "year"]).optional(),
  to: z.string().optional(),
});

export const detailExpenseInputSchema = z.object({
  publicId: z.string().min(1),
});

export const expensePayloadSchema = z.object({
  amountExpected: z.number(),
  category: z.string().nullable().optional(),
  expenseDate: z.string(),
  name: z.string(),
  notes: z.string().nullable().optional(),
  serviceId: z.number().int().nullable().optional(),
  source: z.enum(["MANUAL", "SERVICE", "TRANSACTION"]).optional(),
  status: z.enum(["CLOSED", "OPEN"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const linkTransactionInputSchema = z.object({
  amount: z.number().optional(),
  publicId: z.string().min(1),
  transactionId: z.number().int(),
});

export const unlinkTransactionInputSchema = z.object({
  publicId: z.string().min(1),
  transactionId: z.number().int(),
});

export const placeholderExpenseResponseSchema = z.object({
  message: z.string(),
  status: z.literal("error"),
});

export const expensesListResponseSchema = z.object({
  expenses: z.array(z.unknown()),
  status: z.literal("ok"),
});

export const expensesStatsResponseSchema = z.object({
  stats: z.array(z.unknown()),
  status: z.literal("ok"),
});

export const expensesContract = {
  create: oc.route({ method: "POST", path: "/" }).input(expensePayloadSchema).output(placeholderExpenseResponseSchema),
  detail: oc.route({ method: "GET", path: "/{publicId}" }).input(detailExpenseInputSchema).output(placeholderExpenseResponseSchema),
  linkTransaction: oc.route({ method: "POST", path: "/{publicId}/link" }).input(linkTransactionInputSchema).output(placeholderExpenseResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).input(listExpensesInputSchema).output(expensesListResponseSchema),
  stats: oc.route({ method: "GET", path: "/stats" }).input(statsExpensesInputSchema).output(expensesStatsResponseSchema),
  unlinkTransaction: oc.route({ method: "POST", path: "/{publicId}/unlink" }).input(unlinkTransactionInputSchema).output(placeholderExpenseResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{publicId}" })
    .input(z.object({ payload: expensePayloadSchema, publicId: z.string().min(1) }))
    .output(placeholderExpenseResponseSchema),
};

export type ExpensesContract = typeof expensesContract;
