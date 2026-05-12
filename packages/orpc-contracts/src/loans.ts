import { oc } from "@orpc/contract";
import { z } from "zod";

export const loanStatusSchema = z.enum(["ACTIVE", "COMPLETED", "DEFAULTED"]);
export const loanBorrowerTypeSchema = z.enum(["COMPANY", "PERSON"]);
export const loanFrequencySchema = z.enum(["BIWEEKLY", "IRREGULAR", "MONTHLY", "WEEKLY"]);
export const loanInterestTypeSchema = z.enum(["COMPOUND", "SIMPLE"]);
export const loanScheduleStatusSchema = z.enum([
  "OVERDUE",
  "PAID",
  "PARTIAL",
  "PENDING",
  "SKIPPED",
]);

export const loanPublicIdSchema = z.object({
  publicId: z.string().trim().min(1),
});

export const loanScheduleIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const loanCreateInputSchema = z.object({
  borrowerName: z.string().min(1),
  borrowerType: loanBorrowerTypeSchema,
  frequency: loanFrequencySchema,
  generateSchedule: z.boolean().optional(),
  interestRate: z.number(),
  interestType: loanInterestTypeSchema,
  notes: z.string().nullable().optional(),
  principalAmount: z.number(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: loanStatusSchema.optional(),
  title: z.string().min(1),
  totalInstallments: z.number().int().positive(),
});

export const loanUpdateInputSchema = loanCreateInputSchema.partial();

export const loanRegenerateSchedulesInputSchema = z.object({
  frequency: loanFrequencySchema.optional(),
  interestRate: z.number().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  totalInstallments: z.number().int().positive().optional(),
});

export const loanPaymentInputSchema = z.object({
  paidAmount: z.number().positive(),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionId: z.number().int().positive(),
});

export const loanScheduleTransactionSchema = z.object({
  amount: z.number().nullable(),
  description: z.string().nullable(),
  id: z.number().int(),
  timestamp: z.coerce.date(),
});

export const loanScheduleSchema = z.object({
  created_at: z.coerce.date(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected_amount: z.number(),
  expected_interest: z.number(),
  expected_principal: z.number(),
  id: z.number().int(),
  installment_number: z.number().int(),
  loan_id: z.number().int(),
  paid_amount: z.number().nullable(),
  paid_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  status: loanScheduleStatusSchema,
  transaction: loanScheduleTransactionSchema.nullable().optional(),
  transaction_id: z.number().int().nullable(),
  updated_at: z.coerce.date(),
});

export const loanSummarySchema = z.object({
  borrower_name: z.string(),
  borrower_type: loanBorrowerTypeSchema,
  created_at: z.coerce.date(),
  frequency: loanFrequencySchema,
  id: z.number().int(),
  interest_rate: z.number(),
  interest_type: loanInterestTypeSchema,
  notes: z.string().nullable(),
  paid_installments: z.number().int(),
  pending_installments: z.number().int(),
  principal_amount: z.number(),
  public_id: z.string(),
  remaining_amount: z.number(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: loanStatusSchema,
  title: z.string(),
  total_expected: z.number(),
  total_installments: z.number().int(),
  total_paid: z.number(),
  updated_at: z.coerce.date(),
});

export const loanListResponseSchema = z.object({
  loans: z.array(loanSummarySchema),
  status: z.literal("ok"),
});

export const loanDetailResponseSchema = z.object({
  loan: loanSummarySchema,
  schedules: z.array(loanScheduleSchema),
  status: z.literal("ok"),
  summary: z.object({
    paid_installments: z.number().int(),
    pending_installments: z.number().int(),
    remaining_amount: z.number(),
    total_expected: z.number(),
    total_paid: z.number(),
  }),
});

export const loanScheduleResponseSchema = z.object({
  schedule: loanScheduleSchema,
  status: z.literal("ok"),
});

export const loanDeleteResponseSchema = z.object({
  status: z.literal("ok"),
});

export const loansContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(loanCreateInputSchema)
    .output(loanDetailResponseSchema),
  delete: oc
    .route({ method: "DELETE", path: "/{publicId}" })
    .input(loanPublicIdSchema)
    .output(loanDeleteResponseSchema),
  detail: oc
    .route({ method: "GET", path: "/{publicId}" })
    .input(loanPublicIdSchema)
    .output(loanDetailResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).output(loanListResponseSchema),
  paySchedule: oc
    .route({ method: "POST", path: "/schedules/{id}/pay" })
    .input(loanScheduleIdSchema.extend({ payload: loanPaymentInputSchema }))
    .output(loanScheduleResponseSchema),
  regenerateSchedules: oc
    .route({ method: "POST", path: "/{publicId}/schedules" })
    .input(loanPublicIdSchema.extend({ payload: loanRegenerateSchedulesInputSchema }))
    .output(loanDetailResponseSchema),
  unlinkSchedulePayment: oc
    .route({ method: "POST", path: "/schedules/{id}/unlink" })
    .input(loanScheduleIdSchema)
    .output(loanScheduleResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{publicId}" })
    .input(loanPublicIdSchema.extend({ payload: loanUpdateInputSchema }))
    .output(loanDetailResponseSchema),
};

export type LoansContract = typeof loansContract;
