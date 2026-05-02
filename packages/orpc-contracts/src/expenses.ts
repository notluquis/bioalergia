import { oc } from "@orpc/contract";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const expenseScopeSchema = z.enum(["BIOALERGIA", "PERSONAL"]);
export const expenseStatusSchema = z.enum(["PENDING", "PAID", "OVERDUE", "SKIPPED"]);
export const expenseSourceSchema = z.enum(["MANUAL", "TEMPLATE", "TRANSACTION"]);
export const expenseRecurrenceSchema = z.enum(["MONTHLY", "ONE_TIME"]);

export type ExpenseScope = z.infer<typeof expenseScopeSchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type ExpenseSource = z.infer<typeof expenseSourceSchema>;
export type ExpenseRecurrence = z.infer<typeof expenseRecurrenceSchema>;

// ─── ExpenseService schemas ───────────────────────────────────────────────────

export const expenseServicePayloadSchema = z.object({
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  category: z.string().nullable().optional(),
  defaultAmount: z.number().nullable().optional(),
  detail: z.string().nullable().optional(),
  dueDateRule: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isFixed: z.boolean().optional(),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  recurrence: expenseRecurrenceSchema.optional(),
  scope: expenseScopeSchema,
  startDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const expenseServiceItemSchema = z.object({
  billingDay: z.number().int().nullable(),
  category: z.string().nullable(),
  createdAt: z.coerce.date(),
  defaultAmount: z.number().nullable(),
  detail: z.string().nullable(),
  dueDateRule: z.string().nullable(),
  endDate: z.coerce.date().nullable(),
  id: z.number().int(),
  isActive: z.boolean(),
  isFixed: z.boolean(),
  name: z.string(),
  notes: z.string().nullable(),
  publicId: z.string(),
  recurrence: expenseRecurrenceSchema,
  scope: expenseScopeSchema,
  startDate: z.coerce.date().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.coerce.date(),
});

export const listExpenseServicesInputSchema = z.object({
  isActive: z.boolean().optional(),
  scope: expenseScopeSchema.optional(),
});

export const expenseServiceListResponseSchema = z.object({
  services: z.array(expenseServiceItemSchema),
  status: z.literal("ok"),
});

export const expenseServiceDetailResponseSchema = z.object({
  service: expenseServiceItemSchema,
  status: z.literal("ok"),
});

// ─── Expense schemas ──────────────────────────────────────────────────────────

export const expensePayloadSchema = z.object({
  amountExpected: z.number(),
  category: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  expenseMonth: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  scope: expenseScopeSchema,
  serviceId: z.number().int().nullable().optional(),
  source: expenseSourceSchema.optional(),
  status: expenseStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const listExpensesInputSchema = z.object({
  from: z.string().optional(),
  scope: expenseScopeSchema.optional(),
  serviceId: z.number().int().nullable().optional(),
  status: expenseStatusSchema.optional(),
  to: z.string().optional(),
});

export const statsExpensesInputSchema = z.object({
  from: z.string().optional(),
  groupBy: z.enum(["month", "quarter", "year"]).optional(),
  scope: expenseScopeSchema.optional(),
  to: z.string().optional(),
});

export const detailExpenseInputSchema = z.object({
  publicId: z.string().min(1),
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

export const generateExpensesInputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  overwrite: z.boolean().optional(),
});

export const expenseTransactionSchema = z.object({
  amount: z.number(),
  description: z.string().nullable(),
  direction: z.string(),
  timestamp: z.coerce.date(),
  transactionId: z.number().int(),
});

export const expenseItemSchema = z.object({
  amountApplied: z.number(),
  amountExpected: z.number(),
  category: z.string().nullable(),
  createdAt: z.coerce.date(),
  detail: z.string().nullable(),
  dueDate: z.coerce.date().nullable(),
  expenseMonth: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  publicId: z.string(),
  scope: expenseScopeSchema,
  serviceId: z.number().int().nullable(),
  source: expenseSourceSchema,
  status: expenseStatusSchema,
  tags: z.array(z.string()),
  transactionCount: z.number().int(),
  updatedAt: z.coerce.date(),
});

export const expenseDetailSchema = expenseItemSchema.extend({
  transactions: z.array(expenseTransactionSchema),
});

export const expenseDetailResponseSchema = z.object({
  expense: expenseDetailSchema,
  status: z.literal("ok"),
});

export const expenseLinkResponseSchema = z.object({
  message: z.string().optional(),
  status: z.literal("ok"),
});

export const expenseStatsRowSchema = z.object({
  expenseCount: z.number().int(),
  period: z.string(),
  scope: expenseScopeSchema.nullable(),
  totalApplied: z.number(),
  totalExpected: z.number(),
});

export const expensesListResponseSchema = z.object({
  expenses: z.array(expenseItemSchema),
  status: z.literal("ok"),
});

export const expensesStatsResponseSchema = z.object({
  stats: z.array(expenseStatsRowSchema),
  status: z.literal("ok"),
});

export const generateExpensesResponseSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  status: z.literal("ok"),
});

// ─── Contract ─────────────────────────────────────────────────────────────────

export const expensesContract = {
  // Expense CRUD
  create: oc
    .route({ method: "POST", path: "/" })
    .input(expensePayloadSchema)
    .output(expenseDetailResponseSchema),

  detail: oc
    .route({ method: "GET", path: "/{publicId}" })
    .input(detailExpenseInputSchema)
    .output(expenseDetailResponseSchema),

  generateFromTemplates: oc
    .route({ method: "POST", path: "/generate" })
    .input(generateExpensesInputSchema)
    .output(generateExpensesResponseSchema),

  linkTransaction: oc
    .route({ method: "POST", path: "/{publicId}/link" })
    .input(linkTransactionInputSchema)
    .output(expenseLinkResponseSchema),

  list: oc
    .route({ method: "GET", path: "/" })
    .input(listExpensesInputSchema)
    .output(expensesListResponseSchema),

  stats: oc
    .route({ method: "GET", path: "/stats" })
    .input(statsExpensesInputSchema)
    .output(expensesStatsResponseSchema),

  unlinkTransaction: oc
    .route({ method: "POST", path: "/{publicId}/unlink" })
    .input(unlinkTransactionInputSchema)
    .output(expenseLinkResponseSchema),

  update: oc
    .route({ method: "PUT", path: "/{publicId}" })
    .input(z.object({ payload: expensePayloadSchema, publicId: z.string().min(1) }))
    .output(expenseDetailResponseSchema),

  // ExpenseService CRUD
  createService: oc
    .route({ method: "POST", path: "/services" })
    .input(expenseServicePayloadSchema)
    .output(expenseServiceDetailResponseSchema),

  deleteService: oc
    .route({ method: "DELETE", path: "/services/{id}" })
    .input(z.object({ id: z.number().int() }))
    .output(z.object({ status: z.literal("ok") })),

  listServices: oc
    .route({ method: "GET", path: "/services" })
    .input(listExpenseServicesInputSchema)
    .output(expenseServiceListResponseSchema),

  updateService: oc
    .route({ method: "PUT", path: "/services/{id}" })
    .input(z.object({ id: z.number().int(), payload: expenseServicePayloadSchema }))
    .output(expenseServiceDetailResponseSchema),
};

export type ExpensesContract = typeof expensesContract;
