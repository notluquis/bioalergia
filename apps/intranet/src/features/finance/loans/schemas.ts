import { z } from "zod";
import { zDateString } from "@/lib/api-validate";

export const LoanSummarySchema = z.strictObject({
  borrower_name: z.string(),
  borrower_type: z.enum(["COMPANY", "PERSON"]),
  counterpart: z
    .strictObject({
      bankAccountHolder: z.string(),
      category: z.string(),
      id: z.number(),
      identificationNumber: z.string(),
    })
    .nullable()
    .optional(),
  counterpart_id: z.number().nullable(),
  created_at: z.coerce.date(),
  frequency: z.enum(["BIWEEKLY", "IRREGULAR", "MONTHLY", "WEEKLY"]),
  id: z.number(),
  interest_rate: z.number(),
  interest_type: z.enum(["COMPOUND", "SIMPLE"]),
  notes: z.string().nullable(),
  paid_installments: z.number(),
  pending_installments: z.number(),
  principal_amount: z.number(),
  public_id: z.string(),
  remaining_amount: z.number(),
  start_date: zDateString,
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

const LoanSchedulePaymentSchema = z.strictObject({
  amount: z.number(),
  id: z.number(),
  kind: z.enum(["ADJUSTMENT", "DISCOUNT", "PAYMENT"]),
  note: z.string().nullable(),
  paid_date: zDateString,
  transaction: z.union([LoanScheduleTransactionSchema, z.null()]).optional(),
  transaction_id: z.number().nullable(),
});

const LoanSourceSchema = z.strictObject({
  disbursement_date: zDateString.nullable(),
  fee_amount: z.number(),
  fixed_interest_rate: z.number(),
  id: z.number(),
  interest_amount: z.number(),
  label: z.string(),
  note: z.string().nullable(),
  principal_amount: z.number(),
  source_type: z.enum(["BANK_CREDIT", "CREDIT_CARD", "OTHER", "PERSON_LOAN", "TRANSFER"]),
  total_amount: z.number(),
});

export const LoanScheduleSchema = z.strictObject({
  created_at: z.coerce.date(),
  due_date: zDateString,
  expected_amount: z.number(),
  expected_interest: z.number(),
  expected_principal: z.number(),
  id: z.number(),
  installment_number: z.number(),
  loan_id: z.number(),
  note: z.string().nullable(),
  paid_amount: z.number().nullable(),
  paid_date: zDateString.nullable(),
  payments: z.array(LoanSchedulePaymentSchema).optional(),
  status: z.enum(["OVERDUE", "PAID", "PARTIAL", "PENDING", "SKIPPED"]),
  transaction: z.union([LoanScheduleTransactionSchema, z.null()]).optional(),
  transaction_id: z.number().nullable(),
  updated_at: z.coerce.date(),
});

export const LoanDetailResponseSchema = z.strictObject({
  loan: LoanSummarySchema,
  schedules: z.array(LoanScheduleSchema),
  sources: z.array(LoanSourceSchema).optional(),
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

export const LoanPaymentCandidateSchema = z.strictObject({
  already_linked_amount: z.number(),
  amount: z.number(),
  date: zDateString,
  days_from_due: z.number(),
  description: z.string(),
  id: z.number(),
  is_linked: z.boolean(),
  score: z.number(),
  source_id: z.string().nullable(),
});

export const LoanPaymentCandidatesResponseSchema = z.strictObject({
  candidates: z.array(LoanPaymentCandidateSchema),
  status: z.literal("ok"),
});
