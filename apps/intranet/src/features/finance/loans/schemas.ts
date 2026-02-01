import { z } from "zod";

export const LoanSummarySchema = z.strictObject({
  borrower_name: z.string(),
  borrower_type: z.enum(["COMPANY", "PERSON"]),
  created_at: z.string(),
  frequency: z.enum(["BIWEEKLY", "MONTHLY", "WEEKLY"]),
  id: z.number(),
  interest_rate: z.number(),
  interest_type: z.enum(["COMPOUND", "SIMPLE"]),
  notes: z.string().nullable(),
  paid_installments: z.number(),
  pending_installments: z.number(),
  principal_amount: z.number(),
  public_id: z.string(),
  remaining_amount: z.number(),
  start_date: z.string(),
  status: z.enum(["ACTIVE", "COMPLETED", "DEFAULTED"]),
  title: z.string(),
  total_expected: z.number(),
  total_installments: z.number(),
  total_paid: z.number(),
  updated_at: z.string(),
});

const LoanScheduleTransactionSchema = z.strictObject({
  amount: z.number().nullable(),
  description: z.string().nullable(),
  id: z.number(),
  timestamp: z.string(),
});

export const LoanScheduleSchema = z.strictObject({
  created_at: z.string(),
  due_date: z.string(),
  expected_amount: z.number(),
  expected_interest: z.number(),
  expected_principal: z.number(),
  id: z.number(),
  installment_number: z.number(),
  loan_id: z.number(),
  paid_amount: z.number().nullable(),
  paid_date: z.string().nullable(),
  status: z.enum(["OVERDUE", "PAID", "PARTIAL", "PENDING", "SKIPPED"]),
  transaction: z.union([LoanScheduleTransactionSchema, z.null()]).optional(),
  transaction_id: z.number().nullable(),
  updated_at: z.string(),
});

export const LoanDetailResponseSchema = z.strictObject({
  loan: LoanSummarySchema,
  schedules: z.array(LoanScheduleSchema),
  status: z.literal("ok"),
  summary: z.strictObject({
    paid_installments: z.number(),
    pending_installments: z.number(),
    remaining_amount: z.number(),
    total_expected: z.number(),
    total_paid: z.number(),
  }),
});

export const LoanListResponseSchema = z.strictObject({
  loans: z.array(LoanSummarySchema),
  status: z.literal("ok"),
});

export const LoanScheduleResponseSchema = z.strictObject({
  schedule: LoanScheduleSchema,
  status: z.literal("ok"),
});
