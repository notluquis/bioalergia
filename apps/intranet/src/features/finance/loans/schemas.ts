import { z } from "zod";

export const LoanSummarySchema = z.strictObject({
  borrower_name: z.string(),
  borrower_type: z.enum(["COMPANY", "PERSON"]),
  created_at: z.coerce.date(),
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
  start_date: z.coerce.date(),
  status: z.enum(["ACTIVE", "COMPLETED", "DEFAULTED"]),
  title: z.string(),
  total_expected: z.number(),
  total_installments: z.number(),
  total_paid: z.number(),
  updated_at: z.coerce.date(),
});

const LoanScheduleTransactionSchema = z.strictObject({
  amount: z.number().nullable(),
  description: z.string().nullable(),
  id: z.number(),
  timestamp: z.coerce.date(),
});

export const LoanScheduleSchema = z.strictObject({
  created_at: z.coerce.date(),
  due_date: z.coerce.date(),
  expected_amount: z.number(),
  expected_interest: z.number(),
  expected_principal: z.number(),
  id: z.number(),
  installment_number: z.number(),
  loan_id: z.number(),
  paid_amount: z.number().nullable(),
  paid_date: z.coerce.date().nullable(),
  status: z.enum(["OVERDUE", "PAID", "PARTIAL", "PENDING", "SKIPPED"]),
  transaction: z.union([LoanScheduleTransactionSchema, z.null()]).optional(),
  transaction_id: z.number().nullable(),
  updated_at: z.coerce.date(),
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
